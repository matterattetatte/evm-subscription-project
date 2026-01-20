import {
  type Address,
  BaseError,
  custom,
  type EIP1193RequestFn,
  fromHex,
  getAddress,
  type Hex,
  keccak256,
  numberToHex,
  RpcRequestError,
  stringToHex,
  SwitchChainError,
  type Transport,
  UserRejectedRequestError,
  type WalletCallReceipt,
  type WalletGetCallsStatusReturnType,
  type WalletRpcSchema,
} from 'viem'
import { anvil } from 'viem/chains'
import { rpc } from 'viem/utils'
import { ChainNotConfiguredError, createConnector } from 'wagmi'

export const isE2E = import.meta.env.MODE === 'e2e' 

;(window as any).__ANVIL_ACCOUNT_INDEX = 0;

const localForkRpc = import.meta.env.VITE_LOCAL_FORK_RPC || 'http://127.0.0.1:8545'

const ANVIL_ACCOUNTS: readonly Address[] = [
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
  '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
  '0x976EA74026E726554dB657fA547fA0D9d4E5d6D',
] as const

class ConnectorNotConnectedError extends BaseError {
  override name = 'ConnectorNotConnectedError'
  constructor() {
    super('Connector not connected.')
  }
}

export type MockParameters = {
  accounts: readonly [Address, ...Address[]]
  features?:
    | {
        defaultConnected?: boolean | undefined
        connectError?: boolean | Error | undefined
        switchChainError?: boolean | Error | undefined
        signMessageError?: boolean | Error | undefined
        signTypedDataError?: boolean | Error | undefined
        reconnect?: boolean | undefined
        watchAssetError?: boolean | Error | undefined
      }
    | undefined
}

const sleep = (ms = 1000) => new Promise((r) => setTimeout(r, ms))

async function getAssignedAccount(): Promise<Address> {
  const idx = (window as any).__ANVIL_ACCOUNT_INDEX
  if (typeof idx === 'number' && idx >= 0 && idx < ANVIL_ACCOUNTS.length) {
    return ANVIL_ACCOUNTS[idx]
  }

  if (isE2E) {
    await sleep()
    return getAssignedAccount()
  } else { 
    return ANVIL_ACCOUNTS[0]
  }
}

