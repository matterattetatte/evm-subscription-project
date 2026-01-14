// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import "forge-std/Test.sol";
import "../../src/SubscriptionService.sol";
import "../../src/mocks/MockTimeOracle.sol";

import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract FullFlowTest is Test {
    SubscriptionService service;
    MockTimeOracle timeOracle;

    address internal owner     = makeAddr("owner");
    address internal admin1    = makeAddr("admin1");
    address internal admin2    = makeAddr("admin2");
    address internal keeper    = makeAddr("keeper");

    address internal subA1     = makeAddr("subA1");
    address internal subA2     = makeAddr("subA2");
    address internal subA3     = makeAddr("subA3");

    address internal subB1     = makeAddr("subB1");
    address internal subB2     = makeAddr("subB2");
    address internal subB3     = makeAddr("subB3");

    uint256 internal admin1Service1;
    uint256 internal admin1Service2;
    uint256 internal admin2Service1;
    uint256 internal admin2Service2;

    uint256 internal constant PERIOD      = 30 days;
    uint256 internal constant FEE         = 0.05 ether;
    uint256 internal constant LOW_FEE     = 0.01 ether;
    uint256 internal constant START_TIME  = 1735689600;
    uint256 internal constant MIN_SWEEP   = 0.016 ether; // ca 50 USD

    function setUp() public {
        vm.startPrank(owner);

        timeOracle = new MockTimeOracle(START_TIME);
        service = new SubscriptionService(keeper, address(timeOracle));

        service.grantRole(service.DEFAULT_ADMIN_ROLE(), admin1);
        service.grantRole(service.DEFAULT_ADMIN_ROLE(), admin2);

        vm.stopPrank();

        vm.deal(admin1, 10 ether);
        vm.deal(admin2, 10 ether);
        vm.deal(keeper, 10 ether);

        vm.deal(subA1, 10 ether);
        vm.deal(subA2, 10 ether);
        vm.deal(subA3,  1 ether);

        vm.deal(subB1, 10 ether);
        vm.deal(subB2,  1 ether);
        vm.deal(subB3, 0.01 ether);
    }

    function test_ExtensiveMultiAdminMultiServiceFlow() public {
        setupServices();
        setupSubscriptions();
        advanceTime20Days();
        keeperSnapshotAndFlagAllServices();
        performMixedRenewals();
        advanceTimeToExpiry();
        testPauseResume();
        adminsWithdrawEarnings();
        testFeeSweep();
        verifyFinalState();
    }

    function setupServices() internal {
        vm.prank(admin1);
        admin1Service1 = service.createService(FEE, PERIOD);

        vm.prank(admin1);
        admin1Service2 = service.createService(LOW_FEE, PERIOD);

        vm.prank(admin2);
        admin2Service1 = service.createService(FEE, PERIOD);

        vm.prank(admin2);
        admin2Service2 = service.createService(LOW_FEE, PERIOD);

        assertEq(admin1Service1, 1);
        assertEq(admin1Service2, 2);
        assertEq(admin2Service1, 3);
        assertEq(admin2Service2, 4);
    }

    function setupSubscriptions() internal {
        vm.prank(subA1);
        service.pay{value: FEE}(admin1Service1);

        vm.prank(subA1);
        service.pay{value: LOW_FEE}(admin1Service2);

        vm.prank(subA1);
        service.pay{value: FEE}(admin2Service1);

        vm.prank(subA2);
        service.pay{value: FEE}(admin1Service1);

        vm.prank(subA2);
        service.gift{value: LOW_FEE}(admin1Service2, subA3);

        vm.prank(subA3);
        service.pay{value: LOW_FEE}(admin2Service2);

        vm.prank(subB1);
        service.pay{value: FEE}(admin2Service1);

        vm.prank(subB1);
        service.pay{value: LOW_FEE}(admin2Service2);

        vm.prank(subB1);
        service.pay{value: FEE}(admin1Service1);

        vm.prank(subB2);
        service.pay{value: FEE}(admin2Service1);

        vm.prank(subB2);
        service.gift{value: LOW_FEE}(admin2Service2, subB3);

        vm.prank(subB3);
        vm.expectRevert("IncorrectFee()");
        service.pay{value: 0.005 ether}(admin1Service2);

        assertTrue(service.isActive(admin1Service1, subA1));
        assertTrue(service.isActive(admin2Service1, subB1));
        assertTrue(service.isActive(admin2Service2, subB3));
    }

    function advanceTime20Days() internal {
        timeOracle.setCurrentTime(START_TIME + 20 days);
    }

    function keeperSnapshotAndFlagAllServices() internal {
        flagServiceSubs(admin1Service1);
        flagServiceSubs(admin1Service2);
        flagServiceSubs(admin2Service1);
        flagServiceSubs(admin2Service2);
    }

    function flagServiceSubs(uint256 serviceId) internal {
        vm.prank(keeper);
        (address[] memory subs, bool[] memory active, uint256[] memory remainingDays) = service.getServiceStatusSnapshot(serviceId);
        
        for (uint256 i = 0; i < subs.length; i++) {
            if (remainingDays[i] < 14 days) {
                vm.prank(keeper);
                service.flagRenewalNeeded(serviceId, subs[i], true, false);
            }
        }
    }

    function performMixedRenewals() internal {
        vm.prank(subA1);
        service.pay{value: FEE}(admin1Service1);

        vm.prank(subB2);
        service.pay{value: FEE}(admin2Service1);
    }

    function advanceTimeToExpiry() internal {
        timeOracle.setCurrentTime(START_TIME + PERIOD + 5 days);

        assertTrue(service.isActive(admin1Service1, subA1));
        assertFalse(service.isActive(admin1Service1, subA2));
        assertFalse(service.isActive(admin2Service2, subB3));
    }

    function testPauseResume() internal {
        vm.prank(admin1);
        service.pause(admin1Service2);

        vm.prank(subA3);
        vm.expectRevert();
        service.pay{value: LOW_FEE}(admin1Service2);

        assertFalse(service.isActive(admin1Service2, subA3));

        vm.prank(admin1);
        service.resume(admin1Service2);
    }

    function adminsWithdrawEarnings() internal {
        uint256 admin1BalBefore = admin1.balance;

        vm.prank(admin1);
        service.withdrawEarnings(admin1Service1);

        vm.prank(admin1);
        service.withdrawEarnings(admin1Service2);

        assertGt(admin1.balance, admin1BalBefore);

        uint256 admin2BalBefore = admin2.balance;

        vm.prank(admin2);
        service.withdrawEarnings(admin2Service1);

        vm.prank(admin2);
        service.withdrawEarnings(admin2Service2);

        assertGt(admin2.balance, admin2BalBefore);
    }

    function testFeeSweep() internal {
        vm.prank(subA1);
        service.pay{value: FEE}(admin1Service1);

        uint256 totalBefore = address(service).balance;
        if (totalBefore >= MIN_SWEEP) {
            vm.prank(keeper);
            service.sweepFees();
            assertEq(address(service).balance, 0);
        } else {
            vm.prank(keeper);
            vm.expectRevert("BelowSweepThreshold()");
            service.sweepFees();
        }
    }

    function verifyFinalState() view internal {
        assertEq(service.getCollectedEarnings(admin1Service1), 0);
        assertEq(service.getCollectedEarnings(admin2Service2), 0);
    }
}
