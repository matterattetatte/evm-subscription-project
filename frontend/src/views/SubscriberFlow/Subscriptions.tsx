import React from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { abi as SubscriptionServiceAbi } from '../../abis/SubscriptionService.sol/SubscriptionService.json';

const CONTRACT_ADDRESS = (process.env.REACT_APP_SUBSCRIPTION_SERVICE_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`;

const Subscriptions: React.FC = () => {
  const { address } = useAccount();

  const { data: nextServiceId } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SubscriptionServiceAbi,
    functionName: 'nextServiceId',
  });

  if (!address) return <div>Please connect your wallet</div>;

  const serviceCount = nextServiceId ? Number(nextServiceId) - 1 : 0;

  return (
    <div>
      <h1>Available Subscription Services</h1>
      {serviceCount === 0 ? (
        <p>No services available</p>
      ) : (
        <ul>
          {Array.from({ length: serviceCount }, (_, i) => i + 1).map((serviceId) => (
            <li key={serviceId} data-service-id={serviceId} data-testid={`service-${serviceId}`}>
              Service #{serviceId}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Subscriptions;
