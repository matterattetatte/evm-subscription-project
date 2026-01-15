import React from 'react';
import { BrowserRouter, Routes, Route, Link, Outlet } from 'react-router-dom';
import './App.css';

const Home = React.lazy(() => import('./views/Home'));
const AdminDashboard = React.lazy(() => import('./views/AdminFlow/AdminDashboard'));
const SingleSubscription = React.lazy(() => import('./views/SubsriberFlow/SingleSubscription'));
const Subscriptions = React.lazy(() => import('./views/SubsriberFlow/Subscriptions'));

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<div>404</div>} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
