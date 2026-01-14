import type { AppKitNetwork } from '@reown/appkit/networks'
import { base, baseSepolia } from '@reown/appkit/networks'
import { createAppKit, useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { ApiController } from '@reown/appkit-controllers'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { http } from 'viem'
import { useConnect, useConnections, useConnectors, WagmiProvider } from 'wagmi'

import e2eMockConnector from '@/connectors/e2eMockConnector'

const isE2E = true

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      experimental_prefetchInRender: true,
      retry: false,
    },
  },
})

const projectId = import.meta.env.VITE_WC_PROJECT_ID || '3e6154a7158ff5f7509f24405fc3b551'

const metadata = {
  name: 'Your DeFi App',
  description: 'Liquidity pools on Base',
  url: 'https://yourapp.com',
  icons: ['https://yourapp.com/favicon.ico'],
}

const localForkRpc = import.meta.env.VITE_LOCAL_FORK_RPC || 'http://127.0.0.1:8545'

// In e2e, short-circuit AppKit remote fetches (wallet logos/config) to avoid noisy CORS errors.
if (isE2E && typeof window !== 'undefined') {
  const stub = (fn: string) => {
    console.info(`[APPKIT E2E] stubbed ${fn}`)
  }

  ApiController.fetchProjectConfig = async () => {
    stub('fetchProjectConfig')
    return []
  }
  ApiController.fetchUsage = async () => {
    stub('fetchUsage')
  }
  ApiController.fetchAllowedOrigins = async () => {
    stub('fetchAllowedOrigins')
    return []
  }
  ApiController.fetchNetworkImages = async () => {
    stub('fetchNetworkImages')
  }
  ApiController.fetchConnectorImages = async () => {
    stub('fetchConnectorImages')
  }
  ApiController.fetchWallets = async () => {
    stub('fetchWallets')
    return { data: [], count: 0, mobileFilteredOutWalletsLength: 0 }
  }
}

const networks: [AppKitNetwork, ...AppKitNetwork[]] = [base, baseSepolia]

const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  connectors: isE2E ? [e2eMockConnector] : [],
  transports: isE2E
    ? {
        [base.id]: http(localForkRpc), // Route Base traffic to the local fork in E2E
      }
    : undefined,
})

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,
  features: {
    analytics: !isE2E,
    allWallets: !isE2E,
    email: !isE2E,
    socials: isE2E ? [] : ['google', 'x', 'github', 'discord'],
  },
})

const useE2EAutoConnect = () => {
  const { connect } = useConnect()
  const connectors = useConnectors()
  const connections = useConnections()

  useEffect(() => {
    if (!isE2E) return
    // If already connected (e.g., restored), skip; only drive the e2e-mock connector.
    const mock = connectors.find((c) => c.id === 'e2e-mock' || c.id === 'mock')
    if (!mock) {
      console.error('[APPKIT E2E] mock connector missing — cannot auto connect')
      return
    }

    let cancelled = false
    const attempt = async () => {
      if (cancelled || connections.length > 0) return
      try {
        connect({ connector: mock, chainId: base.id })
        return
      } catch (err) {
        console.warn('[APPKIT E2E] connect attempt failed', err)
      }
    }

    attempt()
    const interval = setInterval(attempt, 300)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [connectors, connect, connections.length])

  return null
}

const E2EDiagnostics: React.FC = () => {
  useE2EAutoConnect()
  const { address, isConnected } = useAppKitAccount()
  const { chainId } = useAppKitNetwork()

  return (
    <div
      data-testid="wallet-state"
      data-connected={isConnected ? 'true' : 'false'}
      data-address={(address ?? '').toLowerCase()}
      data-chainid={chainId ?? ''}
      style={{ display: 'none' }}
    />
  )
}

const AppKitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <WagmiProvider config={wagmiAdapter.wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      {isE2E && <E2EDiagnostics />}
      {children}
    </QueryClientProvider>
  </WagmiProvider>
)

export default AppKitProvider
