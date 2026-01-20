import { test, expect } from '../fixtures/headless‑wallet.fixture';
import { parseEther } from 'viem';
import { initScript } from '../utils/page';
import artifact from '../../../src/abis/SubscriptionService.sol/SubscriptionService.json' with { type: 'json' };
import { getUserWallet, mainDeployer, publicClient } from 'tests/mocks/anvil';

const { abi: SubscriptionServiceAbi } = artifact;

test.describe('Admin Flow – Owner Management', () => {
  test.beforeEach(async ({ users: [{ page, wallet }]  }) => {
    await page.waitForTimeout(200)
    await page.goto('http://localhost:5173/admin');
    await initScript(page, 0, wallet.account.address);
  })
  test('Owner can create a new service', async ({ users, contracts }) => {
    const [{ page, wallet }] = users;
    await page.waitForLoadState('networkidle')

    await page.getByTestId('create-fee-input').fill('0.02');
    await page.getByTestId('create-period-input').fill('60');
    await page.getByTestId('create-service-btn').click();

    await page.waitForLoadState('networkidle')

     const nextId = await publicClient.readContract({
                address: contracts.subscription,
                abi: SubscriptionServiceAbi,
                functionName: 'nextServiceId',
                args: [],
      });

    const serviceData = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'services',
      args: [nextId],
    });

    expect(serviceData[0]).toBe(parseEther('0.02'));
    expect(serviceData[1]).toBe(BigInt(60 * 24 * 60 * 60));
    expect(serviceData[2]).toBe(wallet.account.address);
  });

  test('Owner can manage service fee and status', async ({ users, contracts }) => {
    const [{ page, wallet }] = users;

    await wallet.writeContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'createService',
      args: [parseEther('0.01'), BigInt(30 * 24 * 60 * 60)],
    });

      const nextId = Number(await publicClient.readContract({
                address: contracts.subscription,
                abi: SubscriptionServiceAbi,
                functionName: 'nextServiceId',
                args: [],
      }));

    
    await page.waitForTimeout(200)
    await page.goto(`http://localhost:5173/admin/services/${nextId}`);
    await initScript(page, 0, wallet.account.address);

    await page.getByTestId('new-fee-input').fill('0.05');
    await page.getByTestId('change-fee-btn').click();
    await page.waitForTimeout(200)

    const updatedService = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'services',
      args: [BigInt(nextId)],
    });

    expect(updatedService[0]).toBe(parseEther('0.05'));

    await page.getByTestId('pause-service-btn').click();
    await page.waitForLoadState('networkidle')

    const pausedService = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'services',
      args: [BigInt(nextId)],
    });

    expect(pausedService[4]).toBe(true);

    await page.getByTestId('resume-service-btn').click();
    await page.waitForLoadState('networkidle')

    const resumedService = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'services',
      args: [BigInt(nextId)],
    });

    expect(resumedService[4]).toBe(false);
  });

  test('Owner can withdraw earnings', async ({ users, contracts }) => {
    const [{ page, wallet }] = users;

    await wallet.writeContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'createService',
      args: [parseEther('0.01'), BigInt(30 * 24 * 60 * 60)],
    });

    const nextId = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'nextServiceId',
    });

    await mainDeployer.writeContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'pay',
      args: [nextId],
      value: parseEther('0.01'),
    });

    await page.goto(`http://localhost:5173/admin/services/${nextId.toString()}`);
    await initScript(page, 0, wallet.account.address)
    await page.waitForSelector('text=Earnings: 0.01 ETH', { timeout: 5000 });

    await page.getByTestId('withdraw-earnings-btn').click();
    await page.waitForTimeout(200)

    const earnings = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'getCollectedEarnings',
      args: [BigInt(nextId)],
    });

    expect(earnings).toBe(0n);
  });
});