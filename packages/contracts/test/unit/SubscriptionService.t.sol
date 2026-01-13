
pragma solidity 0.8.25;

import "forge-std/Test.sol";
import "../../src/SubscriptionService.sol";
import "../../src/mocks/MockTimeOracle.sol";

import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract SubscriptionServiceTest is Test {
    SubscriptionService service;
    MockTimeOracle timeOracle;

    address internal owner  = makeAddr("owner");
    address internal alice  = makeAddr("alice");
    address internal bob    = makeAddr("bob");
    address internal keeper = makeAddr("keeper");

    uint256 internal constant PERIOD     = 30 days;
    uint256 internal constant FEE        = 0.05 ether;

    uint256 internal constant START_TIME = 1735689600; 

    function setUp() public virtual {
        vm.startPrank(owner);

        
        timeOracle = new MockTimeOracle(START_TIME);

        
        service = new SubscriptionService(keeper, address(timeOracle));

        
        service.createService(FEE, PERIOD);

        vm.stopPrank();

        
        vm.deal(alice,  10 ether);
        vm.deal(bob,    10 ether);
        vm.deal(keeper,  2 ether);
    }

    function test_Pay_CreatesActiveSubscription() public {
        vm.prank(alice);
        service.pay{value: FEE}(SERVICE_ID);

        assertTrue(service.isActive(SERVICE_ID, alice), "Should be active right after payment");

        assertEq(
            service.getEndDate(SERVICE_ID, alice),
            START_TIME + PERIOD,
            "End date should be oracle time + period"
        );
    }

    function test_PayWithIncorrectAmount_Reverts() public {
        vm.prank(alice);
        vm.expectRevert("Incorrect fee"); 
        service.pay{value: FEE - 1 wei}(SERVICE_ID);
    }

    function test_PayWhenServicePaused_Reverts() public {
        vm.prank(owner);
        service.pause(SERVICE_ID);

        vm.prank(alice);
        vm.expectRevert(Pausable.Paused.selector);
        service.pay{value: FEE}(SERVICE_ID);
    }

    function test_Renewal_ExtendsExpirationCorrectly() public {
        vm.prank(alice);
        service.pay{value: FEE}(SERVICE_ID);

        uint256 oldEndDate = service.getEndDate(SERVICE_ID, alice);

        
        timeOracle.setCurrentTime(START_TIME + 15 days);

        vm.prank(alice);
        service.pay{value: FEE}(SERVICE_ID);

        assertEq(
            service.getEndDate(SERVICE_ID, alice),
            oldEndDate + PERIOD,
            "Renewal should extend from previous end date"
        );
    }

    function test_SubscriptionExpiresAfterPeriod() public {
        vm.prank(alice);
        service.pay{value: FEE}(SERVICE_ID);

        
        timeOracle.setCurrentTime(START_TIME + PERIOD + 1);

        assertFalse(
            service.isActive(SERVICE_ID, alice),
            "Should be expired after period + 1 second according to oracle"
        );
    }

    function testFuzz_MultiplePayments_AccumulateExpiration(uint96 extraTime) public {
        vm.assume(extraTime < 365 days);

        vm.prank(alice);
        service.pay{value: FEE}(SERVICE_ID);

        uint256 oracleStart = timeOracle.getTime();

        vm.prank(alice);
        service.pay{value: FEE}(SERVICE_ID);

        
        timeOracle.setCurrentTime(oracleStart + extraTime);

        vm.prank(alice);
        service.pay{value: FEE}(SERVICE_ID);

        assertEq(
            service.getEndDate(SERVICE_ID, alice),
            oracleStart + 3 * PERIOD,
            "Expiration should accumulate correctly across payments"
        );
    }

    function test_KeeperCanFlagRenewalNeeded() public {
        vm.prank(alice);
        service.pay{value: FEE}(SERVICE_ID);

        
        timeOracle.setCurrentTime(START_TIME + PERIOD - 7 days);

        vm.prank(keeper);
        service.flagRenewalNeeded(SERVICE_ID, alice, true, false);

        
        
        
    }

    function test_NonKeeperCannotFlagRenewalNeeded() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("AccessControlUnauthorizedAccount(address,bytes32)", alice, service.KEEPER_ROLE()));
        
        service.flagRenewalNeeded(SERVICE_ID, alice, true, false);
    }
}