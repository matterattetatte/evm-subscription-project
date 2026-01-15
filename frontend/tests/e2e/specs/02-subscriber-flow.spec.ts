import { test, expect } from '../fixtures/headless‑wallet.fixture';
import { parseEther } from 'viem';
import { initScript } from '../utils/page';
import { getUserWallet } from 'tests/mocks/anvil';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// TODO: 
// 1. Make sure to deploy smart contract and based on it set json config in frontend somehow
// 2. Set up mock subscription services in frontend tests environment
// 3. set up views and js logic according to the smart contract deployed and the tests here!

test.describe('Subscriber Flow – Happy Paths', () => {
  test.beforeEach(async ({ users }) => {
    const [user] = users;
    await user.page.goto('http://localhost:5173/subscriptions');
    await user.page.waitForLoadState('networkidle');

    const { account } = getUserWallet(0);
    await initScript(user.page, 0, account.address);
    await user.page.waitForFunction(() => !!window.ethereum, { timeout: 10000 });
  });

  test.only('User can see available subscription services', async ({ users }) => {
    const [user] = users

    await expect(
      user.page.getByText(/subscribe|join|plan|service/i)
    ).toBeVisible();

    await expect(
      user.page.locator('[data-service-id], [data-testid^="service-"]')
    ).toHaveCount(1, { timeout: 8000 });
  });
});