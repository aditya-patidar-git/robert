import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, Typography, Paper, Button } from '@mui/material';
import { Lock, Home } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

const ProtectedRoute = ({ children, requiredRoles = [] }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Check if user has required role
  if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'background.default',
          p: 3
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 6,
            textAlign: 'center',
            maxWidth: 500,
            width: '100%'
          }}
        >
          <Lock sx={{ fontSize: 64, color: 'error.main', mb: 3 }} />
          <Typography variant="h4" gutterBottom color="error">
            Access Denied
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            You don't have permission to access this page. Please contact your administrator if you believe this is an error.
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Required role: {requiredRoles.join(' or ')}
            <br />
            Your role: {user.role}
          </Typography>
          <Button
            variant="contained"
            startIcon={<Home />}
            onClick={() => window.history.back()}
            sx={{ mt: 2 }}
          >
            Go Back
          </Button>
        </Paper>
      </Box>
    );
  }

  // Check if user account is blocked
  if (user.status === 'blocked') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'background.default',
          p: 3
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 6,
            textAlign: 'center',
            maxWidth: 500,
            width: '100%'
          }}
        >
          <Lock sx={{ fontSize: 64, color: 'error.main', mb: 3 }} />
          <Typography variant="h4" gutterBottom color="error">
            Account Blocked
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Your account has been blocked. Contact admin for assistance.
          </Typography>
          <Button
            variant="contained"
            onClick={() => window.location.href = '/auth/login'}
            sx={{ mt: 2 }}
          >
            Back to Login
          </Button>
        </Paper>
      </Box>
    );
  }

  // User is authenticated and authorized
  return children;
};

export default ProtectedRoute;