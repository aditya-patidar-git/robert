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
      borderRadius: 6,
    },
    shadows: [
      'none',
      isLight ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
      isLight ? '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)' : '0 1px 3px 0 rgba(0, 0, 0, 0.5)',
      isLight ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)' : '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
      isLight ? '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)' : '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
      isLight ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' : '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
      ...Array(19).fill('none')
    ],
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarWidth: 'thin',
            scrollbarColor: isLight ? '#C1C7CD #F4F5F7' : '#30363D #0D1117',
            '&::-webkit-scrollbar': {
              width: '8px',
              height: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: isLight ? '#F4F5F7' : '#0D1117',
            },
            '&::-webkit-scrollbar-thumb': {
              background: isLight ? '#C1C7CD' : '#30363D',
              borderRadius: '4px',
              '&:hover': {
                background: isLight ? '#A5ADBA' : '#484F58',
              },
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            textTransform: 'none',
            fontWeight: 500,
            padding: '8px 16px',
            boxShadow: 'none',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              boxShadow: 'none',
              transform: 'translateY(-1px)',
            },
            '&:active': {
              transform: 'translateY(0)',
            },
          },
          contained: {
            '&:hover': {
              boxShadow: isLight 
                ? '0 4px 12px rgba(0, 82, 204, 0.2)' 
                : '0 4px 12px rgba(76, 154, 255, 0.3)',
            },
          },
          outlined: {
            borderWidth: '1.5px',
            '&:hover': {
              borderWidth: '1.5px',
              backgroundColor: isLight ? 'rgba(0, 82, 204, 0.04)' : 'rgba(76, 154, 255, 0.08)',
            },
          },
          text: {
            '&:hover': {
              backgroundColor: isLight ? 'rgba(0, 82, 204, 0.04)' : 'rgba(76, 154, 255, 0.08)',
            },
          },
          sizeLarge: {
            padding: '10px 22px',
            fontSize: '0.9375rem',
          },
          sizeSmall: {
            padding: '6px 12px',
            fontSize: '0.8125rem',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            border: `1px solid ${isLight ? '#DFE1E6' : '#30363D'}`,
            boxShadow: isLight 
              ? '0 1px 3px rgba(0, 0, 0, 0.04)' 
              : '0 1px 3px rgba(0, 0, 0, 0.5)',
            transition: 'box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              boxShadow: isLight 
                ? '0 4px 12px rgba(0, 0, 0, 0.08)' 
                : '0 4px 12px rgba(0, 0, 0, 0.6)',
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 6,
              backgroundColor: isLight ? '#FAFBFC' : '#0D1117',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              '& fieldset': {
                borderColor: isLight ? '#DFE1E6' : '#30363D',
                borderWidth: '1.5px',
              },
              '&:hover fieldset': {
                borderColor: isLight ? '#B3BAC5' : '#484F58',
              },
              '&.Mui-focused': {
                backgroundColor: isLight ? '#FFFFFF' : '#161B22',
                '& fieldset': {
                  borderWidth: '2px',
                },
              },
            },
            '& .MuiInputLabel-root': {
              fontSize: '0.875rem',
              fontWeight: 500,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${isLight ? '#DFE1E6' : '#30363D'}`,
          },
          elevation1: {
            boxShadow: isLight 
              ? '0 1px 3px rgba(0, 0, 0, 0.04)' 
              : '0 1px 3px rgba(0, 0, 0, 0.5)',
          },
          elevation2: {
            boxShadow: isLight 
              ? '0 4px 6px rgba(0, 0, 0, 0.06)' 
              : '0 4px 6px rgba(0, 0, 0, 0.5)',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isLight ? '#FFFFFF' : '#161B22',
            color: isLight ? '#172B4D' : '#F0F6FC',
            boxShadow: 'none',
            borderBottom: `1px solid ${isLight ? '#DFE1E6' : '#30363D'}`,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isLight ? '#FAFBFC' : '#0D1117',
            borderRight: `1px solid ${isLight ? '#DFE1E6' : '#30363D'}`,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            margin: '2px 8px',
            padding: '10px 12px',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              backgroundColor: isLight ? 'rgba(0, 82, 204, 0.08)' : 'rgba(76, 154, 255, 0.12)',
            },
            '&.Mui-selected': {
              backgroundColor: isLight ? '#0052CC' : '#1F6FEB',
              color: '#FFFFFF',
              fontWeight: 500,
              '&:hover': {
                backgroundColor: isLight ? '#003884' : '#1F6FEB',
              },
              '& .MuiListItemIcon-root': {
                color: '#FFFFFF',
              },
            },
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.875rem',
            minHeight: 48,
            padding: '12px 16px',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              color: isLight ? '#0052CC' : '#4C9AFF',
              backgroundColor: isLight ? 'rgba(0, 82, 204, 0.04)' : 'rgba(76, 154, 255, 0.08)',
            },
            '&.Mui-selected': {
              color: isLight ? '#0052CC' : '#4C9AFF',
              fontWeight: 600,
            },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${isLight ? '#DFE1E6' : '#30363D'}`,
          },
          indicator: {
            height: 3,
            borderRadius: '3px 3px 0 0',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            fontWeight: 500,
            fontSize: '0.8125rem',
          },
          filled: {
            backgroundColor: isLight ? '#DFE1E6' : '#30363D',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: isLight ? '#DFE1E6' : '#30363D',
          },
          head: {
            fontWeight: 600,
            fontSize: '0.8125rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: isLight ? '#5E6C84' : '#8B949E',
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:hover': {
              backgroundColor: isLight ? '#F4F5F7' : '#161B22',
            },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isLight ? '#172B4D' : '#F0F6FC',
            color: isLight ? '#FFFFFF' : '#0D1117',
            fontSize: '0.75rem',
            fontWeight: 500,
            padding: '6px 12px',
            borderRadius: 6,
            boxShadow: isLight 
              ? '0 4px 12px rgba(0, 0, 0, 0.15)' 
              : '0 4px 12px rgba(0, 0, 0, 0.8)',
          },
          arrow: {
            color: isLight ? '#172B4D' : '#F0F6FC',
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            border: `1px solid`,
            fontSize: '0.875rem',
          },
          standardSuccess: {
            backgroundColor: isLight ? '#E3FCEF' : '#0F2317',
            color: isLight ? '#006644' : '#57D9A3',
            borderColor: isLight ? '#ABF5D1' : '#1B4B2E',
          },
          standardError: {
            backgroundColor: isLight ? '#FFEBE6' : '#2D0D06',
            color: isLight ? '#BF2600' : '#FF7452',
            borderColor: isLight ? '#FFBDAD' : '#5C1A0D',
          },
          standardWarning: {
            backgroundColor: isLight ? '#FFF0B3' : '#2E2108',
            color: isLight ? '#FF8B00' : '#FFC400',
            borderColor: isLight ? '#FFE380' : '#5C4310',
          },
          standardInfo: {
            backgroundColor: isLight ? '#DEEBFF' : '#0D1F2F',
            color: isLight ? '#003884' : '#85B8FF',
            borderColor: isLight ? '#B3D4FF' : '#1F3E5E',
          },
        },
      },
      MuiTypography: {
        styleOverrides: {
          root: {
            color: 'inherit',
          },
          h1: {
            color: isLight ? '#172B4D' : '#F0F6FC',
          },
          h2: {
            color: isLight ? '#172B4D' : '#F0F6FC',
          },
          h3: {
            color: isLight ? '#172B4D' : '#F0F6FC',
          },
          h4: {
            color: isLight ? '#172B4D' : '#F0F6FC',
          },
          h5: {
            color: isLight ? '#172B4D' : '#F0F6FC',
          },
          h6: {
            color: isLight ? '#172B4D' : '#F0F6FC',
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: isLight ? '#DFE1E6' : '#30363D',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
            boxShadow: isLight 
              ? '0 20px 60px rgba(0, 0, 0, 0.2)' 
              : '0 20px 60px rgba(0, 0, 0, 0.8)',
          },
        },
      },
      MuiBackdrop: {
        styleOverrides: {
          root: {
            backgroundColor: isLight ? 'rgba(23, 43, 77, 0.4)' : 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
          },
        },
      },
    },
  });
};

export default getTheme;