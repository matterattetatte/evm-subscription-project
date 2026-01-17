import { test, expect } from '../fixtures/headless‑wallet.fixture';
import { parseEther } from 'viem';
import { initScript } from '../utils/page';
import { getUserWallet, mainDeployer, publicClient } from 'tests/mocks/anvil';
import { readFileSync } from 'fs';
import { join } from 'path';

test.describe('Subscriber Flow – Happy Paths', () => {
  test.beforeEach(async ({ users, contracts }) => {
    const [{ page }] = users;

    const artifact = JSON.parse(
      readFileSync(
        join(process.cwd(), 'src/abis/SubscriptionService.sol/SubscriptionService.json'),
        'utf-8'
      )
    );

    const hash = await mainDeployer.writeContract({
      address: contracts.subscription,
      abi: artifact.abi,
      functionName: 'createService',
      args: [parseEther('0.01'), BigInt(30 * 24 * 60 * 60)],
    });

    await publicClient.waitForTransactionReceipt({ hash });

    await publicClient.readContract({
      address: contracts.subscription,
      abi: artifact.abi,
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

  test.only('User can see available subscription services', async ({ users }) => {
    const [user] = users;

    await expect(
      user.page.locator('[data-service-id], [data-testid^="service-"]')
    ).toHaveCount(1, { timeout: 10000 });

    await expect(
      user.page.getByText('Service #1')
    ).toBeVisible();
  });

  test('User can subscribe to a service', async ({ users }) => {
    const [user] = users;

    await user.page.locator('[data-testid="subscribe-btn-1"]').click();
    await user.page.waitForSelector('[data-testid="subscription-active"]', { timeout: 10000 });
    
    await expect(user.page.locator('[data-testid="subscription-active"]')).toBeVisible();
  });

  test('User can extend existing subscription', async ({ users, contracts }) => {
    const [user] = users;
    const artifact = JSON.parse(
      readFileSync(join(process.cwd(), '../packages/contracts/out/SubscriptionService.sol/SubscriptionService.json'), 'utf-8')
    );

    // First subscribe
    const wallet = getUserWallet(0);
    await wallet.writeContract({
      address: contracts.subscription,
      abi: artifact.abi,
      functionName: 'pay',
      args: [BigInt(1)],
      value: parseEther('0.01'),
    });

    await user.page.reload();
    await user.page.locator('[data-testid="extend-btn-1"]').click();
    
    await expect(user.page.getByText(/extended/i)).toBeVisible({ timeout: 10000 });
  });

  test('User can gift subscription to another address', async ({ users }) => {
    const [user] = users;
    const recipient = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

    await user.page.locator('[data-testid="gift-btn-1"]').click();
    await user.page.locator('[data-testid="recipient-input"]').fill(recipient);
    await user.page.locator('[data-testid="gift-confirm-btn"]').click();
    
    await expect(user.page.getByText(/gift sent/i)).toBeVisible({ timeout: 10000 });
  });

  test('User can check subscription status', async ({ users, contracts }) => {
    const [user] = users;
    const artifact = JSON.parse(
      readFileSync(join(process.cwd(), '../packages/contracts/out/SubscriptionService.sol/SubscriptionService.json'), 'utf-8')
    );

    // Subscribe first
    const wallet = getUserWallet(0);
    await wallet.writeContract({
      address: contracts.subscription,
      abi: artifact.abi,
      functionName: 'pay',
      args: [BigInt(1)],
      value: parseEther('0.01'),
    });

    await user.page.reload();
    await user.page.locator('[data-testid="service-1"]').click();
    
    await expect(user.page.getByText(/active/i)).toBeVisible();
    await expect(user.page.locator('[data-testid="expiry-date"]')).toBeVisible();
  });

  test('User can pay for multiple periods at once', async ({ users }) => {
    const [user] = users;

    await user.page.locator('[data-testid="periods-input-1"]').fill('3');
    await user.page.locator('[data-testid="subscribe-btn-1"]').click();
    
    await expect(user.page.getByText(/3.*period/i)).toBeVisible({ timeout: 10000 });
  });
});