import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { abi as SubscriptionServiceAbi } from '../../abis/SubscriptionService.sol/SubscriptionService.json';
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSimulateContract,
} from 'wagmi';
import { useAppKitAccount } from '@reown/appkit/react';
import { Address, parseEther } from 'viem';

const CONTRACT_ADDRESS = import.meta.env.VITE_SUBSCRIPTION_SERVICE_ADDRESS as `0x${string}`;

if (!CONTRACT_ADDRESS) {
  throw new Error('Missing VITE_SUBSCRIPTION_SERVICE_ADDRESS in environment');
}

const SingleSubscription: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const serviceId = id ? BigInt(id) : BigInt(0);

  const { isConnected, address } = useAppKitAccount();
  const [isSubscribing, setIsSubscribing] = useState(false);

  const { data: serviceData, error: serviceError } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SubscriptionServiceAbi,
    functionName: 'services',
    args: [serviceId],
    query: { enabled: serviceId > 0n && isConnected },
  });

  const price = serviceData ? serviceData[0] : undefined;
  const duration = serviceData ? serviceData[1] : undefined;

  const { data: subscriptionData, refetch: refetchSubscribed } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SubscriptionServiceAbi,
    functionName: 'subscriptions',
    args: address && serviceId > 0n ? [serviceId, address] : undefined,
    query: { enabled: !!address && serviceId > 0n && isConnected },
  });

  const { data: endTime } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SubscriptionServiceAbi,
    functionName: 'getEndDate',
    args: address && serviceId > 0n ? [serviceId, address] : undefined,
    query: { enabled: !!subscriptionData && !!address && serviceId > 0n && isConnected },
  });

  const {
    data: preview,
    error: previewError,
    isPending: isSimulating = false,
  } = useSimulateContract({
    address: CONTRACT_ADDRESS,
    abi: SubscriptionServiceAbi,
    functionName: 'pay',
    args: [serviceId],
    value: price,
    account: address as Address,
  })

  if (previewError) {
    console.error('Simulation error:', previewError);
  }

  const {
    mutate,
    data: hash,
    error: writeError,
    isPending: isWritePending,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, error: receiptError } =
    useWaitForTransactionReceipt({ hash });

  const handleSubscribe = () => {
    if (!isConnected || !address || serviceId === 0n) return;

    setIsSubscribing(true);

    if (preview?.request) mutate(preview.request);
  };

  useEffect(() => {
    if (isSuccess || writeError || receiptError) {
      setIsSubscribing(false);
      if (isSuccess) {
        setTimeout(refetchSubscribed, 2000);
      }
    }
  }, [isSuccess, writeError, receiptError, refetchSubscribed]);

  if (!isConnected) {
    return <div>Please connect your wallet</div>;
  }

  if (serviceId === 0n || !id) {
    return <div>Invalid service ID</div>;
  }

  if (!serviceData) {
    return <div>Loading service details...</div>;
  }

  const error = writeError || receiptError;

  const formatEndTime = (ts?: bigint) =>
    ts && ts > 0n ? new Date(Number(ts) * 1000).toLocaleString() : 'Not subscribed';

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      <h1>Service #{id}</h1>

      <div style={{ marginBottom: '2rem' }}>
        <p><strong>Price:</strong> {price ? `${Number(price) / 1e18} ETH` : 'Loading...'}</p>
        <p><strong>Duration:</strong> {duration ? `${Number(duration) / (24*60*60)} days` : 'Loading...'}</p>
      </div>

      <div style={{ padding: '1.5rem', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '2rem' }}>
        <h3>Your Subscription</h3>
        <p>
          <strong>Status:</strong> {subscriptionData && subscriptionData[1] ? 'Active ✅' : 'Not subscribed'}
        </p>
        {subscriptionData && subscriptionData[1] && endTime && (
          <p><strong>Valid until:</strong> {formatEndTime(endTime)}</p>
        )}
      </div>

      {isSuccess && (
        <div style={{ color: 'green', margin: '1rem 0', fontWeight: 'bold' }}>
          Successfully subscribed!
        </div>
      )}

      <button
        data-testid={`subscribe-btn-${id}`}
        onClick={handleSubscribe}
        disabled={isSubscribing || isWritePending || isConfirming || (subscriptionData && subscriptionData[1])}
        style={{
          padding: '12px 32px',
          fontSize: '1.1rem',
          background: (subscriptionData && subscriptionData[1]) ? '#6c757d' : '#0d6efd',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: (subscriptionData && subscriptionData[1]) ? 'not-allowed' : 'pointer',
        }}
      >
        {isSubscribing || isWritePending || isConfirming
          ? 'Processing...'
          : (subscriptionData && subscriptionData[1])
          ? 'Already Subscribed'
          : 'Subscribe Now'}
      </button>

      {error && (
        <div style={{ color: 'red', marginTop: '1.5rem' }}>
          {error.shortMessage || error.message || 'Failed to subscribe'}
        </div>
      )}
    </div>
  );
};

export default SingleSubscription;