import React from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import AdminLayout from '../layouts/AdminLayout';
import ProtectedRoute from '../components/common/ProtectedRoute';
import { AuthProvider } from '../context/AuthContext';

import LoginPage from '../pages/Auth/LoginPage';
import RegisterPage from '../pages/Auth/RegisterPage';
import ProfilePage from '../pages/Auth/ProfilePage';
import Dashboard from '../pages/Dashboard/index';
import UsersPage from '../pages/Users/index';
import AIKnowledgePage from '../pages/KB/index';
import AudioTelephonyPage from '../pages/AudioTelephony/index';
import TranscriptsComplaintsPage from '../pages/Transcripts/index';
import PrivacyPage from '../pages/Privacy/index';
import ObservabilityPage from '../pages/Observability/index';
import SystemConfigPage from '../pages/System/index';

const AppRoutes = createBrowserRouter([
  {
    path: '/',
    element: (
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    ),
    children: [
      {
        path: '',
        element: <AuthLayout />,
        children: [{ path: '', element: <LoginPage /> }],
      },
      {
        path: 'auth',
        element: <AuthLayout />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
          { path: '', element: <Navigate to="/auth/login" replace /> },
        ],
      },
      {
        path: 'admin',
        element: (
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        ),
        children: [
          { path: 'dashboard', element: <Dashboard /> },
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
          { path: 'transcripts', element: <TranscriptsComplaintsPage /> },
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
          { path: 'complaints', element: <TranscriptsComplaintsPage /> },
          {
            path: 'system',
            element: (
              <ProtectedRoute requiredRoles={['owner', 'admin']}>
                <SystemConfigPage />
              </ProtectedRoute>
            ),
          },
          { path: '', element: <Navigate to="/admin/dashboard" replace /> },
        ],
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        ),
        children: [{ path: '', element: <ProfilePage /> }],
      },
      { path: 'login', element: <Navigate to="/auth/login" replace /> },
      { path: 'register', element: <Navigate to="/auth/register" replace /> },
      { path: 'dashboard', element: <Navigate to="/admin/dashboard" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export default AppRoutes;