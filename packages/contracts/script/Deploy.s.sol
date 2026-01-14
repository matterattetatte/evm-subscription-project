// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import "forge-std/Script.sol";
import "../src/SubscriptionService.sol";

contract DeploySubscriptionService is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address keeper = vm.envAddress("KEEPER_ADDRESS");
        address timeOracle = vm.envAddress("TIME_ORACLE_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        SubscriptionService service = new SubscriptionService{ 
            salt: bytes32(0) 
        }(keeper, timeOracle);

        vm.stopBroadcast();

        console.log("Deployed to:", address(service));
    }
}