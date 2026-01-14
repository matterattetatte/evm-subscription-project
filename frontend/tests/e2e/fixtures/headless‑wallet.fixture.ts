import { test as base, expect } from '@playwright/test';
import { getUserWallet } from 'tests/mocks/anvil';
import { sepolia } from 'viem/chains';

type UserPage = {
  address: string;
  page: import('@playwright/test').Page;
  index: number;
};

export const test = base.extend<{
  users: UserPage[];
}>({
  users: async ({ browser }, use, testInfo) => {
    const users: UserPage[] = [];

    await Promise.all(
      Array.from({ length: 6 }, async (_, index) => {
        const { account } = getUserWallet(index);
        const context = await browser.newContext();
        const page = await context.newPage();

        page.on('console', (msg) => {
          console.log(`[BROWSER][worker:${testInfo.workerIndex}] ${msg.type()}: ${msg.text()}`)
        })

        users.push({ address: account.address, page, index });
      })
    );

    await use(users);
    
    users.forEach(({ page }) => page.context().close().catch(() => {}));
  },
});

export { expect };