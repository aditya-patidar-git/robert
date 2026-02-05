import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, ThemeProvider } from '@mui/material';
import getTheme from '../theme';

const AuthLayout = () => {
  const muiTheme = getTheme('light');

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