import { test, expect } from '../fixtures/headless‑wallet.fixture';
import { parseEther } from 'viem';
import { initScript } from '../utils/page';
import artifact from '../../../src/abis/SubscriptionService.sol/SubscriptionService.json' with { type: 'json' };
import { getUserWallet, mainDeployer, publicClient } from 'tests/mocks/anvil';

const { abi: SubscriptionServiceAbi } = artifact;

test.describe.skip('Subscriber Flow – Happy Paths', () => {
  test.beforeEach(async ({ users, contracts }) => {
    const [{ page }] = users;

    const hash = await mainDeployer.writeContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'createService',
      args: [parseEther('0.01'), BigInt(30 * 24 * 60 * 60)],
    });

    await publicClient.waitForTransactionReceipt({ hash });

    await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'nextServiceId',
    });

    await page.goto('http://localhost:5173/subscriptions');
    await page.waitForLoadState('networkidle');

    const { account } = getUserWallet(0);

    await initScript(page, 0, account.address);

    await page.waitForFunction(() => !!window.ethereum && !!window.ethereum.selectedAddress, {
      timeout: 15000,
    });
  });

  test('User can see available subscription services', async ({ users }) => {
    const [user] = users;

    await expect(
      user.page.locator('[data-service-id], [data-testid^="service-"]')
    ).toHaveCount(1, { timeout: 10000 });

    await expect(
      user.page.getByText('Service #1')
    ).toBeVisible();
  });

  test('User can subscribe to a service, extend it and gift to another address', async ({ users, contracts }) => {
    const [{ page }] = users;

    await page.getByTestId('service-1').click();
    await page.waitForLoadState('networkidle');

    await page.getByTestId('subscribe-btn-1').click();
    await page.waitForSelector('text=Successfully subscribed!', { timeout: 10000 });

    await expect(page.getByText('Successfully subscribed!')).toBeVisible();
    await expect(page.getByText('Active ✅')).toBeVisible();

    const newSubscription = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'subscriptions',
      args: [BigInt(1), getUserWallet(0).account.address],
    });

    expect(newSubscription[0]).toBeGreaterThan(0n);
    expect(newSubscription[1]).toBe(true);

    await page.reload();
    await page.getByTestId('extend-btn').click();

    const extendedSubscription = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'subscriptions',
      args: [BigInt(1), getUserWallet(0).account.address],
    });

    const serviceData = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'services',
      args: [BigInt(1)],
    });
    
    const servicePeriod = serviceData[1];
    expect(extendedSubscription[0]).toBe(newSubscription[0] + servicePeriod);
    expect(extendedSubscription[1]).toBe(true);

    const recipient = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
    await page.getByTestId("gift-btn").click();
    await page.getByTestId("recipient-input").fill(recipient);
    await page.getByTestId("gift-confirm-btn").click();

    const giftedSubscription = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'subscriptions',
      args: [BigInt(1), recipient],
    });

    expect(giftedSubscription[0]).toBeGreaterThan(0n);
    expect(giftedSubscription[1]).toBe(true);
  });
});