import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
  ThemeProvider,
  Badge,
  Tooltip
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  People,
  Phone,
  Settings,
  Logout,
  AccountCircle,
  Person,
  Brightness4,
  Brightness7,
  MenuBook,
  Psychology,
  Headset,
  Business,
  Description,
  PrivacyTip,
  Visibility,
  ReportProblem,
  Computer
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/common/ToastProvider';
import getTheme from '../theme';

const drawerWidth = 240;

const AdminLayout = () => {
  const { user, logout, theme, toggleTheme } = useAuth();
  const { showSuccess } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const muiTheme = getTheme(theme);
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const menuItems = [
    {
      text: 'Dashboard',
      icon: <Dashboard />,
      path: '/admin/dashboard',
      roles: ['owner', 'admin']
    },
    {
      text: 'Users',
      icon: <People />,
      path: '/admin/users',
      roles: ['owner']
    },
    {
      text: 'Knowledge Base',
      icon: <MenuBook />,
      path: '/admin/kb',
      roles: ['owner', 'admin']
    },
    {
      text: 'Audio & Telephony',
      icon: <Phone />,
      path: '/admin/audio-telephony',
      roles: ['owner', 'admin']
    },
    {
      text: 'Transcripts',
      icon: <Description />,
      path: '/admin/transcripts',
      roles: ['owner', 'admin']
    },
    {
      text: 'Compliance',
      icon: <PrivacyTip />,
      path: '/admin/privacy',
      roles: ['owner', 'admin']
    },
    {
      text: 'Observability',
      icon: <Visibility />,
      path: '/admin/observability',
      roles: ['owner', 'admin']
    },
    {
      text: 'Configuration',
      icon: <Computer />,
      path: '/admin/system',
      roles: ['owner', 'admin']
    },
    // { 
    //   text: 'CRM Integration', 
    //   icon: <Business />, 
    //   path: '/admin/crm',
    //   roles: ['owner', 'admin'] 
    // }
  ];

  // Filter menu items based on user role
  const filteredMenuItems = menuItems.filter(item =>
    item.roles.includes(user?.role)
  );

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      showSuccess('Successfully logged out');
      navigate('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
    handleProfileMenuClose();
  };

  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const handleProfileClick = () => {
    navigate('/profile');
    handleProfileMenuClose();
  };

  const getCurrentPageTitle = () => {
    const currentItem = filteredMenuItems.find(item =>
      location.pathname.startsWith(item.path)
    );
    return currentItem?.text || 'Robert Admin';
  };

  const drawer = (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: 'background.paper'
    }}>
      {/* Logo Section */}
      <Box sx={{ px: 3, py: 3 }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1.5,
        }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              backgroundColor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0, 82, 204, 0.2)',
            }}
          >
            <Phone sx={{ color: 'white', fontSize: 24 }} />
          </Box>
          <Box>
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 700,
                fontSize: '1.125rem',
                lineHeight: 1.2,
                color: 'text.primary'
              }}
            >
              Robert
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'text.secondary',
                fontSize: '0.75rem',
                fontWeight: 500
              }}
            >
              AI Admin Portal
            </Typography>
          </Box>
        </Box>
      </Box>

      <Divider />

      {/* Navigation */}
      <Box sx={{ flex: 1, overflowY: 'auto', py: 2 }}>
        <List sx={{ px: 1 }}>
          {filteredMenuItems.map((item) => {
            const isSelected = location.pathname.startsWith(item.path);
            return (
              <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  selected={isSelected}
                  onClick={() => handleNavigation(item.path)}
                  sx={{
                    borderRadius: 1.5,
                    minHeight: 44,
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'white',
                      boxShadow: '0 2px 8px rgba(0, 82, 204, 0.25)',
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      },
                      '& .MuiListItemIcon-root': {
                        color: 'white',
                      },
                    },
                    '&:hover': {
                      backgroundColor: isSelected 
                        ? 'primary.dark' 
                        : 'action.hover',
                    },
                  }}
                >
                  <ListItemIcon 
                    sx={{ 
                      minWidth: 40,
                      color: isSelected ? 'white' : 'text.secondary',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.text}
                    primaryTypographyProps={{
                      fontSize: '0.875rem',
                      fontWeight: isSelected ? 600 : 500,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      <Divider />

      {/* User Info in Sidebar */}
      <Box sx={{ p: 2 }}>
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center',
            gap: 1.5,
            p: 1.5,
            borderRadius: 2,
            backgroundColor: 'action.hover',
            transition: 'all 0.2s',
            '&:hover': {
              backgroundColor: 'action.selected',
            }
          }}
        >
          <Avatar 
            sx={{ 
              width: 36, 
              height: 36, 
              fontSize: 14,
              fontWeight: 600,
              backgroundColor: 'primary.main',
              boxShadow: '0 2px 8px rgba(0, 82, 204, 0.2)',
            }}
          >
            {user?.username?.[0]?.toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography 
              variant="body2" 
              noWrap
              sx={{ 
                fontWeight: 600,
                fontSize: '0.875rem',
                color: 'text.primary'
              }}
            >
              {user?.username}
            </Typography>
            <Typography 
              variant="caption" 
              noWrap
              sx={{ 
                color: 'text.secondary',
                fontSize: '0.75rem',
                textTransform: 'capitalize'
              }}
            >
              {user?.role}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <ThemeProvider theme={muiTheme}>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <AppBar
          position="fixed"
          sx={{
            width: { md: `calc(100% - ${drawerWidth}px)` },
            ml: { md: `${drawerWidth}px` },
          }}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>

            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
              {getCurrentPageTitle()}
            </Typography>

            {/* Theme Toggle */}
            <Tooltip title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
              <IconButton color="inherit" onClick={toggleTheme}>
                {theme === 'light' ? <Brightness4 /> : <Brightness7 />}
              </IconButton>
            </Tooltip>

            {/* Profile Menu */}
            <IconButton
              size="large"
              edge="end"
              aria-label="account of current user"
              aria-controls="primary-search-account-menu"
              aria-haspopup="true"
              onClick={handleProfileMenuOpen}
              color="inherit"
            >
              <Badge
                variant="dot"
                color={user?.status === 'active' ? 'success' : 'warning'}
              >
                <Avatar sx={{ width: 32, height: 32 }}>
                  {user?.username?.[0]?.toUpperCase()}
                </Avatar>
              </Badge>
            </IconButton>
          </Toolbar>
        </AppBar>

        <Menu
          anchorEl={anchorEl}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          open={Boolean(anchorEl)}
          onClose={handleProfileMenuClose}
          PaperProps={{
            sx: { 
              mt: 1.5, 
              minWidth: 240,
              borderRadius: 2,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            }
          }}
        >
          <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Avatar 
                sx={{ 
                  width: 40, 
                  height: 40,
                  backgroundColor: 'primary.main',
                  fontWeight: 600,
                }}
              >
                {user?.username?.[0]?.toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.9375rem' }}>
                  {user?.username}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                  {user?.email}
                </Typography>
              </Box>
            </Box>
            <Box 
              sx={{ 
                mt: 1.5,
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                backgroundColor: 'action.hover',
                display: 'inline-block'
              }}
            >
              <Typography 
                variant="caption" 
                sx={{ 
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  fontSize: '0.6875rem',
                  letterSpacing: '0.05em',
                  color: 'primary.main'
                }}
              >
                {user?.role}
              </Typography>
            </Box>
          </Box>

          <MenuItem 
            onClick={handleProfileClick}
            sx={{ 
              mx: 1, 
              my: 0.5, 
              borderRadius: 1.5,
              '&:hover': {
                backgroundColor: 'action.hover',
              }
            }}
          >
            <ListItemIcon>
              <Person fontSize="small" />
            </ListItemIcon>
            <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
              Profile Settings
            </Typography>
          </MenuItem>

          <Divider sx={{ my: 0.5 }} />

          <MenuItem 
            onClick={handleLogout}
            sx={{ 
              mx: 1, 
              my: 0.5, 
              borderRadius: 1.5,
              color: 'error.main',
              '&:hover': {
                backgroundColor: 'error.lighter',
              }
            }}
          >
            <ListItemIcon>
              <Logout fontSize="small" color="error" />
            </ListItemIcon>
            <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
              Logout
            </Typography>
          </MenuItem>
        </Menu>

        <Box
          component="nav"
          sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
          aria-label="mailbox folders"
        >
          {/* Mobile drawer */}
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            sx={{
              display: { xs: 'block', md: 'none' },
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: drawerWidth,
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              },
            }}
          >
            {drawer}
          </Drawer>

          {/* Desktop drawer */}
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', md: 'block' },
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: drawerWidth,
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              },
            }}
            open
          >
            {drawer}
          </Drawer>
        </Box>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: { md: `calc(100% - ${drawerWidth}px)` },
            minHeight: '100vh',
            backgroundColor: 'background.default',
            transition: 'background-color 0.2s'
          }}
        >
          <Toolbar />
          <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
            <Outlet />
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default AdminLayout;