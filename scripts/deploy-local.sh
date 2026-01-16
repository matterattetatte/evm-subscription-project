#!/bin/bash
set -e

cd "$(dirname "$0")/../packages/contracts"

KEEPER_ADDRESS="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
TIME_ORACLE_ADDRESS="0x0000000000000000000000000000000000000000"

# Deploy MockTimeOracle first
echo "Deploying MockTimeOracle..."
TIME_ORACLE_ADDRESS=$(forge create src/mocks/MockTimeOracle.sol:MockTimeOracle \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --constructor-args $(date +%s) \
  --json | jq -r '.deployedTo')

echo "TimeOracle deployed at: $TIME_ORACLE_ADDRESS"

# Deploy SubscriptionService
echo "Deploying SubscriptionService..."
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
KEEPER_ADDRESS=$KEEPER_ADDRESS \
TIME_ORACLE_ADDRESS=$TIME_ORACLE_ADDRESS \
forge script script/Deploy.s.sol:DeploySubscriptionService \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast

echo "Deployment complete!"
