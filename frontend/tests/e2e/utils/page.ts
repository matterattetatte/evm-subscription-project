import { Page } from 'playwright/test'
import { Abi, Address, decodeErrorResult, decodeFunctionResult } from 'viem'
import { anvil } from 'viem/chains';

export const initScript = async (page: Page, index: number, address: Address) => {
  await page.evaluate(({ selectedAddress, chainId, rpc, anvilIndex }) => {
    const mockProvider = {
      isMetaMask: true,
      selectedAddress,
      request: async ({ method, params }: { method: string; params?: any[] }) => {
        if (['eth_requestAccounts', 'eth_accounts'].includes(method)) {
          return [selectedAddress];
        }
        if (method === 'eth_chainId') return chainId;
        const body = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method,
          params: params ?? [],
        });
        const res = await fetch(rpc, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error.message || 'RPC error');
        return json.result;
      },
      on: () => { },
      removeListener: () => { },
    };

    (window as any).ethereum = mockProvider;
    (window as any).originalEthereum = mockProvider;
    (window as any).__ANVIL_ACCOUNT_INDEX = anvilIndex;
  }, {
    selectedAddress: address,
    chainId: anvil.id,
    rpc: process.env.ANVIL_RPC || 'http://127.0.0.1:8545',
    anvilIndex: index
  });

  await page.waitForFunction(() => !!window.ethereum && !!window.ethereum.selectedAddress, {
    timeout: 15000,
  });
}

export const debugContractRequest = async (page: Page, abi: Abi, actionsFn: () => Promise<void>) => {
  const responsePromise = page.waitForResponse((res) => res.url().includes('http://127.0.0.1:8545') && res.request().method() === 'POST')

  await actionsFn()
  const rpcResponse = await responsePromise
  const rawBody = await rpcResponse.text()
  const parsed = JSON.parse(rawBody)

  console.log('parsed json response:', parsed)

  if (parsed.error) {
    // Decode revert reason from error.data
    if (parsed.error.data) {
      const error = decodeErrorResult({
        abi,
        data: parsed.error.data as `0x${string}`,
      })
      throw new Error(`Simulation reverted: ${String(error.args?.[0] || 'Unknown error')}`)
    }
    throw new Error(`RPC Error: ${parsed.error.message}`)
  }

  if (!parsed.result) {
    throw new Error('No result in RPC response')
  }

  // Decode successful return data
  const result = decodeFunctionResult({
    abi,
    data: parsed.result as `0x${string}`,
    functionName: 'deposit', // or whatever your functionName is
  })

  console.log('✅ Simulation result:', result)
  return {
    success: true,
    decodedResult: result,
    rawResult: parsed.result,
    raw: parsed,
  }
}

export const getWagmiError = async (page: Page) => {
  await page.waitForTimeout(1000) // Let useEffect run

  return await page.evaluate(() => {
    const error = (window as any).__wagmiError
    if (!error) throw new Error('No wagmi error exposed')
    return error
  })
}
