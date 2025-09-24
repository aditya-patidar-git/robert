import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import AdminLayout from '../layouts/AdminLayout';
import ProtectedRoute from '../components/ProtectedRoute';

// Public Pages
import Home from '../pages/Home';
import Mvp from '../pages/Mvp';

// Auth Pages
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';

// Protected Pages
import Dashboard from '../pages/Dashboard';
import ProfilePage from '../pages/ProfilePage';

// Placeholder components for future implementation
const UsersPage = () => (
  <div style={{ padding: '24px' }}>
    <h2>Users Management</h2>
    <p>User management functionality will be implemented here.</p>
  </div>
);

const AudioTelephonyPage = () => (
  <div style={{ padding: '24px' }}>
    <h2>Audio Telephony</h2>
    <p>Voice calling management functionality will be implemented here.</p>
  </div>
);

const SettingsPage = () => (
  <div style={{ padding: '24px' }}>
    <h2>System Settings</h2>
    <p>System configuration settings will be implemented here.</p>
  </div>
);

const AppRoutes = createBrowserRouter([
  // Public Routes
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/mvp',
    element: <Mvp />,
  },

  // Authentication Routes
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'register',
        element: <RegisterPage />,
      },
      {
        path: '',
        element: <Navigate to="/auth/login" replace />,
      },
    ],
  },

  // Protected Admin Routes
  {
    path: '/admin',
    element: (
      <ProtectedRoute>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: 'dashboard',
        element: <Dashboard />,
      },
      {
        path: 'users',
        element: (
          <ProtectedRoute requiredRoles={['owner', 'admin']}>
            <UsersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'audio-telephony',
        element: (
          <ProtectedRoute requiredRoles={['owner', 'admin']}>
            <AudioTelephonyPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute requiredRoles={['owner', 'admin']}>
            <SettingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '',
        element: <Navigate to="/admin/dashboard" replace />,
      },
    ],
  },

  // Profile Route (accessible to all authenticated users)
  {
    path: '/profile',
    element: (
      <ProtectedRoute>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: '',
        element: <ProfilePage />,
      },
    ],
  },

  // Legacy route redirects for backward compatibility
  {
    path: '/login',
    element: <Navigate to="/auth/login" replace />,
  },
  {
    path: '/register',
    element: <Navigate to="/auth/register" replace />,
  },
  {
    path: '/dashboard',
    element: <Navigate to="/admin/dashboard" replace />,
  },

  // Catch all route - redirect to home
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export default AppRoutes;