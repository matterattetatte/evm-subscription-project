import { test as base, expect } from '@playwright/test';
import { getUserWallet, mainDeployer, publicClient } from 'tests/mocks/anvil';
import { sepolia } from 'viem/chains';
import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const LOCAL_RPC = 'http://127.0.0.1:8545';
const ANVIL_SCRIPT = '../../../scripts/anvil.sh';

let anvilReady: Promise<void> | null = null;
let contractsDeployed = false;

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

const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const KEEPER_ADDRESS = mainDeployer.account.address;

async function deployContracts(): Promise<void> {
  if (existsSync('.env.local') && readFileSync('.env.local', 'utf-8').includes('SUBSCRIPTION_SERVICE_ADDRESS=')) {
    return;
  }

  console.log('Deploying contracts to Anvil...');
  const timeArtifact = JSON.parse(
    readFileSync(join(process.cwd(), 'src/abis/MockTimeOracle.sol/MockTimeOracle.json'), 'utf-8')
  );

  console.log('Time Oracle artifact bytecode size:', timeArtifact.bytecode.object.length / 2, 'bytes');
  const subArtifact = JSON.parse(
    readFileSync(join(process.cwd(), 'src/abis/SubscriptionService.sol/SubscriptionService.json'), 'utf-8')
  );

  console.log('Subscription artifact bytecode size:', subArtifact.bytecode.object.length / 2, 'bytes');
  const timeDeploy = await mainDeployer.deployContract({
    abi: timeArtifact.abi,
    bytecode: timeArtifact.bytecode.object,
    args: [BigInt(Math.floor(Date.now() / 1000))],
  });

  console.log('Time Oracle deployment tx hash:', timeDeploy);
  const timeReceipt = await publicClient.waitForTransactionReceipt({
    hash: timeDeploy,
    timeout: 30000,
  });

  console.log('Time Oracle deployed at:', timeReceipt.contractAddress);
  const timeOracleAddr = timeReceipt.contractAddress!;

  const subDeploy = await mainDeployer.deployContract({
    abi: subArtifact.abi,
    bytecode: subArtifact.bytecode.object,
    args: [mainDeployer.account.address, timeOracleAddr],
  });

  console.log('Subscription Service deployment tx hash:', subDeploy);
  const subReceipt = await publicClient.waitForTransactionReceipt({
    hash: subDeploy,
    timeout: 30000,
  });

  const subAddr = subReceipt.contractAddress!;

  writeFileSync('.env.local', [
    `TIME_ORACLE_ADDRESS=${timeOracleAddr}`,
    `SUBSCRIPTION_SERVICE_ADDRESS=${subAddr}`,
  ].join('\n') + '\n', { flag: 'a' });
}

export const test = base.extend<{
  users: UserPage[];
}>({
  users: async ({ browser }, use, testInfo) => {
    await ensureAnvil(testInfo.workerIndex);
    
    if (testInfo.workerIndex === 0) {
      await deployContracts();
    }

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