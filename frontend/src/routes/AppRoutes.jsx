import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import AdminLayout from '../layouts/AdminLayout';
import ProtectedRoute from '../components/common/ProtectedRoute';

// Public Pages
import Home from '../pages/Home';
import Mvp from '../pages/Mvp';

// Auth Pages
import LoginPage from '../pages/Auth/LoginPage';
import RegisterPage from '../pages/Auth/RegisterPage';
import ProfilePage from '../pages/Auth/ProfilePage';

// Protected Pages
import Dashboard from '../pages/Dashboard';

// Placeholder components for future implementation
const UsersPage = () => (
  <div style={{ padding: '24px' }}>
    <h2>Users Management</h2>
    <p>User management functionality will be implemented here.</p>
  </div>
);

const KBPage = () => (
  <div style={{ padding: '24px' }}>
    <h2>Knowledge Base</h2>
    <p>Knowledge base management functionality will be implemented here.</p>
  </div>
);

const PromptsPage = () => (
  <div style={{ padding: '24px' }}>
    <h2>Prompts Management</h2>
    <p>AI prompt management functionality will be implemented here.</p>
  </div>
);

const AudioTelephonyPage = () => (
  <div style={{ padding: '24px' }}>
    <h2>Audio Telephony</h2>
    <p>Voice calling management functionality will be implemented here.</p>
  </div>
);

const CRMPage = () => (
  <div style={{ padding: '24px' }}>
    <h2>CRM</h2>
    <p>Customer relationship management functionality will be implemented here.</p>
  </div>
);

const TranscriptsPage = () => (
  <div style={{ padding: '24px' }}>
    <h2>Transcripts</h2>
    <p>Call transcript management functionality will be implemented here.</p>
  </div>
);

const PrivacyPage = () => (
  <div style={{ padding: '24px' }}>
    <h2>Privacy & DSAR</h2>
    <p>Data privacy and DSAR management functionality will be implemented here.</p>
  </div>
);

const ObservabilityPage = () => (
  <div style={{ padding: '24px' }}>
    <h2>Observability</h2>
    <p>System monitoring and observability functionality will be implemented here.</p>
  </div>
);

const ComplaintsPage = () => (
  <div style={{ padding: '24px' }}>
    <h2>Complaints & Escalations</h2>
    <p>Customer complaints and escalation management functionality will be implemented here.</p>
  </div>
);

const SystemPage = () => (
  <div style={{ padding: '24px' }}>
    <h2>System Management</h2>
    <p>MCP tools, models, and system configuration functionality will be implemented here.</p>
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
        path: 'kb',
        element: (
          <ProtectedRoute requiredRoles={['owner', 'admin']}>
            <KBPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'prompts',
        element: (
          <ProtectedRoute requiredRoles={['owner', 'admin']}>
            <PromptsPage />
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
        path: 'crm',
        element: <CRMPage />,
      },
      {
        path: 'transcripts',
        element: <TranscriptsPage />,
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
        element: <ComplaintsPage />,
      },
      {
        path: 'system',
        element: (
          <ProtectedRoute requiredRoles={['owner', 'admin']}>
            <SystemPage />
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