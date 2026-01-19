import { getUserWallet } from 'tests/mocks/anvil';
import { test, expect } from '../fixtures/headless‑wallet.fixture';
import { initScript } from '../utils/page';

const sleep = (ms = 2000) => new Promise((resolve) => setTimeout(resolve, ms));

test.describe(() => {
  test.beforeAll(async ({ users }) => {
      await Promise.all(
        users.map(async ({ page }, index) => {
          await page.goto('http://localhost:5173');
        })
      );
      await sleep()
    });
  test('should show all 6 users as connected', async ({ users }) => {
    expect(users).toHaveLength(6);

    const results = await Promise.all(
      users.map(async ({ page, index }) => {
        console.log(`Evaluating user ${index}...`);

        const { account } = getUserWallet(index);
        await initScript(page, index, account.address);

        return page.evaluate(async () => {
          if (!window.ethereum) {
            console.error('No ethereum provider');
            return null;
          }

          try {
            return window.ethereum.selectedAddress;
          } catch (err) {
            console.error('Error fetching accounts:', err);
            return null;
          }
        });
      })
    );

    expect(new Set(results).size).toBe(6);
  });
})