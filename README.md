# evm-subscription-project

## High-Level User Flow

### Subscriber Flow

```mermaid
flowchart TD
    A["Find a subscription service (serviceId)"] --> B{"Want to subscribe?"}

    B -->|Yes| C["Send ETH via pay(serviceId) or extend(serviceId)"]
    C --> D["Contract receives payment updates your expiration timestamp"]

    D --> E["You now have an active subscription until end date = now + periodLength"]

    B -->|No, but want to gift| F["Send ETH via gift(serviceId, recipient address)"]
    F --> G["Contract credits the recipient updates recipient's expiration"]

    E --> H["You can check status anytime"]
    H --> I["isActive(serviceId, my address) → true/false"]
    H --> J["getEndDate(serviceId, my address) → date"]

    style A fill:#90caf9,stroke:#42a5f5,color:#0d47a1
    style E fill:#66bb6a,stroke:#388e3c,color:#1b5e20
    style G fill:#66bb6a,stroke:#388e3c,color:#1b5e20
    style I fill:#ffb74d,stroke:#f57c00,color:#5d2f00
    style J fill:#ffb74d,stroke:#f57c00,color:#5d2f00
```

### Admin Flow

```mermaid
flowchart TD
    A["You are the owner of a subscription service (serviceId)"] --> B{"What do you want to manage?"}

    B -->|Change price| C["Call changeFee(serviceId, newFee)"]
    C --> D["New fee applies to future payments/renewals"]

    B -->|Pause the service| E["Call pause(serviceId)"]
    E --> F["Service is now paused - New payments & gifts are blocked - Existing subscriptions remain active until expiry"]

    B -->|Resume the service| G["Call resume(serviceId)"]
    G --> H["Service is active again - Payments & gifts allowed"]

    B -->|Withdraw collected earnings| I["Call withdrawEarnings(serviceId)"]
    I --> J["ETH is sent to your wallet Earnings balance reset to 0 for this service"]

    B -->|Check your earnings| K["(View earnings balance via public getter or logs)"]

    style A fill:#90caf9,stroke:#42a5f5,color:#0d47a1
    style D fill:#66bb6a,stroke:#388e3c,color:#1b5e20
    style F fill:#ef5350,stroke:#c62828,color:#ffffff
    style H fill:#66bb6a,stroke:#388e3c,color:#1b5e20
    style J fill:#66bb6a,stroke:#388e3c,color:#1b5e20
    style K fill:#ffb74d,stroke:#f57c00,color:#5d2f00

    classDef paused fill:#ef5350,stroke:#c62828
```

### Bot/Keeper Flow

```mermaid
flowchart TD
    A["Start Bot Process (External Off-Chain Cron / Keeper)"] --> B["Query Contract for All Service IDs (using nextServiceId - 1)"]

    B --> C{"For Each Service ID"}

    C -->|Loop| D["Call view: getServiceStatusSnapshot(serviceId)"]

    D --> E{"Service paused? (empty list / flag)"}

    E -->|Yes → skip| F["Log: Paused - skipping"]

    E -->|No| G["For Each Subscriber in list"]

    G -->|Loop| H{"isActive == false? (oracle time used)"}

    H -->|Yes| I["Log: Already expired (no write)"]

    H -->|No| J{"daysRemaining ≤ threshold? (e.g. ≤ 7 days)"}

    J -->|No| K["Log: Safe (no action)"]

    J -->|Yes| L["Check ETH balance web3.eth.getBalance(subscriber)"]

    L --> M{"Balance ≥ minRenewalCost? (e.g. 0.05 ETH)"}

    M -->|Yes| N["Call: flagRenewalNeeded(serviceId, subscriber, true)"]

    M -->|No| O["Call: flagRenewalNeeded(…, true) + set lowBalanceWarning = true"]

    N --> P["Log: Flag SET (balance OK)"]

    O --> Q["Log: Flag SET + low balance"]

    I --> R["Log entry"]
    K --> R
    P --> R
    Q --> R

    R --> G

    G -->|End subscribers| C

    C -->|End all services| T["After processing: Query contract total withdrawable fees (getCollectedFees() / pendingWithdrawals(admin))"]

    T --> U{"withdrawable ETH ≥ ~50 USD? (current ≈ 0.015-0.016 ETH at ~$3,100-$3,200)"}

    U -->|No| V["Log: Collected fees below threshold (keep accumulating)"]

    U -->|Yes| W["Call contract: sweepFees() / withdrawToAdmin() (sends ETH to admin/treasury)"]

    W --> X["Log: Fees swept to admin (amount: XXX ETH ≈ $YYY)"]

    V --> S
    X --> S["End Bot Cycle (Next run in 1-4 hours)"]


    style A fill:#1976d2,stroke:#1565c0,stroke-width:2px,color:#ffffff,font-weight:bold
    style S fill:#2e7d32,stroke:#1b5e20,stroke-width:2px,color:#ffffff,font-weight:bold

    style N fill:#388e3c,stroke:#2e7d32,color:#ffffff,font-weight:bold
    style O fill:#f57c00,stroke:#ef6c00,color:#ffffff,font-weight:bold

    style I fill:#d32f2f,stroke:#b71c1c,color:#ffffff,font-weight:bold
    style F fill:#757575,stroke:#616161,color:#ffffff

    style J fill:#0288d1,stroke:#0277bd,color:#ffffff
    style M fill:#0288d1,stroke:#0277bd,color:#ffffff

    style U fill:#0288d1,stroke:#0277bd,color:#ffffff

    style H fill:#455a64,stroke:#37474f,color:#ffffff
    style E fill:#455a64,stroke:#37474f,color:#ffffff

    style P fill:#81c784,stroke:#66bb6a,color:#000000
    style Q fill:#ffab91,stroke:#ff8a65,color:#000000
    style K fill:#ce93d8,stroke:#ab47bc,color:#000000
    style R fill:#eceff1,stroke:#b0bec5,color:#263238

    style W fill:#7b1fa2,stroke:#6a1b9a,color:#ffffff,font-weight:bold
    

    style X fill:#ba68c8,stroke:#9c27b0,color:#000000
    

    style V fill:#b0bec5,stroke:#90a4ae,color:#000000
    

    style T fill:#546e7a,stroke:#455a64,color:#ffffff
```    


## Gas Optimizations

**1. Custom Errors**

Replaced string require messages with custom errors (ServiceDoesNotExist(), ServicePaused(), etc.).
Helps for keeper function sweepFees() called frequently.

**2. Bulk Payment Support (Gas + UX Optimization)**


Modified `_subscribe()` to accept multiples of base fee (_value % service.fee == 0).
Users pay for 10 periods in 1 tx instead of 10 separate txs
Saves gas for each avoided transaction.

**3. Single FeesSwept Event (Gas Optimization)**


`sweepFees()` emits 1 `FeesSwept(totalSwept)` instead of N `EarningsWithdrawn()` events as it was first
Saves gas per N services
Less logging
Still the important part that gets emitted.

