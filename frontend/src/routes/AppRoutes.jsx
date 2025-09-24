import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import AdminLayout from '../layouts/AdminLayout';
import Home from '../pages/Home';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import Mvp from '../pages/Mvp';

// Import other pages as needed
// import Users from '../pages/Users';
// import AudioTelephony from '../pages/AudioTelephony';
// import Settings from '../pages/Settings';

const AppRoutes = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/mvp',
    element: <Mvp />,
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      {
        path: 'login',
        element: <Login />,
      },
      {
        path: '',
        element: <Navigate to="/auth/login" replace />,
      },
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      {
        path: 'dashboard',
        element: <Dashboard />,
      },
      {
        path: 'users',
        element: <div>Users Page - To be implemented</div>,
      },
      {
        path: 'audio-telephony',
        element: <div>Audio Telephony Page - To be implemented</div>,
      },
      {
        path: 'settings',
        element: <div>Settings Page - To be implemented</div>,
      },
      {
        path: '',
        element: <Navigate to="/admin/dashboard" replace />,
      },
    ],
  },
  // Redirect old routes to new structure
  {
    path: '/login',
    element: <Navigate to="/auth/login" replace />,
  },
  {
    path: '/dashboard',
    element: <Navigate to="/admin/dashboard" replace />,
  },
  // Catch all route
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export default AppRoutes;
