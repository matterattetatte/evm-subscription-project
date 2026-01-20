// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import "forge-std/Script.sol";
import "../src/SubscriptionService.sol";
import "../src/mocks/MockTimeOracle.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address keeper = vm.envAddress("KEEPER_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        MockTimeOracle timeOracle = new MockTimeOracle(0);

        SubscriptionService service = new SubscriptionService{
            salt: bytes32(0)
        }(keeper, address(timeOracle));

        vm.stopBroadcast();

        console.log("MockTimeOracle deployed to:", address(timeOracle));
        console.log("SubscriptionService deployed to:", address(service));
    }
}