export default (() => {
  const parameters = { accounts: ANVIL_ACCOUNTS } as MockParameters
  const transactionCache = new Map<Hex, Hex[]>()
  const features = parameters.features ?? ({ defaultConnected: false } satisfies MockParameters['features'])

  type Provider = ReturnType<Transport<'custom', unknown, EIP1193RequestFn<WalletRpcSchema>>>
  type Properties = {
    connect: <T extends boolean = false>(parameters?: {
      chainId?: number
      withCapabilities?: T
    }) => Promise<{
      accounts: T extends true ? readonly { address: Address; capabilities: Record<string, unknown> }[] : readonly Address[]
      chainId: number
    }>
  }
  let connected = features.defaultConnected
  let connectedChainId: number

  return createConnector<Provider, Properties>((config) => ({
    id: 'mock',
    name: 'Mock Anvil Single Account per Context',
    type: 'mock',
    async setup() {
      connectedChainId = config.chains[0].id
    },
    async connect({ chainId, withCapabilities } = {}) {
      if (features.connectError) {
        if (typeof features.connectError === 'boolean') throw new UserRejectedRequestError(new Error('Failed to connect.'))
        throw features.connectError
      }

      const provider = await this.getProvider()
      const accounts = await provider.request({
        method: 'eth_requestAccounts',
      })

      let currentChainId = await this.getChainId()
      if (chainId && currentChainId !== chainId) {
        const chain = await this.switchChain!({ chainId })
        currentChainId = chain.id
      }

      connected = true

      return {
        accounts: withCapabilities
          ? accounts.map((x) => ({
              address: getAddress(x) as Address,
              capabilities: {} satisfies Record<string, unknown>,
            }))
          : accounts.map(getAddress),
        chainId: currentChainId,
      } as const
    },
    async disconnect() {
      connected = false
    },
    async getAccounts() {
      if (!connected) throw new ConnectorNotConnectedError()
      const provider = await this.getProvider()
      const accounts = await provider.request({ method: 'eth_accounts' })
      return accounts.map((x) => getAddress(x))
    },
    async getChainId() {
      const provider = await this.getProvider()
      const hexChainId = await provider.request({ method: 'eth_chainId' })
      return fromHex(hexChainId, 'number')
    },
    async isAuthorized() {
      if (!features.reconnect) return false
      if (!connected) return false
      const accounts = await this.getAccounts()
      return !!accounts.length
    },
    async switchChain({ chainId }) {
      const provider = await this.getProvider()
      const chain = config.chains.find((x) => x.id === chainId)
      if (!chain) throw new SwitchChainError(new ChainNotConfiguredError())

      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: numberToHex(chainId) }],
      })
      return chain
    },
    onAccountsChanged(accounts) {
      if (accounts.length === 0) this.onDisconnect()
      else
        config.emitter.emit('change', {
          accounts: accounts.map((x) => getAddress(x)),
        })
    },
    onChainChanged(chain) {
      const chainId = Number(chain)
      config.emitter.emit('change', { chainId })
    },
    async onDisconnect() {
      config.emitter.emit('disconnect')
      connected = false
    },
    async getProvider({ chainId } = {}) {
      const chain = config.chains.find((x) => x.id === chainId) ?? config.chains[0]
      const url = localForkRpc

      const request: EIP1193RequestFn = async ({ method, params }) => {
        if (method === 'eth_chainId') return numberToHex(connectedChainId)
        if (method === 'eth_requestAccounts') return [await getAssignedAccount()]
        if (method === 'eth_accounts') return [await getAssignedAccount()]

        if (method === 'eth_signTypedData_v4')
          if (features.signTypedDataError) {
            if (typeof features.signTypedDataError === 'boolean') throw new UserRejectedRequestError(new Error('Failed to sign typed data.'))
            throw features.signTypedDataError
          }

        if (method === 'wallet_switchEthereumChain') {
          if (features.switchChainError) {
            if (typeof features.switchChainError === 'boolean') throw new UserRejectedRequestError(new Error('Failed to switch chain.'))
            throw features.switchChainError
          }
          type Params = [{ chainId: Hex }]
          connectedChainId = fromHex((params as Params)[0].chainId, 'number')
          this.onChainChanged(connectedChainId.toString())
          return
        }

        if (method === 'wallet_watchAsset') {
          if (features.watchAssetError) {
            if (typeof features.watchAssetError === 'boolean') throw new UserRejectedRequestError(new Error('Failed to switch chain.'))
            throw features.watchAssetError
          }
          return connected
        }

        if (method === 'wallet_getCapabilities')
          return {
            [anvil.id]: {
              paymasterService: {
                supported: (params as [Hex])[0] === '0x95132632579b073D12a6673e18Ab05777a6B86f8',
              },
              sessionKeys: {
                supported: true,
              },
            },
            '0x14A34': {
              paymasterService: {
                supported: (params as [Hex])[0] === '0x95132632579b073D12a6673e18Ab05777a6B86f8',
              },
            },
          }

        if (method === 'wallet_sendCalls') {
          const hashes = []
          const calls = (params as any)[0].calls
          const from = (params as any)[0].from
          for (const call of calls) {
            const { result, error } = await rpc.http(url, {
              body: {
                method: 'eth_sendTransaction',
                params: [
                  {
                    ...call,
                    ...(typeof from !== 'undefined' ? { from } : {}),
                  },
                ],
              },
            })
            if (error)
              throw new RpcRequestError({
                body: { method, params },
                error,
                url,
              })
            hashes.push(result)
          }
          const id = keccak256(stringToHex(JSON.stringify(calls)))
          transactionCache.set(id, hashes)
          return { id }
        }

        if (method === 'wallet_getCallsStatus') {
          const hashes = transactionCache.get((params as any)[0])
          if (!hashes)
            return {
              atomic: false,
              chainId: '0x1',
              id: (params as any)[0],
              status: 100,
              receipts: [],
              version: '2.0.0',
            } satisfies WalletGetCallsStatusReturnType

          const receipts = await Promise.all(
            hashes.map(async (hash) => {
              const { result, error } = await rpc.http(url, {
                body: {
                  method: 'eth_getTransactionReceipt',
                  params: [hash],
                  id: 0,
                },
              })
              if (error)
                throw new RpcRequestError({
                  body: { method, params },
                  error,
                  url,
                })
              if (!result) return null
              return {
                blockHash: result.blockHash,
                blockNumber: result.blockNumber,
                gasUsed: result.gasUsed,
                logs: result.logs,
                status: result.status,
                transactionHash: result.transactionHash,
              } satisfies WalletCallReceipt
            })
          )
          const receipts_ = receipts.filter((x) => x !== null)
          if (receipts_.length === 0)
            return {
              atomic: false,
              chainId: '0x1',
              id: (params as any)[0],
              status: 100,
              receipts: [],
              version: '2.0.0',
            } satisfies WalletGetCallsStatusReturnType
          return {
            atomic: false,
            chainId: '0x1',
            id: (params as any)[0],
            status: 200,
            receipts: receipts_,
            version: '2.0.0',
          } satisfies WalletGetCallsStatusReturnType
        }

        if (method === 'wallet_showCallsStatus') return

        if (method === 'personal_sign') {
          if (features.signMessageError) {
            if (typeof features.signMessageError === 'boolean') throw new UserRejectedRequestError(new Error('Failed to sign message.'))
            throw features.signMessageError
          }
          method = 'eth_sign'
          type Params = [data: Hex, address: Address]
          params = [(params as Params)[1], (params as Params)[0]]
        }

        const body = { method, params }
        const { error, result } = await rpc.http(url, { body })
        if (error) throw new RpcRequestError({ body, error, url })

        return result
      }
      return custom({ request })({ retryCount: 0 })
    },
  }))
})()
