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
  Privacy,
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
      roles: ['owner', 'admin', 'user'] 
    },
    { 
      text: 'Users', 
      icon: <People />, 
      path: '/admin/users',
      roles: ['owner', 'admin'] 
    },
    { 
      text: 'Knowledge Base', 
      icon: <MenuBook />, 
      path: '/admin/kb',
      roles: ['owner', 'admin'] 
    },
    { 
      text: 'Prompts', 
      icon: <Psychology />, 
      path: '/admin/prompts',
      roles: ['owner', 'admin'] 
    },
    { 
      text: 'Audio Telephony', 
      icon: <Phone />, 
      path: '/admin/audio-telephony',
      roles: ['owner', 'admin'] 
    },
    { 
      text: 'CRM', 
      icon: <Business />, 
      path: '/admin/crm',
      roles: ['owner', 'admin', 'user'] 
    },
    { 
      text: 'Transcripts', 
      icon: <Description />, 
      path: '/admin/transcripts',
      roles: ['owner', 'admin', 'user'] 
    },
    { 
      text: 'Privacy & DSAR', 
      icon: <Privacy />, 
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
      text: 'Complaints', 
      icon: <ReportProblem />, 
      path: '/admin/complaints',
      roles: ['owner', 'admin', 'user'] 
    },
    { 
      text: 'System', 
      icon: <Computer />, 
      path: '/admin/system',
      roles: ['owner', 'admin'] 
    },
    { 
      text: 'Settings', 
      icon: <Settings />, 
      path: '/admin/settings',
      roles: ['owner', 'admin'] 
    },
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
    <Box>
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <Phone sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" noWrap component="div">
            Robert Admin
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <List>
        {filteredMenuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname.startsWith(item.path)}
              onClick={() => handleNavigation(item.path)}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'primary.contrastText',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ color: 'inherit' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      
      <Divider sx={{ mt: 'auto' }} />
      
      {/* User Info in Sidebar */}
      <Box sx={{ p: 2, mt: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Avatar sx={{ width: 32, height: 32, mr: 1, fontSize: 14 }}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </Avatar>
          <Box sx={{ overflow: 'hidden' }}>
            <Typography variant="body2" noWrap>
              {user?.firstName} {user?.lastName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
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
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </Avatar>
              </Badge>
            </IconButton>
          </Toolbar>
        </AppBar>

        <Menu
          anchorEl={anchorEl}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          keepMounted
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          open={Boolean(anchorEl)}
          onClose={handleProfileMenuClose}
          PaperProps={{
            sx: { mt: 1.5, minWidth: 200 }
          }}
        >
          <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle1" fontWeight="bold">
              {user?.firstName} {user?.lastName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user?.email}
            </Typography>
          </Box>
          
          <MenuItem onClick={handleProfileClick}>
            <ListItemIcon>
              <Person fontSize="small" />
            </ListItemIcon>
            Profile Settings
          </MenuItem>
          
          <Divider />
          
          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <Logout fontSize="small" />
            </ListItemIcon>
            Logout
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
            backgroundColor: 'background.default'
          }}
        >
          <Toolbar />
          <Outlet />
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default AdminLayout;