import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <div>
      <h1>🪙 Subscription Service</h1>
      <p>Manage Ethereum-based subscriptions</p>
      
      <div>
        <Link to="/subscribe">Start Subscription</Link>
        <Link to="/status">Check Status</Link>
      </div>

      <div>
        <h2>User Flow</h2>
        <Link to="/subscribe">Subscribe</Link>
        <Link to="/gift">Gift</Link>
        <Link to="/status">Status</Link>
      </div>

      <div>
        <h2>Admin Flow</h2>
        <Link to="/admin">Dashboard</Link>
      </div>

      <div>
        <h2>Quick Service Access</h2>
        <input placeholder="serviceId (e.g., 1)" />
        <div>
          <Link to="/subscribe/1">Subscribe #1</Link>
          <Link to="/status/1">Status #1</Link>
          <Link to="/admin/1">Admin #1</Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
