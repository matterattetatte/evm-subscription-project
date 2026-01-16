import { test as base, expect } from '@playwright/test';
import { getUserWallet } from 'tests/mocks/anvil';
import { sepolia } from 'viem/chains';
import { spawn } from 'child_process';

const LOCAL_RPC = 'http://127.0.0.1:8545';
const ANVIL_SCRIPT = '../../../scripts/anvil-sepolia-fork.sh';

let anvilReady: Promise<void> | null = null;

async function waitForRpcUp(timeout: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const wallet = getUserWallet(0);
      await wallet.getChainId();
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return false;
}

type UserPage = {
  address: string;
  page: import('@playwright/test').Page;
  index: number;
};


async function ensureAnvil(testWorkerIndex: number) {
  if (anvilReady) return anvilReady

  anvilReady = (async () => {
    if (await waitForRpcUp(2_000)) {
      console.log('[ANVIL] Detected running node at', LOCAL_RPC)
      return
    }

    if (testWorkerIndex === 0) {
      console.log('[ANVIL] No node detected — starting anvil via script:', ANVIL_SCRIPT)
      spawn('bash', [ANVIL_SCRIPT], { stdio: 'inherit', detached: true })
      // Give it time to boot
      const ok = await waitForRpcUp(20_000)
      if (!ok) {
        throw new Error(`[ANVIL] Failed to start anvil at ${LOCAL_RPC}. Ensure anvil is installed and fork URL reachable.`)
      }
      console.log('[ANVIL] Node is up.')
    } else {
      const ok = await waitForRpcUp(20_000)
      if (!ok) {
        throw new Error('[ANVIL] Node not reachable on worker; ensure worker 0 could start it.')
      }
    }
  })()

  return anvilReady
}

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