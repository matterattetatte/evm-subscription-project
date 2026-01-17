import React from 'react';
import { useReadContract, useChainId } from 'wagmi';
import { useAppKitAccount } from '@reown/appkit/react';
import { abi as SubscriptionServiceAbi } from '../../abis/SubscriptionService.sol/SubscriptionService.json';
import { Link } from 'react-router-dom';

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
            <Link key={serviceId} data-testid={`service-${serviceId}`} to={`/subscriptions/${serviceId}`}>
              <li>
                Service #{serviceId}
              </li>
            </Link>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Subscriptions;