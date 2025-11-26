import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import AdminLayout from '../layouts/AdminLayout';
import ProtectedRoute from '../components/common/ProtectedRoute';

// Public Pages
import Mvp from '../pages/Mvp';

// Auth Pages
import LoginPage from '../pages/Auth/LoginPage';
import RegisterPage from '../pages/Auth/RegisterPage';
import ProfilePage from '../pages/Auth/ProfilePage';

// Protected Pages
import Dashboard from '../pages/Dashboard/index';
import UsersPage from '../pages/Users/index';
import AIKnowledgePage from '../pages/KB/index';
import AudioTelephonyPage from '../pages/AudioTelephony/index';
import TranscriptsComplaintsPage from '../pages/Transcripts/index';
import PrivacyPage from '../pages/Privacy/index';
import ObservabilityPage from '../pages/Observability/index';
import SystemConfigPage from '../pages/System/index';

const AppRoutes = createBrowserRouter([
  // Public Routes
  {
    path: '/',
    element: <LoginPage />,
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
          <ProtectedRoute requiredRoles={['owner']}>
            <UsersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'kb',
        element: (
          <ProtectedRoute requiredRoles={['owner', 'admin']}>
            <AIKnowledgePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'prompts',
        element: (
          <ProtectedRoute requiredRoles={['owner', 'admin']}>
            <AIKnowledgePage />
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
        path: 'transcripts',
        element: <TranscriptsComplaintsPage />,
      },
      {
        path: 'privacy',
        element: (
          <ProtectedRoute requiredRoles={['owner', 'admin']}>
            <PrivacyPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'observability',
        element: (
          <ProtectedRoute requiredRoles={['owner', 'admin']}>
            <ObservabilityPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'complaints',
        element: <TranscriptsComplaintsPage />,
      },
      {
        path: 'system',
        element: (
          <ProtectedRoute requiredRoles={['owner', 'admin']}>
            <SystemConfigPage />
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