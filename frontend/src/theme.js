import { createTheme } from '@mui/material/styles';

const getTheme = (mode = 'light') => {
  const isLight = mode === 'light';
  
  return createTheme({
    palette: {
      mode,
      primary: {
        main: isLight ? '#0052CC' : '#4C9AFF',
        light: isLight ? '#2684FF' : '#85B8FF',
        dark: isLight ? '#003884' : '#2684FF',
        contrastText: '#ffffff',
      },
      secondary: {
        main: isLight ? '#5E6C84' : '#8993A4',
        light: isLight ? '#7A869A' : '#A5ADBA',
        dark: isLight ? '#42526E' : '#6B778C',
        contrastText: '#ffffff',
      },
      error: {
        main: isLight ? '#DE350B' : '#FF5630',
        light: isLight ? '#FF5630' : '#FF7452',
        dark: isLight ? '#BF2600' : '#DE350B',
      },
      warning: {
        main: isLight ? '#FF991F' : '#FFAB00',
        light: isLight ? '#FFAB00' : '#FFC400',
        dark: isLight ? '#FF8B00' : '#FF991F',
      },
      info: {
        main: isLight ? '#0052CC' : '#4C9AFF',
        light: isLight ? '#2684FF' : '#85B8FF',
        dark: isLight ? '#003884' : '#2684FF',
      },
      success: {
        main: isLight ? '#00875A' : '#36B37E',
        light: isLight ? '#36B37E' : '#57D9A3',
        dark: isLight ? '#006644' : '#00875A',
      },
      background: {
        default: isLight ? '#F4F5F7' : '#0D1117',
        paper: isLight ? '#FFFFFF' : '#161B22',
      },
      text: {
        primary: isLight ? '#172B4D' : '#F0F6FC',
        secondary: isLight ? '#5E6C84' : '#8B949E',
        disabled: isLight ? '#A5ADBA' : '#6E7681',
      },
      divider: isLight ? '#DFE1E6' : '#30363D',
    },
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
      h1: {
        fontSize: '2.25rem',
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: '-0.02em',
      },
      h2: {
        fontSize: '1.875rem',
        fontWeight: 700,
        lineHeight: 1.25,
        letterSpacing: '-0.01em',
      },
      h3: {
        fontSize: '1.5rem',
        fontWeight: 600,
        lineHeight: 1.3,
        letterSpacing: '-0.01em',
      },
      h4: {
        fontSize: '1.25rem',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      h5: {
        fontSize: '1.125rem',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      h6: {
        fontSize: '1rem',
        fontWeight: 600,
        lineHeight: 1.5,
      },
      body1: {
        fontSize: '0.9375rem',
        lineHeight: 1.6,
        letterSpacing: '0.01em',
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.5,
        letterSpacing: '0.01em',
      },
      button: {
        textTransform: 'none',
        fontWeight: 500,
        letterSpacing: '0.02em',
      },
      subtitle1: {
        fontSize: '0.9375rem',
        fontWeight: 500,
        lineHeight: 1.5,
      },
      subtitle2: {
        fontSize: '0.875rem',
        fontWeight: 500,
        lineHeight: 1.5,
      },
      caption: {
        fontSize: '0.75rem',
        lineHeight: 1.4,
        letterSpacing: '0.03em',
      },
      overline: {
        fontSize: '0.75rem',
        fontWeight: 600,
        lineHeight: 2,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
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
      MuiTypography: {
        styleOverrides: {
          root: {
            // Ensure typography inherits theme text color
            color: 'inherit',
          },
          h1: {
            color: isLight ? 'rgba(0, 0, 0, 0.87)' : '#ffffff',
          },
          h2: {
            color: isLight ? 'rgba(0, 0, 0, 0.87)' : '#ffffff',
          },
          h3: {
            color: isLight ? 'rgba(0, 0, 0, 0.87)' : '#ffffff',
          },
          h4: {
            color: isLight ? 'rgba(0, 0, 0, 0.87)' : '#ffffff',
          },
          h5: {
            color: isLight ? 'rgba(0, 0, 0, 0.87)' : '#ffffff',
          },
          h6: {
            color: isLight ? 'rgba(0, 0, 0, 0.87)' : '#ffffff',
          },
        },
      },
    },
  });
};

export default getTheme;