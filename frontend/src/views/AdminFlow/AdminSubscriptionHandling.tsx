import React, { useEffect, useState } from 'react';
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import artifact from '../../abis/SubscriptionService.sol/SubscriptionService.json';
import { useParams } from 'react-router-dom';

const { abi: SubscriptionServiceAbi } = artifact;
const CONTRACT_ADDRESS = import.meta.env.VITE_SUBSCRIPTION_SERVICE_ADDRESS as `0x${string}`;

const AdminSubscriptionHandling: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const serviceId = id ? BigInt(id) : BigInt(0);
  const [newFee, setNewFee] = useState('');

  const { mutate, data: hash, isPending } = useWriteContract();

  const { data: receiptData, error: receiptError } = useWaitForTransactionReceipt({ hash });

  console.log('data:', receiptData, 'error', receiptError)

  const { data: serviceData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SubscriptionServiceAbi,
    functionName: 'services',
    args: serviceId ? [BigInt(serviceId)] : undefined,
  });

  const { data: earnings } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SubscriptionServiceAbi,
    functionName: 'getCollectedEarnings',
    args: serviceId ? [BigInt(serviceId)] : undefined,
  });

  const changeFee = () => {
    mutate({
      address: CONTRACT_ADDRESS,
      abi: SubscriptionServiceAbi,
      functionName: 'changeFee',
      args: [BigInt(serviceId), parseEther(newFee)],
    });
  };

  const pauseService = () => {
    mutate({
      address: CONTRACT_ADDRESS,
      abi: SubscriptionServiceAbi,
      functionName: 'pause',
      args: [BigInt(serviceId)],
    });
  };

  const resumeService = () => {
    mutate({
      address: CONTRACT_ADDRESS,
      abi: SubscriptionServiceAbi,
      functionName: 'resume',
      args: [BigInt(serviceId)],
    });
  };

  const withdrawEarnings = () => {
    mutate({
      address: CONTRACT_ADDRESS,
      abi: SubscriptionServiceAbi,
      functionName: 'withdrawEarnings',
      args: [BigInt(serviceId)],
    });
  };

  return (
    <div>
      <h1>Admin Subscription Handling</h1>
      
      <div>
        <h2>Manage Service</h2>
        {serviceData && (
          <div>
            <p>Fee: {formatEther(serviceData[0])} ETH</p>
            <p>Period: {Number(serviceData[1]) / (24 * 60 * 60)} days</p>
            <p>Status: {serviceData[4] ? 'Paused' : 'Active'}</p>
            <p>Earnings: {earnings ? formatEther(earnings) : '0'} ETH</p>
          </div>
        )}
      </div>

      <div>
        <h2>Change Fee</h2>
        <input
          type="text"
          placeholder="New Fee (ETH)"
          value={newFee}
          onChange={(e) => setNewFee(e.target.value)}
          data-testid="new-fee-input"
        />
        <button
          onClick={changeFee}
          disabled={isPending || !serviceId || !newFee}
          data-testid="change-fee-btn"
        >
          {isPending ? 'Updating...' : 'Change Fee'}
        </button>
      </div>

      <div>
        <h2>Service Controls</h2>
        <button
          onClick={pauseService}
          disabled={isPending || !serviceId}
          data-testid="pause-service-btn"
        >
          {isPending ? 'Pausing...' : 'Pause Service'}
        </button>
        <button
          onClick={resumeService}
          disabled={isPending || !serviceId}
          data-testid="resume-service-btn"
        >
          {isPending ? 'Resuming...' : 'Resume Service'}
        </button>
        <button
          onClick={withdrawEarnings}
          disabled={isPending || !serviceId}
          data-testid="withdraw-earnings-btn"
        >
          {isPending ? 'Withdrawing...' : 'Withdraw Earnings'}
        </button>
      </div>
    </div>
  );
};

export default AdminSubscriptionHandling;