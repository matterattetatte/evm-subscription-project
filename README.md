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


