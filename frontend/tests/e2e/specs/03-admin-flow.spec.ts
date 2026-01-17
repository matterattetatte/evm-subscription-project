import { test, expect } from '../fixtures/headless‑wallet.fixture';
import { parseEther } from 'viem';
import { initScript } from '../utils/page';
import artifact from '../../../src/abis/SubscriptionService.sol/SubscriptionService.json' with { type: 'json' };
import { getUserWallet, mainDeployer, publicClient } from 'tests/mocks/anvil';

const { abi: SubscriptionServiceAbi } = artifact;

test.describe.only('Admin Flow – Owner Management', () => {
  test.beforeEach(async ({ users, contracts }) => {
    const [{ page }] = users;

    await page.goto('http://localhost:5173/admin');
    await page.waitForLoadState('networkidle');

    const { account } = getUserWallet(0);
    await initScript(page, 0, account.address);

    await page.waitForFunction(() => !!window.ethereum && !!window.ethereum.selectedAddress, {
      timeout: 15000,
    });
  });

  test.only('Owner can create a new service', async ({ users, contracts }) => {
    const [{ page }] = users;

    await page.getByTestId('create-fee-input').fill('0.02');
    await page.getByTestId('create-period-input').fill('60');
    await page.getByTestId('create-service-btn').click();

    await page.waitForSelector('text=Next Service ID: 2', { timeout: 10000 });

    const serviceData = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'services',
      args: [BigInt(1)],
    });

    expect(serviceData[0]).toBe(parseEther('0.02'));
    expect(serviceData[1]).toBe(BigInt(60 * 24 * 60 * 60));
    expect(serviceData[2]).toBe(getUserWallet(0).account.address);
  });

  test('Owner can manage service fee and status', async ({ users, contracts }) => {
    const [{ page }] = users;

    const hash = await mainDeployer.writeContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'createService',
      args: [parseEther('0.01'), BigInt(30 * 24 * 60 * 60)],
    });

    await publicClient.waitForTransactionReceipt({ hash });

    await page.getByTestId('service-id-input').fill('1');
    await page.waitForSelector('text=Fee: 0.01 ETH', { timeout: 5000 });

    await page.getByTestId('new-fee-input').fill('0.05');
    await page.getByTestId('change-fee-btn').click();

    await page.waitForTimeout(2000);

    const updatedService = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'services',
      args: [BigInt(1)],
    });

    expect(updatedService[0]).toBe(parseEther('0.05'));

    await page.getByTestId('pause-service-btn').click();
    await page.waitForTimeout(2000);

    const pausedService = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'services',
      args: [BigInt(1)],
    });

    expect(pausedService[4]).toBe(true);

    await page.getByTestId('resume-service-btn').click();
    await page.waitForTimeout(2000);

    const resumedService = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'services',
      args: [BigInt(1)],
    });

    expect(resumedService[4]).toBe(false);
  });

  test('Owner can withdraw earnings', async ({ users, contracts }) => {
    const [{ page }] = users;

    const createHash = await mainDeployer.writeContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'createService',
      args: [parseEther('0.01'), BigInt(30 * 24 * 60 * 60)],
    });

    await publicClient.waitForTransactionReceipt({ hash: createHash });

    const payHash = await mainDeployer.writeContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'pay',
      args: [BigInt(1)],
      value: parseEther('0.01'),
    });

    await publicClient.waitForTransactionReceipt({ hash: payHash });

    await page.getByTestId('service-id-input').fill('1');
    await page.waitForSelector('text=Earnings: 0.01 ETH', { timeout: 5000 });

    await page.getByTestId('withdraw-earnings-btn').click();
    await page.waitForTimeout(2000);

    const earnings = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'getCollectedEarnings',
      args: [BigInt(1)],
    });

    expect(earnings).toBe(0n);
  });
});