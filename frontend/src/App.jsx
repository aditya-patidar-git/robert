import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/common/ToastProvider';
import AppRoutes from './routes/AppRoutes';

function App() {
  return (
    <AuthProvider>
      <CssBaseline />
      <ToastProvider>
        <RouterProvider router={AppRoutes} />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;