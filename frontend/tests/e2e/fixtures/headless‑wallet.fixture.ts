import { test as base, expect } from '@playwright/test';
import { getUserWallet, mainDeployer, publicClient } from 'tests/mocks/anvil';
import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { WalletClient } from 'viem';

const LOCAL_RPC = 'http://127.0.0.1:8545';

const ANVIL_SCRIPT = '../scripts/anvil.sh'

let anvilReady: Promise<void> | null = null;

execSync('rm -f .env.local', { stdio: 'inherit' });

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
  wallet: typeof mainDeployer,
  page: import('@playwright/test').Page;
  index: number;
};

async function ensureAnvil(testWorkerIndex: number) {
  if (anvilReady) return anvilReady;

  anvilReady = (async () => {
    if (await waitForRpcUp(2000)) return;

    if (testWorkerIndex === 0) {
      spawn(ANVIL_SCRIPT, { stdio: 'inherit', detached: true });
      const ok = await waitForRpcUp(20000);
      if (!ok) throw new Error(`Failed to start anvil at ${LOCAL_RPC}`);
    } else {
      const ok = await waitForRpcUp(20000);
      if (!ok) throw new Error('Node not reachable on worker');
    }
  })();

  return anvilReady;
}

async function deployContracts() {
  if (existsSync('.env.local') && readFileSync('.env.local', 'utf-8').includes('VITE_SUBSCRIPTION_SERVICE_ADDRESS=')) {
    const content = readFileSync('.env.local', 'utf-8');
    const timeOracle = content.match(/VITE_TIME_ORACLE_ADDRESS=(0x[a-fA-F0-9]{40})/)?.[1];
    const subscription = content.match(/VITE_SUBSCRIPTION_SERVICE_ADDRESS=(0x[a-fA-F0-9]{40})/)?.[1];
    if (timeOracle && subscription) return { timeOracle, subscription };
  }

  const timeArtifact = JSON.parse(
    readFileSync(join(process.cwd(), 'src/abis/MockTimeOracle.sol/MockTimeOracle.json'), 'utf-8')
  );

  const subArtifact = JSON.parse(
    readFileSync(join(process.cwd(), 'src/abis/SubscriptionService.sol/SubscriptionService.json'), 'utf-8')
  );

  const timeHash = await mainDeployer.deployContract({
    abi: timeArtifact.abi,
    bytecode: timeArtifact.bytecode.object,
    args: [BigInt(Math.floor(Date.now() / 1000))],
  });

  const timeReceipt = await publicClient.waitForTransactionReceipt({ hash: timeHash, timeout: 30000 });
  const timeOracle = timeReceipt.contractAddress!;

  const subHash = await mainDeployer.deployContract({
    abi: subArtifact.abi,
    bytecode: subArtifact.bytecode.object,
    args: [mainDeployer.account.address, timeOracle],
  });

  const subReceipt = await publicClient.waitForTransactionReceipt({ hash: subHash, timeout: 30000 });
  const subscription = subReceipt.contractAddress!;

  writeFileSync('.env.local', [
    `VITE_TIME_ORACLE_ADDRESS=${timeOracle}`,
    `VITE_SUBSCRIPTION_SERVICE_ADDRESS=${subscription}`,
  ].join('\n') + '\n', { flag: 'a' });

  return { timeOracle, subscription };
}

export const test = base.extend<{
  anvil: void;
  contracts: { timeOracle: `0x${string}`; subscription: `0x${string}` };
  users: UserPage[];
}>({
  anvil: [
    async ({}, use, testInfo) => {
      await ensureAnvil(testInfo.workerIndex);
      await use();
    },
    { scope: 'worker', auto: true },
  ],

  contracts: async ({ anvil }, use, testInfo) => {
    if (testInfo.workerIndex !== 0) {
      await new Promise(r => setTimeout(r, 5000));
    }

    const addresses = await deployContracts();
    await use(addresses);
  },

  users: async ({ browser, contracts }, use, testInfo) => {
    const users: UserPage[] = [];

    await Promise.all(
      Array.from({ length: 6 }, async (_, index) => {
        const wallet = getUserWallet(index);
        const context = await browser.newContext();
        const page = await context.newPage();

        page.on('console', msg => {
          console.log(`[BROWSER][account:${wallet.account.address.slice(0, 6)}...${wallet.account.address.slice(-4)}][w:${testInfo.workerIndex}] ${msg.type()}: ${msg.text()}`);
        });

        users.push({ wallet, page, index });
      })
    );

    await use(users);

    users.forEach(u => u.page.context().close().catch(() => {}));
  },
});

export { expect };