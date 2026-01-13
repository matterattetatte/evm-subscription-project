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

