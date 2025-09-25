import { createTheme } from '@mui/material/styles';

const getTheme = (mode = 'light') => {
  const isLight = mode === 'light';
  
  return createTheme({
    palette: {
      mode,
      primary: {
        main: isLight ? '#1976d2' : '#90caf9',
        light: isLight ? '#42a5f5' : '#bbdefb',
        dark: isLight ? '#1565c0' : '#64b5f6',
        contrastText: isLight ? '#ffffff' : '#000000',
      },
      secondary: {
        main: isLight ? '#dc004e' : '#f48fb1',
        light: isLight ? '#e91e63' : '#f8bbd9',
        dark: isLight ? '#c51162' : '#f06292',
        contrastText: '#ffffff',
      },
      error: {
        main: isLight ? '#d32f2f' : '#f44336',
        light: isLight ? '#ef5350' : '#e57373',
        dark: isLight ? '#c62828' : '#d32f2f',
      },
      warning: {
        main: isLight ? '#ed6c02' : '#ff9800',
        light: isLight ? '#ff9800' : '#ffb74d',
        dark: isLight ? '#e65100' : '#f57c00',
      },
      info: {
        main: isLight ? '#0288d1' : '#29b6f6',
        light: isLight ? '#03a9f4' : '#4fc3f7',
        dark: isLight ? '#01579b' : '#0288d1',
      },
      success: {
        main: isLight ? '#2e7d32' : '#66bb6a',
        light: isLight ? '#4caf50' : '#81c784',
        dark: isLight ? '#1b5e20' : '#388e3c',
      },
      background: {
        default: isLight ? '#f5f5f5' : '#121212',
        paper: isLight ? '#ffffff' : '#1e1e1e',
      },
      text: {
        primary: isLight ? 'rgba(0, 0, 0, 0.87)' : '#ffffff',
        secondary: isLight ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.7)',
        disabled: isLight ? 'rgba(0, 0, 0, 0.38)' : 'rgba(255, 255, 255, 0.5)',
      },
      divider: isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)',
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontSize: '2.5rem',
        fontWeight: 600,
        lineHeight: 1.2,
      },
      h2: {
        fontSize: '2rem',
        fontWeight: 600,
        lineHeight: 1.3,
      },
      h3: {
        fontSize: '1.75rem',
        fontWeight: 600,
        lineHeight: 1.3,
      },
      h4: {
        fontSize: '1.5rem',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      h5: {
        fontSize: '1.25rem',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      h6: {
        fontSize: '1rem',
        fontWeight: 600,
        lineHeight: 1.5,
      },
      body1: {
        fontSize: '1rem',
        lineHeight: 1.6,
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.5,
      },
      button: {
        textTransform: 'none',
        fontWeight: 600,
      },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none',
            fontWeight: 600,
            boxShadow: 'none',
            '&:hover': {
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            },
          },
          contained: {
            '&:hover': {
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: isLight 
              ? '0 2px 12px rgba(0, 0, 0, 0.08)' 
              : '0 2px 12px rgba(0, 0, 0, 0.25)',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isLight ? '#ffffff' : '#1e1e1e',
            color: isLight ? 'rgba(0, 0, 0, 0.87)' : '#ffffff',
            boxShadow: isLight 
              ? '0 1px 3px rgba(0, 0, 0, 0.12)' 
              : '0 1px 3px rgba(0, 0, 0, 0.5)',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isLight ? '#ffffff' : '#1e1e1e',
            borderRight: `1px solid ${isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)'}`,
          },
        },
      },
    },
  });
};

export default getTheme;