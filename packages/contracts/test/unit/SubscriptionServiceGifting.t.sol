// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import "forge-std/Test.sol";
import "../../src/SubscriptionService.sol";
import "../../src/mocks/MockTimeOracle.sol";

import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract SubscriptionServiceGiftingTest is Test {
    SubscriptionService service;
    MockTimeOracle timeOracle;

    address internal owner      = makeAddr("owner");
    address internal keeper     = makeAddr("keeper");
    address internal gifter     = makeAddr("gifter");
    address internal recipientA = makeAddr("recipientA");
    address internal recipientB = makeAddr("recipientB");
    address internal stranger   = makeAddr("stranger");

    uint256 internal serviceId;
    uint256 internal constant PERIOD      = 30 days;
    uint256 internal constant FEE         = 0.05 ether;
    uint256 internal constant START_TIME  = 1735689600;

    function setUp() public virtual {
        vm.startPrank(owner);

        timeOracle = new MockTimeOracle(START_TIME);
        service = new SubscriptionService(keeper, address(timeOracle));

        serviceId = service.createService(FEE, PERIOD);

        vm.stopPrank();

        vm.deal(gifter,     20 ether);
        vm.deal(recipientA,  5 ether);
        vm.deal(recipientB,  5 ether);
        vm.deal(stranger,   10 ether);
    }

    function test_AnyoneCanGift_WithoutHavingPaid() public {
        vm.prank(gifter);
        service.gift{value: FEE}(serviceId, recipientA);

        assertTrue(service.isActive(serviceId, recipientA));
        assertEq(service.getEndDate(serviceId, recipientA), START_TIME + PERIOD);

        assertFalse(service.isActive(serviceId, gifter));
    }

    function test_GiftWithIncorrectAmount_Reverts() public {
        vm.prank(gifter);
        vm.expectRevert("Incorrect fee");
        service.gift{value: FEE - 1 wei}(serviceId, recipientA);
    }

    function test_GiftWhenServicePaused_Reverts() public {
        vm.prank(owner);
        service.pause(serviceId);

        vm.prank(gifter);
        vm.expectRevert();
        service.gift{value: FEE}(serviceId, recipientB);
    }

    function test_MultipleGiftsToSameRecipient_StackPeriods() public {
        vm.prank(gifter);
        service.gift{value: FEE}(serviceId, recipientB);

        uint256 firstEnd = service.getEndDate(serviceId, recipientB);

        timeOracle.setCurrentTime(START_TIME + 10 days);

        vm.prank(gifter);
        service.gift{value: FEE}(serviceId, recipientB);

        assertEq(service.getEndDate(serviceId, recipientB), firstEnd + PERIOD);
    }

    function test_GiftsFromDifferentGifters_ToDifferentRecipients() public {
        address gifter2 = makeAddr("gifter2");
        vm.deal(gifter2, 10 ether);

        vm.prank(gifter);
        service.gift{value: FEE}(serviceId, recipientA);

        vm.prank(gifter2);
        service.gift{value: FEE}(serviceId, recipientB);

        assertEq(service.getEndDate(serviceId, recipientA), START_TIME + PERIOD);
        assertEq(service.getEndDate(serviceId, recipientB), START_TIME + PERIOD);
        assertTrue(service.isActive(serviceId, recipientA));
        assertTrue(service.isActive(serviceId, recipientB));
    }

    function test_GiftToZeroAddress_Reverts() public {
        vm.prank(gifter);
        vm.expectRevert("Invalid recipient");
        service.gift{value: FEE}(serviceId, address(0));
    }

    function test_GiftNonExistentService_Reverts() public {
        vm.prank(gifter);
        vm.expectRevert("Service does not exist");
        service.gift{value: FEE}(999, recipientB);
    }

    function test_Gift_IncreasesServiceEarnings() public {
        uint256 earningsBefore = service.getCollectedEarnings(serviceId);

        vm.prank(gifter);
        service.gift{value: FEE}(serviceId, recipientB);

        assertEq(service.getCollectedEarnings(serviceId), earningsBefore + FEE);
    }

    function test_GiftedSubscription_CanBeFlaggedByKeeper_RecipientB() public {
        vm.prank(gifter);
        service.gift{value: FEE}(serviceId, recipientB);

        timeOracle.setCurrentTime(START_TIME + PERIOD - 7 days);

        vm.prank(keeper);
        service.flagRenewalNeeded(serviceId, recipientB, true, false);
    }
}
