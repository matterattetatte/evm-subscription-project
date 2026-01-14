import { test, expect } from '../fixtures/headless‑wallet.fixture';
import { parseEther } from 'viem';
import { initScript } from '../utils/page';
import { getUserWallet } from 'tests/mocks/anvil';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

test.describe('Subscriber Flow – Happy Paths', () => {
  test.beforeEach(async ({ users }) => {
    const [user] = users;
    await user.page.goto('http://localhost:5173');
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