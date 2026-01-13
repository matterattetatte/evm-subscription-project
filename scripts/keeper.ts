import { createPublicClient, createWalletClient, http, parseEther, getContract } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { hardhat } from 'viem/chains'
import { config } from 'dotenv'
import { readFileSync } from 'fs'

config()

const ARTIFACT_PATH = './packages/contracts/shared???/artifacts/src/SubscriptionService.sol/SubscriptionService.json'
const RPC_URL = process.env.RPC_URL || 'http://localhost:8545'
const PRIVATE_KEY = process.env.PRIVATE_KEY!
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS as `0x${string}`

let SUBSCRIPTION_SERVICE_ABI: any

try {
  const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8'))
  SUBSCRIPTION_SERVICE_ABI = artifact.abi as any
} catch (error) {
  console.error('Failed to load artifact. Run `forge build` first.')
  process.exit(1)
}

async function main() {
  const publicClient = createPublicClient({
    chain: hardhat,
    transport: http(RPC_URL)
  })

  const account = privateKeyToAccount(`0x${PRIVATE_KEY.slice(2)}`)
  const walletClient = createWalletClient({
    account,
    chain: hardhat,
    transport: http(RPC_URL)
  })

  const contract = getContract({
    address: CONTRACT_ADDRESS,
    abi: SUBSCRIPTION_SERVICE_ABI,
    publicClient,
    walletClient
  })

  console.log('Keeper started...', {
    keeper: account.address,
    contract: CONTRACT_ADDRESS
  })

  while (true) {
    try {
      await runKeeperTasks(contract)
      console.log('Keeper cycle complete. Sleeping 30s...')
      await sleep(30000)
    } catch (error) {
      console.error('Keeper error:', error)
      await sleep(60000)
    }
  }
}

async function runKeeperTasks(contract: any) {
  const chainId = await contract.publicClient.getChainId()
  const maxServiceId = await contract.read.serviceIdCounter([chainId])
  
  console.log(`Scanning ${maxServiceId} services...`)
  
  for (let serviceId = 1n; serviceId <= maxServiceId; serviceId++) {
    try {
      await processService(contract, serviceId)
    } catch (error) {
      console.error(`Service ${serviceId} error:`, error)
    }
  }

  await trySweepFees(contract)
}

async function processService(contract: any, serviceId: number) {
  const result = await contract.read.getServiceStatusSnapshot([BigInt(serviceId)])
  const [subs, activeStatuses, remainingDays] = result as [string[], boolean[], bigint[]]
  
  if (subs.length === 0) return

  console.log(`Service ${serviceId}: ${subs.length} subscribers`)
  
  for (let i = 0; i < subs.length; i++) {
    const subscriber = subs[i]
    const active = activeStatuses[i]
    const daysLeft = Number(remainingDays[i])

    if (!active || daysLeft >= 14) continue

    const needsRenewal = true
    const lowBalance = false
    
    const hash = await contract.write.flagRenewalNeeded([
      BigInt(serviceId), 
      subscriber, 
      needsRenewal, 
      lowBalance
    ])
    
    console.log(`Flagged ${subscriber} on service ${serviceId} (${daysLeft} days left): ${hash}`)
    await contract.publicClient.waitForTransactionReceipt({ hash })
  }
}

async function trySweepFees(contract: any) {
  const balance = await contract.publicClient.getBalance({ address: CONTRACT_ADDRESS })
  const MIN_SWEEP_THRESHOLD = parseEther('0.016')
  
  if (balance >= MIN_SWEEP_THRESHOLD) {
    console.log(`Sweeping ${Number(balance) / 1e18} ETH`)
    
    const hash = await contract.write.sweepFees([])
    await contract.publicClient.waitForTransactionReceipt({ hash })
    console.log(`Sweep complete: ${hash}`)
  } else {
    console.log(`Balance ${Number(balance) / 1e18} ETH < threshold, skipping sweep`)
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(console.error)
