import React, { useState, useEffect } from 'react';
import './App.css';

declare global {
  interface Window {
    ethereum?: any;
  }
}

function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        setError('MetaMask not installed');
        return;
      }
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setAccount(accounts[0]);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Connection failed');
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setError(null);
  };

  return (
    <div className="App">
      <header className="App-header">
        {!account ? (
          <button onClick={connectWallet}>Connect MetaMask</button>
        ) : (
          <>
            <div className="bg-green-100">{account}</div>
            <button className="bg-red-500" onClick={disconnectWallet}>Disconnect</button>
          </>
        )}
        {error && <div className="bg-red-500">{error}</div>}
      </header>
    </div>
  );
}

export default App;
