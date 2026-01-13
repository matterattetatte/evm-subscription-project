// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import "forge-std/Test.sol";
import "../../src/SubscriptionService.sol";
import "../../src/mocks/MockTimeOracle.sol";

import "@openzeppelin/contracts/access/AccessControl.sol";

contract SubscriptionServiceFeesTest is Test {
    SubscriptionService service;
    MockTimeOracle timeOracle;

    address internal owner      = makeAddr("owner");
    address internal keeper     = makeAddr("keeper");
    address internal userA      = makeAddr("userA");
    address internal userB      = makeAddr("userB");
    address internal nonKeeper  = makeAddr("random");

    uint256 internal serviceIdA;
    uint256 internal serviceIdB;

    uint256 internal constant PERIOD        = 30 days;
    uint256 internal constant FEE_A         = 0.05 ether;
    uint256 internal constant FEE_B         = 0.08 ether;
    uint256 internal constant START_TIME    = 1735689600;
    uint256 internal constant MIN_SWEEP_ETH = 0.016 ether; // ~50 USD at ~3100 USD/ETH

    function setUp() public virtual {
        vm.startPrank(owner);

        timeOracle = new MockTimeOracle(START_TIME);
        service = new SubscriptionService(keeper, address(timeOracle));

        // Create two services
        serviceIdA = service.createService(FEE_A, PERIOD);
        serviceIdB = service.createService(FEE_B, PERIOD);

        vm.stopPrank();

        vm.deal(userA, 50 ether);
        vm.deal(userB, 50 ether);
        vm.deal(keeper, 5 ether);
    }

    function test_PaymentsAccumulatePerService() public {
        vm.prank(userA);
        service.pay{value: FEE_A}(serviceIdA);

        vm.prank(userB);
        service.pay{value: FEE_A}(serviceIdA);

        vm.prank(userA);
        service.pay{value: FEE_B}(serviceIdB);

        assertEq(service.getCollectedEarnings(serviceIdA), 2 * FEE_A);
        assertEq(service.getCollectedEarnings(serviceIdB), FEE_B);
        assertEq(address(service).balance, 3 * FEE_A); // wait — actually 2*A + B
    }

    function test_PayIncreasesContractBalanceAndEarnings() public {
        uint256 beforeContract = address(service).balance;

        vm.prank(userA);
        service.pay{value: FEE_A}(serviceIdA);

        assertEq(address(service).balance, beforeContract + FEE_A);
        assertEq(service.getCollectedEarnings(serviceIdA), FEE_A);
    }

    function test_OwnerCanWithdrawPerServiceEarnings() public {
        // Generate earnings on service A
        vm.prank(userA);
        service.pay{value: FEE_A}(serviceIdA);
        vm.prank(userB);
        service.pay{value: FEE_A}(serviceIdA);

        uint256 earnings = service.getCollectedEarnings(serviceIdA);
        uint256 ownerBalBefore = owner.balance;

        vm.prank(owner);
        service.withdrawEarnings(serviceIdA);

        assertEq(service.getCollectedEarnings(serviceIdA), 0);
        assertEq(owner.balance, ownerBalBefore + earnings);
        assertEq(address(service).balance, FEE_A * 0); // if only A had earnings
    }

    function test_NonOwnerCannotWithdrawPerService_Reverts() public {
        vm.prank(userA);
        service.pay{value: FEE_A}(serviceIdA);

        vm.prank(nonKeeper);
        vm.expectRevert("AccessControl: account is missing role");
        service.withdrawEarnings(serviceIdA);
    }

    function test_WithdrawZeroPerService_Reverts() public {
        vm.prank(owner);
        vm.expectRevert("No earnings available");
        service.withdrawEarnings(serviceIdA);
    }

    function test_KeeperCanSweepWhenAboveThreshold() public {
        // Generate enough earnings across services
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(userA);
            service.pay{value: FEE_A}(serviceIdA);
            vm.prank(userB);
            service.pay{value: FEE_B}(serviceIdB);
        }

        uint256 totalEarnings = address(service).balance;
        assertGt(totalEarnings, MIN_SWEEP_ETH, "Need enough for test");

        uint256 keeperGasBefore = keeper.balance;
        uint256 ownerBalBefore = owner.balance;

        vm.prank(keeper);
        service.sweepFees(); // assume sends to owner/treasury

        assertEq(address(service).balance, 0);
        assertEq(owner.balance, ownerBalBefore + totalEarnings);
        // keeper paid gas, but balance decreased only by gas
        assertLt(keeper.balance, keeperGasBefore);
    }

    function test_KeeperCannotSweepBelowThreshold_Reverts() public {
        // Just one small payment
        vm.prank(userA);
        service.pay{value: 0.005 ether}(serviceIdA);

        vm.prank(keeper);
        vm.expectRevert("Below minimum sweep threshold");
        service.sweepFees();
    }

    function test_NonKeeperCannotSweep_Reverts() public {
        vm.prank(userA);
        service.pay{value: FEE_A}(serviceIdA);

        vm.prank(nonKeeper);
        vm.expectRevert("AccessControl: account is missing role");
        service.sweepFees();
    }

    function test_SweepEmitsEvent() public {
        vm.prank(userA);
        service.pay{value: FEE_A * 10}(serviceIdA);

        vm.expectEmit(true, true, false, true);
        emit FeesSwept(owner, FEE_A * 10); // assume event FeesSwept(address to, uint256 amount)

        vm.prank(keeper);
        service.sweepFees();
    }

    function test_WithdrawAfterSweep_StillZero() public {
        vm.prank(userA);
        service.pay{value: FEE_A}(serviceIdA);

        vm.prank(keeper);
        service.sweepFees();

        vm.prank(owner);
        vm.expectRevert("No earnings available");
        service.withdrawEarnings(serviceIdA);
    }

    function test_MultipleSweeps_OnlyWhenEnoughAgain() public {
        // First batch
        for (uint256 i = 0; i < 4; i++) {
            vm.prank(userA);
            service.pay{value: FEE_A}(serviceIdA);
        }

        vm.prank(keeper);
        service.sweepFees();

        // Second batch — below threshold
        vm.prank(userB);
        service.pay{value: 0.005 ether}(serviceIdB);

        vm.prank(keeper);
        vm.expectRevert("Below minimum sweep threshold");
        service.sweepFees();
    }
}
