/* eslint-disable react-hooks/rules-of-hooks */
import { expect, Page, test as base } from '@playwright/test'
import { spawn } from 'child_process'
import { JsonRpcProvider } from 'ethers'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ──────────────────────────────────────────────────────────────
// Your fake wallet (deterministic so you can pre-fund it)
// ──────────────────────────────────────────────────────────────
const FAKE_CHAIN_ID = '0x2105' // Base chain id (hex)
const LOCAL_RPC = process.env.ANVIL_RPC || 'http://127.0.0.1:8545'
const ANVIL_SCRIPT = path.resolve(__dirname, '../../../../anvil-base-fork.sh')
let anvilReady: Promise<void> | null = null

async function waitForRpcUp(timeoutMs = 10_000) {
  const provider = new JsonRpcProvider(LOCAL_RPC)
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      await provider.getBlockNumber()
      return true
    } catch {
      await new Promise((res) => setTimeout(res, 500))
    }
  }
  return false
}

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

// ──────────────────────────────────────────────────────────────
// Playwright fixture with god-mode wallet + token balances + prices
// ──────────────────────────────────────────────────────────────
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use, testInfo) => {
    await ensureAnvil(testInfo.workerIndex ?? 0)
    // Spread workers across unique Anvil accounts to avoid nonce collisions when funding.
    const accountIndex = process.env.E2E_ACCOUNT_INDEX ? Number(process.env.E2E_ACCOUNT_INDEX) : (testInfo.workerIndex ?? 0)
    const user = getUserWallet(accountIndex)

    // Surface browser console logs in test output for easier diagnostics.
    page.on('console', (msg) => {
      console.log(`[BROWSER][worker:${testInfo.workerIndex}] ${msg.type()}: ${msg.text()}`)
    })

    console.log(`[WALLET FIXTURE] Worker ${testInfo.workerIndex} using anvil account ${user.account.address} (index ${accountIndex})`)

    await page.addInitScript(
      ({ selectedAddress, chainId }) => {
        // Deterministic injected EIP-1193 provider for headless Playwright
        const mockProvider = {
          isMetaMask: true,
          selectedAddress,
          request: async ({ method, params }: { method: string; params?: any[] }) => {
            if (['eth_requestAccounts', 'eth_accounts', 'wallet_switchEthereumChain', 'wallet_addEthereumChain'].includes(method)) {
              return [selectedAddress]
            }
            if (method === 'eth_chainId' || method === 'net_version') {
              return chainId
            }
            if (method === 'personal_sign' || method === 'eth_signTypedData_v4' || method === 'eth_sign') {
              return '0xdeadbeef'
            }
            // Forward everything else to the real provider (Anvil) if present
            const paramsSafe = params ?? []
            return (window as any).originalEthereum?.request?.({ method, params: paramsSafe }) || Promise.reject(new Error(`Stub wallet — unhandled method: ${method}`))
          },
          on: () => {},
          removeListener: () => {},
        }

        ;(window as any).ethereum = mockProvider
        ;(window as any).originalEthereum = mockProvider
      },
      { selectedAddress: user.account.address, chainId: FAKE_CHAIN_ID }
    )
    // TODO: DEPLOY CONTRACT if needed!

    await use(page)
  },
})

export { expect }
