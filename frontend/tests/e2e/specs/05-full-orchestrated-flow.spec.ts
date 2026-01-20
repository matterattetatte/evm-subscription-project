import { test, expect } from '../fixtures/headless‑wallet.fixture';
import { parseEther } from 'viem';
import { initScript } from '../utils/page';
import artifact from '../../../src/abis/SubscriptionService.sol/SubscriptionService.json' with { type: 'json' };
import { getUserWallet, mainDeployer, publicClient, testClient } from 'tests/mocks/anvil';
import { loadFixture } from '../utils/fixture';

const { abi: SubscriptionServiceAbi } = artifact;

async function createTwoServices({ contracts }: any) {
  await mainDeployer.writeContract({
    address: contracts.subscription,
    abi: SubscriptionServiceAbi,
    functionName: 'createService',
    args: [parseEther('0.01'), BigInt(30 * 24 * 60 * 60)],
  });

  await mainDeployer.writeContract({
    address: contracts.subscription,
    abi: SubscriptionServiceAbi,
    functionName: 'createService',
    args: [parseEther('0.05'), BigInt(7 * 24 * 60 * 60)],
  });
}

test.describe('Full Orchestrated Flow', () => {
  test.beforeEach(async ({ users, contracts }) => {
    await createTwoServices({ contracts })

    const [{ page, wallet }] = users;

    await page.goto('http://localhost:5173/subscriptions');
    await initScript(page, 0, wallet.account.address);
    await page.waitForTimeout(200)
  });

  test('Complete user journey: browse → subscribe → extend → gift → verify', async ({ users, contracts }) => {
    const [{ page, wallet }] = users;

      const nextId = Number(await publicClient.readContract({
            address: contracts.subscription,
            abi: SubscriptionServiceAbi,
            functionName: 'nextServiceId',
            args: [],
    }));

    await page.getByTestId(`service-${nextId - 1}`).click();
    await page.waitForLoadState('networkidle')

    await page.getByTestId('subscribe-btn').click();
    await page.waitForSelector('text=Successful transaction', { timeout: 10000 });

    await expect(page.getByText('Successful transaction')).toBeVisible();
    await expect(page.getByText('Active ✅')).toBeVisible();

    const subscription = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'subscriptions',
      args: [BigInt(nextId - 1), wallet.account.address],
    });
    expect(subscription[1]).toBe(true);

    await page.reload();
    await initScript(page, 0, wallet.account.address);
    await page.getByTestId('extend-btn').click();
    await page.waitForSelector('text=Successful transaction', { timeout: 10000 });

    const extendedSubscription = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'subscriptions',
      args: [BigInt(nextId - 1), wallet.account.address],
    });
    expect(extendedSubscription[0]).toBeGreaterThan(subscription[0]);

    const recipient = getUserWallet(1).account.address;
    await page.getByTestId('gift-btn').click();
    await page.getByTestId('recipient-input').fill(recipient);
    await page.getByTestId('gift-confirm-btn').click();

    const giftedSubscription = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'subscriptions',
      args: [BigInt(nextId - 1), recipient],
    });
    expect(giftedSubscription[1]).toBe(true);

    await page.goto('http://localhost:5173/subscriptions');
    await initScript(page, 0, wallet.account.address);

    await page.getByTestId(`service-${nextId}`).click();
    await page.waitForLoadState('networkidle')

    await page.getByTestId('subscribe-btn').click();
    await page.waitForSelector('text=Successful transaction', { timeout: 10000 });

    const service1Status = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'isActive',
      args: [BigInt(nextId - 1), wallet.account.address],
    });

    const service2Status = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'isActive',
      args: [BigInt(nextId), wallet.account.address],
    });

    expect(service1Status).toBe(true);
    expect(service2Status).toBe(true);
  });

  test('Multi-user interaction flow', async ({ users, contracts }) => {
    const [user1, user2] = users;

    const nextId = Number(await publicClient.readContract({
            address: contracts.subscription,
            abi: SubscriptionServiceAbi,
            functionName: 'nextServiceId',
            args: [],
    }));

    await expect(user1.page.locator('[data-testid^="service-"]')).toHaveCount(nextId, { timeout: 10000 });

    await user1.page.getByTestId(`service-${nextId - 1}`).click();
    await user1.page.waitForTimeout(500)

    await user1.page.getByTestId('subscribe-btn').click();
    await user1.page.waitForSelector('text=Successful transaction', { timeout: 10000 });

    await user2.page.goto('http://localhost:5173/subscriptions');
    await initScript(user2.page, 1, user2.wallet.account.address);
    await user2.page.waitForSelector(`[data-testid="service-${nextId - 1}"]`, { timeout: 10000 });

    await user2.page.getByTestId(`service-${nextId - 1}`).click();
    await user2.page.getByTestId('subscribe-btn').click();
    await user2.page.waitForSelector('text=Successful transaction', { timeout: 10000 });
    await user2.page.waitForLoadState('networkidle')

    const user1Subscription = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'isActive',
      args: [BigInt(nextId - 1), user1.wallet.account.address],
    });

    const user2Subscription = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'isActive',
      args: [BigInt(nextId - 1), user2.wallet.account.address],
    });

    expect(user1Subscription).toBe(true);

    expect(user2Subscription).toBe(true);

    await user1.page.getByTestId('gift-btn').click();
    await user1.page.getByTestId('recipient-input').fill(user2.wallet.account.address);
    await user1.page.getByTestId('gift-confirm-btn').click();
    await user1.page.waitForSelector('text=Successful transaction', { timeout: 10000 });
    await user1.page.waitForTimeout(200)

    const user2Service1 = await publicClient.readContract({
      address: contracts.subscription,
      abi: SubscriptionServiceAbi,
      functionName: 'isActive',
      args: [BigInt(nextId - 1), user2.wallet.account.address],
    });

    expect(user2Service1).toBe(true);
  });
});