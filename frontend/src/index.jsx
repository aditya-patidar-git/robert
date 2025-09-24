import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import './index.css';
import App from './App';
import theme from './theme';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Create MUI theme from our custom theme
const muiTheme = createTheme({
  palette: {
    primary: {
      main: theme.colors.primary[500],
      light: theme.colors.primary[300],
      dark: theme.colors.primary[700],
    },
    secondary: {
      main: theme.colors.secondary[500],
      light: theme.colors.secondary[300],
      dark: theme.colors.secondary[700],
    },
    error: {
      main: theme.colors.status.error,
    },
    warning: {
      main: theme.colors.status.warning,
    },
    info: {
      main: theme.colors.status.info,
    },
    success: {
      main: theme.colors.status.success,
    },
  },
  typography: {
    fontFamily: theme.typography.fontFamily.sans.join(','),
    h1: {
      fontSize: theme.typography.fontSize['4xl'],
      fontWeight: theme.typography.fontWeight.bold,
    },
    h2: {
      fontSize: theme.typography.fontSize['3xl'],
      fontWeight: theme.typography.fontWeight.semibold,
    },
    h3: {
      fontSize: theme.typography.fontSize['2xl'],
      fontWeight: theme.typography.fontWeight.semibold,
    },
    body1: {
      fontSize: theme.typography.fontSize.base,
      lineHeight: theme.typography.lineHeight.normal,
    },
  },
  spacing: (factor) => `${theme.spacing[factor] || factor * 8}px`,
  shape: {
    borderRadius: theme.borderRadius.md,
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
