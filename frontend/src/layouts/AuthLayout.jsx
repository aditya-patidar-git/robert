import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, ThemeProvider } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import getTheme from '../theme';

const AuthLayout = () => {
  const { theme } = useAuth();
  const muiTheme = getTheme(theme);

  return (
    <ThemeProvider theme={muiTheme}>
      <Box
        sx={{
          minHeight: '100vh',
          backgroundColor: 'background.default',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Outlet />
      </Box>
    </ThemeProvider>
  );
};

export default AuthLayout;