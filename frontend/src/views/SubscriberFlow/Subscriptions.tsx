import React from 'react';
import { useReadContract, useChainId } from 'wagmi';
import { useAppKitAccount } from '@reown/appkit/react';
import { abi as SubscriptionServiceAbi } from '../../abis/SubscriptionService.sol/SubscriptionService.json';

const CONTRACT_ADDRESS = (import.meta.env.VITE_SUBSCRIPTION_SERVICE_ADDRESS || '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512') as `0x${string}`;

const Subscriptions: React.FC = () => {
  const { isConnected } = useAppKitAccount();

  const { error, data } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SubscriptionServiceAbi,
    functionName: 'nextServiceId',
    query: {
      enabled: isConnected && CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000'
    },
  });

  if (error) {
    console.error('Contract read error:', error);
    return <div>Error loading services</div>;
  }

  return (
    <div>
      <h1>Available Subscription Services</h1>
      {data === 0n ? (
        <p>No services available</p>
      ) : (
        <ul>
          {Array.from({ length: Number(data) }, (_, i) => i + 1).map((serviceId) => (
            <li key={serviceId} data-service-id={serviceId} data-testid={`service-${serviceId}`}>
              Service #{serviceId}
              <button data-testid={`subscribe-btn-${serviceId}`}>Subscribe</button>
              <button data-testid={`extend-btn-${serviceId}`}>Extend</button>
              <button data-testid={`gift-btn-${serviceId}`}>Gift</button>
              <input data-testid={`periods-input-${serviceId}`} placeholder="Periods" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Subscriptions;