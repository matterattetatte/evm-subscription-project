import React from 'react';
import { BrowserRouter, Routes, Route, Link, Outlet } from 'react-router-dom';
import './App.css';

const Home = React.lazy(() => import('./views/Home'));
const AdminDashboard = React.lazy(() => import('./views/AdminFlow/AdminDashboard'));
const AdminSubscriptionHandling = React.lazy(() => import('./views/AdminFlow/AdminSubscriptionHandling'));
const SingleSubscription = React.lazy(() => import('./views/SubscriberFlow/SingleSubscription'));
const Subscriptions = React.lazy(() => import('./views/SubscriberFlow/Subscriptions'));

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/subscriptions/:id" element={<AdminSubscriptionHandling />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/subscriptions/:id" element={<SingleSubscription />} />
        <Route path="*" element={<div>404</div>} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
