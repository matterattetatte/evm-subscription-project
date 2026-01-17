import React, { useEffect, useState } from 'react';
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import artifact from '../../abis/SubscriptionService.sol/SubscriptionService.json';
import { Link } from 'react-router-dom';

const { abi: SubscriptionServiceAbi } = artifact;
const CONTRACT_ADDRESS = import.meta.env.VITE_SUBSCRIPTION_SERVICE_ADDRESS as `0x${string}`;

const AdminDashboard: React.FC = () => {
  const [createFee, setCreateFee] = useState('');
  const [createPeriod, setCreatePeriod] = useState('');

  const { mutate, error, data: hash, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({ hash });

  const { data: nextServiceId, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SubscriptionServiceAbi,
    functionName: 'nextServiceId',
  });

  const createService = () => {
    mutate({
      address: CONTRACT_ADDRESS,
      abi: SubscriptionServiceAbi,
      functionName: 'createService',
      args: [parseEther(createFee), BigInt(Number(createPeriod) * 24 * 60 * 60)],
    });
  };

  useEffect(() => {
    if (isSuccess) {
      refetch();
      setCreateFee('');
      setCreatePeriod('');
    }
  }, [isSuccess, refetch]);

  const serviceIds = nextServiceId ? Array.from({ length: Number(nextServiceId) - 1 }, (_, i) => i + 1) : [];

  useEffect(() => {
    if (error) {
      console.error('Error creating service:', error);
    }
  }, [error]);

  return (
    <div>
      <h1>Admin Dashboard</h1>
      
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
        <h2>Services</h2>
        {serviceIds.map(id => (
          <Link key={id} data-testid={`service-${id}`} to={`/admin/services/${id}`}>
            Service ID: {id}
          </Link>
        ))}
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