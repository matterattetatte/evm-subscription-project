import { getUserWallet } from 'tests/mocks/anvil';
import { test, expect } from '../fixtures/headless‑wallet.fixture';
import { initScript } from '../utils/page';

const sleep = (ms = 2000) => new Promise((resolve) => setTimeout(resolve, ms));

test.describe(() => {
  test.beforeAll(async ({ users }) => {
      await Promise.all(
        users.map(async ({ page }, index) => {
          await page.goto('http://localhost:5173');
          await page.waitForLoadState('networkidle');
          const { account } = getUserWallet(index);
          await initScript(page, index, account.address);
        })
      );
      await sleep()
    });
  test('should show all 6 users as connected', async ({ users }) => {
    expect(users).toHaveLength(6);

    const results = await Promise.all(
      users.map(async ({ page, index }) => {
        console.log(`Evaluating user ${index}...`);

        return page.evaluate(async () => {
          if (!window.ethereum) {
            console.error('No ethereum provider');
            return null;
          }

          try {
            const accounts = await window.ethereum.request({
              method: 'eth_requestAccounts',   // ← changed to requestAccounts
            });
            console.log('Accounts returned:', accounts);
            return accounts;
          } catch (err) {
            console.error('Error fetching accounts:', err);
            return null;
          }
        });
      })
    );

    console.log('All results:', results);

    expect(
      results.every(acc => Array.isArray(acc) && acc.length > 0),
      'Every user should have connected accounts'
    ).toBe(true);

    const addresses = results.map(acc => acc?.[0]?.toLowerCase() ?? null);
    const uniqueAddresses = new Set(addresses.filter(Boolean));
    expect(uniqueAddresses.size).toBe(6);
  });
})