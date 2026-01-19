import { test, expect } from '../fixtures/headless‑wallet.fixture';
import { parseEther } from 'viem';
import artifact from '../../../src/abis/SubscriptionService.sol/SubscriptionService.json' with { type: 'json' };
import { getUserWallet, mainDeployer, publicClient, keeperWallet } from 'tests/mocks/anvil';

const { abi: SubscriptionServiceAbi } = artifact;

test.describe.skip('Keeper Flow – Bot Operations', () => {
  test('Keeper can flag renewal needed for subscribers', async ({ contracts }) => {
    await mainDeployer.sendTransaction({
      to: keeperWallet.account.address,
      value: parseEther('1'),
    });

    const createHash = await mainDeployer.writeContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'createService',
      args: [parseEther('0.01'), BigInt(30 * 24 * 60 * 60)],
    });

    await publicClient.waitForTransactionReceipt({ hash: createHash });

    const payHash = await getUserWallet(0).writeContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'pay',
      args: [BigInt(1)],
      value: parseEther('0.01'),
    });

    await publicClient.waitForTransactionReceipt({ hash: payHash });

    const flagHash = await keeperWallet.writeContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'flagRenewalNeeded',
      args: [BigInt(1), getUserWallet(0).account.address, true, false],
      gas: 10000000n,
    });

    await publicClient.waitForTransactionReceipt({ hash: flagHash });

    const subscription = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'subscriptions',
      args: [BigInt(1), getUserWallet(0).account.address],
    });

    expect(subscription[2]).toBe(true); // renewalFlagged
  });

  test('Keeper can get service status snapshot', async ({ contracts }) => {
    const createHash = await mainDeployer.writeContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'createService',
      args: [parseEther('0.01'), BigInt(30 * 24 * 60 * 60)],
    });

    await publicClient.waitForTransactionReceipt({ hash: createHash });

    const payHash = await getUserWallet(0).writeContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'pay',
      args: [BigInt(1)],
      value: parseEther('0.01'),
    });

    await publicClient.waitForTransactionReceipt({ hash: payHash });

    const snapshot = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'getServiceStatusSnapshot',
      args: [BigInt(1)],
    });

    const [subscribers, activeStatuses, remainingDays] = snapshot as [string[], boolean[], bigint[]];
    
    expect(subscribers.length).toBe(1);
    expect(subscribers[0]).toBe(getUserWallet(0).account.address);
    expect(activeStatuses[0]).toBe(true);
    expect(remainingDays[0]).toBeGreaterThan(0n);
  });

  test('Keeper can sweep fees when threshold is met', async ({ contracts }) => {
    const createHash = await mainDeployer.writeContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'createService',
      args: [parseEther('0.02'), BigInt(30 * 24 * 60 * 60)],
    });

    await publicClient.waitForTransactionReceipt({ hash: createHash });

    const payHash = await getUserWallet(0).writeContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'pay',
      args: [BigInt(1)],
      value: parseEther('0.02'),
    });

    await publicClient.waitForTransactionReceipt({ hash: payHash });

    const balanceBefore = await publicClient.getBalance({ address: contracts.subscription });
    expect(balanceBefore).toBeGreaterThanOrEqual(parseEther('0.016'));

    const sweepHash = await keeperWallet.writeContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'sweepFees',
      args: [],
      gas: 200000n,
    });

    await publicClient.waitForTransactionReceipt({ hash: sweepHash });

    const earnings = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'getCollectedEarnings',
      args: [BigInt(1)],
    });

    expect(earnings).toBe(0n);
  });
});