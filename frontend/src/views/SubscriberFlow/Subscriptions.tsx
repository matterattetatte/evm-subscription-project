import { Link } from 'react-router-dom';
import { useConnection, useReadContract } from 'wagmi';
import { abi as SubscriptionServiceAbi } from '@/abis/SubscriptionService.sol/SubscriptionService.json';
import { zeroAddress } from 'viem';
import React from 'react';

const Subscriptions: React.FC = () => {
  const { address } = useConnection();

  const { data, isLoading, isError } = useReadContract({
    address: zeroAddress,
    abi: SubscriptionServiceAbi,
    functionName: 'userSubscriptions',
    args: [address!],
  });

  if (!address) return <div>Please connect your wallet</div>;
  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Error fetching subscriptions</div>;

  return (
    <div>
      <h1>Subscriptions</h1>
      <ul>
        {data?.map((id: bigint) => (
          <li key={id.toString()}>
            <Link to={`/subscriptions/${id.toString()}`}>
              Service ID: {id.toString()}
            </Link>
            </li>
        ))}
      </ul>
    </div>
  );
};

export default Subscriptions;
