pragma solidity 0.8.25;

import "forge-std/Test.sol";
import "../../src/SubscriptionService.sol";
import "../../src/mocks/MockTimeOracle.sol";

contract SubscriptionServiceTest is Test {
    SubscriptionService service;
    MockTimeOracle timeOracle;
    
    uint256 internal serviceId;  // Add this to capture the service ID

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
        
        // Capture the returned service ID
        serviceId = service.createService(FEE, PERIOD);

        vm.stopPrank();
        
        vm.deal(alice,  10 ether);
        vm.deal(bob,    10 ether);
        vm.deal(keeper,  2 ether);
    }

    function test_Pay_CreatesActiveSubscription() public {
        vm.prank(alice);
        service.pay{value: FEE}(serviceId);

        assertTrue(service.isActive(serviceId, alice), "Should be active right after payment");

        assertEq(
            service.getEndDate(serviceId, alice),
            START_TIME + PERIOD,
            "End date should be oracle time + period"
        );
    }

    function test_PayWithIncorrectAmount_Reverts() public {
        vm.prank(alice);
        vm.expectRevert("Incorrect fee"); 
        service.pay{value: FEE - 1 wei}(serviceId);
    }

    function test_PayWhenServicePaused_Reverts() public {
        vm.prank(owner);
        service.pause(serviceId);

        vm.prank(alice);
        vm.expectRevert();
        service.pay{value: FEE}(serviceId);
    }

    function test_Renewal_ExtendsExpirationCorrectly() public {
        vm.prank(alice);
        service.pay{value: FEE}(serviceId);

        uint256 oldEndDate = service.getEndDate(serviceId, alice);
        
        timeOracle.setCurrentTime(START_TIME + 15 days);

        vm.prank(alice);
        service.pay{value: FEE}(serviceId);

        assertEq(
            service.getEndDate(serviceId, alice),
            oldEndDate + PERIOD,
            "Renewal should extend from previous end date"
        );
    }

    function test_SubscriptionExpiresAfterPeriod() public {
        vm.prank(alice);
        service.pay{value: FEE}(serviceId);
        
        timeOracle.setCurrentTime(START_TIME + PERIOD + 1);

        assertFalse(
            service.isActive(serviceId, alice),
            "Should be expired after period + 1 second according to oracle"
        );
    }

    function testFuzz_MultiplePayments_AccumulateExpiration(uint96 extraTime) public {
        vm.assume(extraTime < 365 days);

        vm.prank(alice);
        service.pay{value: FEE}(serviceId);

        uint256 oracleStart = timeOracle.getCurrentTime();

        vm.prank(alice);
        service.pay{value: FEE}(serviceId);
        
        timeOracle.setCurrentTime(oracleStart + extraTime);

        vm.prank(alice);
        service.pay{value: FEE}(serviceId);

        assertEq(
            service.getEndDate(serviceId, alice),
            oracleStart + 3 * PERIOD,
            "Expiration should accumulate correctly across payments"
        );
    }

    function test_KeeperCanFlagRenewalNeeded() public {
        vm.prank(alice);
        service.pay{value: FEE}(serviceId);
        
        timeOracle.setCurrentTime(START_TIME + PERIOD - 7 days);

        vm.prank(keeper);
        service.flagRenewalNeeded(serviceId, alice, true, false);
    }

    function test_NonKeeperCannotFlagRenewalNeeded() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("AccessControlUnauthorizedAccount(address,bytes32)", alice, service.KEEPER_ROLE()));
        
        service.flagRenewalNeeded(serviceId, alice, true, false);
    }
}
