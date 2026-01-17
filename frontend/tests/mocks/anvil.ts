import path from 'path'
import { fileURLToPath } from 'url'
import {
  createPublicClient,
  createTestClient,
  createWalletClient, http
} from 'viem'
import { mnemonicToAccount } from 'viem/accounts'
import { anvil } from 'viem/chains'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const RPC_URL = process.env.ANVIL_RPC || 'http://127.0.0.1:8545'
const ANVIL_MNEMONIC = process.env.ANVIL_MNEMONIC || 'test test test test test test test test test test test junk'

const addressIndex = 0
const clientConfig = {
  chain: anvil,
  transport: http(RPC_URL),
  account: mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex }),
}

export const testClient = createTestClient({
  mode: 'anvil',
  ...clientConfig,
})

export const publicClient = createPublicClient(clientConfig)

export const mainDeployer = createWalletClient({
  ...clientConfig,
  account: mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: 0 }),
})

export const keeperWallet = createWalletClient({
  ...clientConfig,
  account: mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: 10 }),
})

export const getUserWallet = (index: number) => {
  // up to 4 workers supported
  return createWalletClient({
    ...clientConfig,
    account: mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: index + 1 }),
  })
}

let anvilSignerIdx = 5
export function getAnvilSigner(offset = 0) {
  if (anvilSignerIdx === 1) {
    anvilSignerIdx += offset
  } else {
    anvilSignerIdx += 1
  }
  return createWalletClient({ ...clientConfig, account: mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: anvilSignerIdx }) })
}

