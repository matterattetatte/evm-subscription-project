// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import "forge-std/Test.sol";
import "../../src/SubscriptionService.sol";
import "../../src/mocks/MockTimeOracle.sol";

import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract SubscriptionServiceAdminTest is Test {
    SubscriptionService service;
    MockTimeOracle timeOracle;

    address internal owner      = makeAddr("owner");
    address internal nonOwner   = makeAddr("nonOwner");
    address internal keeper     = makeAddr("keeper");
    address internal userA      = makeAddr("userA");
    address internal userB      = makeAddr("userB");

    uint256 internal serviceId;           // discovered after creation
    uint256 internal constant PERIOD      = 30 days;
    uint256 internal constant INITIAL_FEE = 0.05 ether;
    uint256 internal constant NEW_FEE     = 0.12 ether;
    uint256 internal constant START_TIME  = 1735689600; // example Jan 1 2025

    function setUp() public virtual {
        vm.startPrank(owner);

        timeOracle = new MockTimeOracle(START_TIME);

        // Deploy with keeper + oracle
        service = new SubscriptionService(keeper, address(timeOracle));

        // Create one service and capture its ID
        serviceId = service.createService(INITIAL_FEE, PERIOD);

        vm.stopPrank();

        vm.deal(userA, 20 ether);
        vm.deal(userB, 20 ether);
        vm.deal(owner, 10 ether);
    }

    function test_CreateService_ReturnsCorrectId() public view {
        assertEq(serviceId, 1, "First service should get ID 1");
    }

    function test_CreateService_SetsCorrectParameters() public view {
        assertEq(service.getServiceFee(serviceId), INITIAL_FEE);
        assertEq(service.getServicePeriod(serviceId), PERIOD);
        assertFalse(service.isServicePaused(serviceId));
        assertEq(service.getCollectedEarnings(serviceId), 0);
    }

    function test_CreateMultipleServices_IdsAreSequential() public {
        vm.prank(owner);
        uint256 id2 = service.createService(0.07 ether, 90 days);

        vm.prank(owner);
        uint256 id3 = service.createService(0.09 ether, 180 days);

        assertEq(id2, 2);
        assertEq(id3, 3);
        assertEq(service.nextServiceId(), 4);
    }

    function test_NonOwnerCannotCreateService_Reverts() public {
        vm.prank(nonOwner);
        vm.expectRevert("AccessControl: account is missing role");
        service.createService(0.1 ether, 30 days);
    }

    function test_OwnerCanUpdateFee() public {
        vm.prank(owner);
        service.changeFee(serviceId, NEW_FEE);

        assertEq(service.getServiceFee(serviceId), NEW_FEE);
    }

    function test_FeeChangeOnlyAffectsFuturePayments() public {
        // Pay with old fee first
        vm.prank(userA);
        service.pay{value: INITIAL_FEE}(serviceId);

        // Change fee
        vm.prank(owner);
        service.changeFee(serviceId, NEW_FEE);

        // Old fee no longer accepted
        vm.prank(userB);
        vm.expectRevert("Incorrect fee");
        service.pay{value: INITIAL_FEE}(serviceId);

        // New fee accepted
        vm.prank(userB);
        service.pay{value: NEW_FEE}(serviceId);
    }

    function test_CannotSetFeeToZero() public {
        vm.prank(owner);
        vm.expectRevert("Fee cannot be zero");
        service.changeFee(serviceId, 0);
    }

    function test_NonOwnerCannotChangeFee_Reverts() public {
        vm.prank(nonOwner);
        vm.expectRevert("AccessControl: account is missing role");
        service.changeFee(serviceId, NEW_FEE);
    }

    function test_OwnerCanPauseService() public {
        vm.prank(owner);
        service.pause(serviceId);

        assertTrue(service.isServicePaused(serviceId));

        vm.prank(userA);
        vm.expectRevert(Pausable.Paused.selector);
        service.pay{value: INITIAL_FEE}(serviceId);
    }

    function test_OwnerCanResumeAfterPause() public {
        vm.prank(owner);
        service.pause(serviceId);

        vm.prank(owner);
        service.resume(serviceId);

        assertFalse(service.isServicePaused(serviceId));

        vm.prank(userA);
        service.pay{value: INITIAL_FEE}(serviceId); // now succeeds
    }

    function test_PauseAlreadyPaused_Reverts() public {
        vm.prank(owner);
        service.pause(serviceId);

        vm.prank(owner);
        vm.expectRevert("Already paused");
        service.pause(serviceId);
    }

    function test_ResumeNotPaused_Reverts() public {
        vm.prank(owner);
        vm.expectRevert("Not paused");
        service.resume(serviceId);
    }

    function test_NonOwnerCannotPauseOrResume_Reverts() public {
        vm.prank(nonOwner);
        vm.expectRevert("AccessControl: account is missing role");
        service.pause(serviceId);

        vm.prank(nonOwner);
        vm.expectRevert("AccessControl: account is missing role");
        service.resume(serviceId);
    }

    function test_OwnerCanWithdrawEarnings() public {
        // Generate earnings
        vm.prank(userA);
        service.pay{value: INITIAL_FEE}(serviceId);

        vm.prank(userB);
        service.pay{value: INITIAL_FEE}(serviceId);

        uint256 earnings = service.getCollectedEarnings(serviceId);
        uint256 ownerBalanceBefore = owner.balance;

        vm.prank(owner);
        service.withdrawEarnings(serviceId);

        assertEq(service.getCollectedEarnings(serviceId), 0);
        assertEq(owner.balance, ownerBalanceBefore + earnings);
    }

    function test_WithdrawZeroEarnings_Reverts() public {
        vm.prank(owner);
        vm.expectRevert("No earnings available");
        service.withdrawEarnings(serviceId);
    }

    function test_NonOwnerCannotWithdraw_Reverts() public {
        vm.prank(userA);
        service.pay{value: INITIAL_FEE}(serviceId);

        vm.prank(nonOwner);
        vm.expectRevert("AccessControl: account is missing role");
        service.withdrawEarnings(serviceId);
    }

    function test_GetServiceStatusSnapshot_AfterSomeActivity() public {
        // Add two subscribers
        vm.prank(userA);
        service.pay{value: INITIAL_FEE}(serviceId);

        vm.prank(userB);
        service.pay{value: INITIAL_FEE}(serviceId);

        // Advance time a bit
        timeOracle.setCurrentTime(START_TIME + 10 days);

        (
            address[] memory subs,
            bool[] memory active,
            uint256[] memory daysLeft
        ) = service.getServiceStatusSnapshot(serviceId);

        assertEq(subs.length, 2);
        assertEq(subs[0], userA);
        assertEq(subs[1], userB);
        assertTrue(active[0]);
        assertTrue(active[1]);
        assertEq(daysLeft[0], PERIOD / 1 days - 10);
        assertEq(daysLeft[1], PERIOD / 1 days - 10);
    }

    function test_NonExistentService_RevertsOnAdminActions() public {
        uint256 fakeId = 999;

        vm.prank(owner);
        vm.expectRevert("Service does not exist");
        service.changeFee(fakeId, 0.2 ether);

        vm.prank(owner);
        vm.expectRevert("Service does not exist");
        service.pause(fakeId);
    }
}
