import React, { useState } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import artifact from '../../abis/SubscriptionService.sol/SubscriptionService.json';

const { abi: SubscriptionServiceAbi } = artifact;
const CONTRACT_ADDRESS = import.meta.env.VITE_SUBSCRIPTION_CONTRACT_ADDRESS as `0x${string}`;

const AdminDashboard: React.FC = () => {
  const [serviceId, setServiceId] = useState('');
  const [newFee, setNewFee] = useState('');
  const [createFee, setCreateFee] = useState('');
  const [createPeriod, setCreatePeriod] = useState('');

  const { mutate, data: hash, isPending } = useWriteContract();

  const { data: nextServiceId } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SubscriptionServiceAbi,
    functionName: 'nextServiceId',
  });

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

  const createService = () => {
    mutate({
      address: CONTRACT_ADDRESS,
      abi: SubscriptionServiceAbi,
      functionName: 'createService',
      args: [parseEther(createFee), BigInt(Number(createPeriod) * 24 * 60 * 60)],
    });
  };

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
      <h1>Admin Dashboard</h1>
      
      <div>
        <div>
          <h2>Create Service</h2>
          <input
            type="text"
            placeholder="Fee (ETH)"
            value={createFee}
            onChange={(e) => setCreateFee(e.target.value)}
            data-testid="create-fee-input"
          />
          <input
            type="text"
            placeholder="Period (days)"
            value={createPeriod}
            onChange={(e) => setCreatePeriod(e.target.value)}
            data-testid="create-period-input"
          />
          <button
            onClick={createService}
            disabled={isPending || !createFee || !createPeriod}
            data-testid="create-service-btn"
          >
            {isPending ? 'Creating...' : 'Create Service'}
          </button>
        </div>

        <div>
          <h2>Manage Service</h2>
          <input
            type="text"
            placeholder="Service ID"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            data-testid="service-id-input"
          />
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

      {nextServiceId && (
        <div>
          Next Service ID: {nextServiceId.toString()}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
