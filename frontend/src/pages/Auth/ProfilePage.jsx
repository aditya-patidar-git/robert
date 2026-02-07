import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Chip,
  Avatar,
  Divider,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress
} from '@mui/material';
import {
  Person,
  Email,
  Badge,
  Security,
  Palette,
  Lock,
  Visibility,
  VisibilityOff,
  Save,
  Shield
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/ToastProvider';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, updateProfile, toggleMFA, changePassword, logout, theme, toggleTheme } = useAuth();
  const { showSuccess, showError } = useToast();

  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Profile form
  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors },
    reset: resetProfile
  } = useForm({
    defaultValues: {
      username: user?.username || '',
      email: user?.email || ''
    }
  });

  // Password form
  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors },
    watch,
    reset: resetPassword
  } = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  });

  const currentPassword = watch('currentPassword');
  const newPassword = watch('newPassword');

  const handleProfileUpdate = async (data) => {
    try {
      setIsUpdatingProfile(true);
      const result = await updateProfile(data);
      
      if (result.success) {
        showSuccess(result.message, 'Profile Updated');
      } else {
        showError(result.error, 'Update Failed');
      }
    } catch (error) {
      showError('Failed to update profile. Please try again.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordChange = async (data) => {
    const { currentPassword: cur, newPassword: newP, confirmPassword: conf } = data;
    if (!cur?.trim()) {
      showError('Current password is required.');
      return;
    }
    if (!newP?.trim()) {
      showError('New password is required.');
      return;
    }
    if (newP.length < 8 || !PASSWORD_PATTERN.test(newP)) {
      showError('New password must be at least 8 characters with one uppercase, one lowercase, and one number.');
      return;
    }
    if (cur === newP) {
      showError('New password must be different from current password.');
      return;
    }
    if (conf !== newP) {
      showError('Confirm password must match new password.');
      return;
    }
    try {
      setIsChangingPassword(true);
      const result = await changePassword({ currentPassword: cur, newPassword: newP });
      if (result.success) {
        showSuccess('Password changed. Please sign in with your new password.', 'Security Update');
        resetPassword();
        await logout();
        navigate('/auth/login');
      } else {
        showError(result.error || 'Failed to change password.');
      }
    } catch (error) {
      showError('Failed to change password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleMFAToggle = async (enabled) => {
    try {
      const result = await toggleMFA(enabled);
      if (result.success) {
        showSuccess(
          `Two-factor authentication ${enabled ? 'enabled' : 'disabled'}`,
          'Security Update'
        );
      } else {
        showError(result.error || 'Failed to update MFA settings');
      }
    } catch (error) {
      showError('Failed to update MFA settings');
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'owner': return 'error';
      case 'admin': return 'warning';
      case 'user': return 'primary';
      default: return 'default';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'pending': return 'warning';
      case 'suspended': return 'error';
      default: return 'default';
    }
  };

  return (
    <Container maxWidth="lg" disableGutters sx={{ pt: 0, pb: { xs: 3, sm: 4, md: 5 } }}>
      <Box sx={{ mb: 4 }}>
        <Typography 
          variant="h4" 
          component="h1" 
          gutterBottom
          sx={{ 
            fontWeight: 600,
            mb: 1
          }}
        >
          Profile Settings
        </Typography>
        <Typography 
          variant="body1" 
          color="text.secondary"
          sx={{ 
            fontSize: '1rem'
          }}
        >
          Manage your account information and security settings
        </Typography>
      </Box>

      <Box 
        sx={{ 
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 3,
          width: '100%'
        }}
      >
        {/* Profile Overview */}
        <Box sx={{ width: { xs: '100%', md: '50%' }, flex: { xs: '0 0 100%', md: '0 0 50%' } }}>
          <Card 
            elevation={2}
            sx={{ 
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <CardContent 
              sx={{ 
                textAlign: 'center', 
                py: 5,
                px: 3,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}
            >
              <Avatar
                sx={{
                  width: 120,
                  height: 120,
                  mx: 'auto',
                  mb: 3,
                  fontSize: 48,
                  bgcolor: 'primary.main',
                  boxShadow: 3
                }}
              >
                {user?.username?.[0]?.toUpperCase()}
              </Avatar>
              
              <Typography 
                variant="h5" 
                gutterBottom
                sx={{ 
                  fontWeight: 600,
                  mb: 1
                }}
              >
                {user?.username}
              </Typography>
              
              <Typography 
                variant="body2" 
                color="text.secondary" 
                gutterBottom
                sx={{ 
                  mb: 3,
                  fontSize: '0.95rem'
                }}
              >
                {user?.email}
              </Typography>
              
              <Box 
                sx={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  gap: 1.5, 
                  mt: 'auto',
                  flexWrap: 'wrap'
                }}
              >
                <Chip
                  icon={<Badge />}
                  label={user?.role}
                  color={getRoleColor(user?.role)}
                  variant="filled"
                  sx={{ 
                    fontWeight: 500,
                    textTransform: 'capitalize'
                  }}
                />
                <Chip
                  label={user?.status}
                  color={getStatusColor(user?.status)}
                  variant="outlined"
                  sx={{ 
                    fontWeight: 500,
                    textTransform: 'capitalize'
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Profile Information */}
        <Box sx={{ width: { xs: '100%', md: '50%' }, flex: { xs: '0 0 100%', md: '0 0 50%' } }}>
          <Card 
            elevation={2}
            sx={{ height: '100%' }}
          >
            <CardHeader
              title="Profile Information"
              subheader="Update your personal information"
              avatar={
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <Person />
                </Avatar>
              }
              sx={{
                pb: 2,
                '& .MuiCardHeader-title': {
                  fontSize: '1.25rem',
                  fontWeight: 600
                },
                '& .MuiCardHeader-subheader': {
                  fontSize: '0.875rem'
                }
              }}
            />
            <Divider />
            <CardContent sx={{ pt: 3, px: 3, pb: 3 }}>
              <Box component="form" onSubmit={handleProfileSubmit(handleProfileUpdate)}>
                <Grid container spacing={3}>
                  <Grid size={12}>
                    <TextField
                      fullWidth
                      label="Username"
                      variant="outlined"
                      {...registerProfile('username', {
                        required: 'Username is required'
                      })}
                      error={!!profileErrors.username}
                      helperText={profileErrors.username?.message}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2
                        }
                      }}
                    />
                  </Grid>
                  <Grid size={12}>
                    <TextField
                      fullWidth
                      label="Email Address"
                      type="email"
                      variant="outlined"
                      {...registerProfile('email', {
                        required: 'Email is required',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Invalid email address'
                        }
                      })}
                      error={!!profileErrors.email}
                      helperText={profileErrors.email?.message}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2
                        }
                      }}
                    />
                  </Grid>
                </Grid>

                <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={isUpdatingProfile}
                    startIcon={isUpdatingProfile ? <CircularProgress size={20} /> : <Save />}
                    sx={{ 
                      minWidth: 160,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 500,
                      py: 1.25
                    }}
                  >
                    {isUpdatingProfile ? 'Updating...' : 'Update Profile'}
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      <Box 
        sx={{ 
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 3,
          width: '100%',
          mt: 3
        }}
      >
        {/* Security Settings */}
        <Box sx={{ width: { xs: '100%', md: '50%' }, flex: { xs: '0 0 100%', md: '0 0 50%' } }}>
          <Card 
            elevation={2}
            sx={{ height: '100%' }}
          >
            <CardHeader
              title="Security Settings"
              subheader="Manage your account security"
              avatar={
                <Avatar sx={{ bgcolor: 'error.main' }}>
                  <Security />
                </Avatar>
              }
              sx={{
                pb: 2,
                '& .MuiCardHeader-title': {
                  fontSize: '1.25rem',
                  fontWeight: 600
                },
                '& .MuiCardHeader-subheader': {
                  fontSize: '0.875rem'
                }
              }}
            />
            <Divider />
            <CardContent sx={{ pt: 3, px: 3, pb: 3 }}>
              {/* MFA Toggle */}
              <Box 
                sx={{ 
                  mb: 4,
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'action.hover'
                }}
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={user?.mfaEnabled || false}
                      onChange={(e) => handleMFAToggle(e.target.checked)}
                      sx={{ mr: 1 }}
                    />
                  }
                  label={
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      Two-Factor Authentication
                    </Typography>
                  }
                  sx={{ mb: 1 }}
                />
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ 
                    ml: 4.5,
                    fontSize: '0.875rem'
                  }}
                >
                  Add an extra layer of security to your account
                </Typography>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Password Change Form */}
              <Typography 
                variant="h6" 
                gutterBottom
                sx={{ 
                  mb: 3,
                  fontWeight: 600,
                  fontSize: '1.1rem'
                }}
              >
                Change Password
              </Typography>
              
              <Box component="form" onSubmit={handlePasswordSubmit(handlePasswordChange)}>
                <TextField
                  fullWidth
                  label="Current Password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  variant="outlined"
                  margin="normal"
                  {...registerPassword('currentPassword', {
                    required: 'Current password is required'
                  })}
                  error={!!passwordErrors.currentPassword}
                  helperText={passwordErrors.currentPassword?.message}
                  sx={{
                    mb: 2,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          edge="end"
                          size="small"
                        >
                          {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />

                <TextField
                  fullWidth
                  label="New Password"
                  type={showNewPassword ? 'text' : 'password'}
                  variant="outlined"
                  margin="normal"
                  {...registerPassword('newPassword', {
                    required: 'New password is required',
                    minLength: {
                      value: 8,
                      message: 'Password must be at least 8 characters'
                    },
                    pattern: {
                      value: PASSWORD_PATTERN,
                      message: 'Must contain at least one uppercase, one lowercase, and one number'
                    },
                    validate: (value) => value !== currentPassword || 'New password must differ from current password'
                  })}
                  error={!!passwordErrors.newPassword}
                  helperText={passwordErrors.newPassword?.message}
                  sx={{
                    mb: 2,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          edge="end"
                          size="small"
                        >
                          {showNewPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />

                <TextField
                  fullWidth
                  label="Confirm New Password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  variant="outlined"
                  margin="normal"
                  {...registerPassword('confirmPassword', {
                    required: 'Please confirm your new password',
                    validate: value => value === newPassword || 'Passwords do not match'
                  })}
                  error={!!passwordErrors.confirmPassword}
                  helperText={passwordErrors.confirmPassword?.message}
                  sx={{
                    mb: 2,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          edge="end"
                          size="small"
                        >
                          {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />

                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    type="submit"
                    variant="outlined"
                    size="large"
                    disabled={isChangingPassword}
                    startIcon={isChangingPassword ? <CircularProgress size={20} /> : <Lock />}
                    sx={{ 
                      minWidth: 180,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 500,
                      py: 1.25
                    }}
                  >
                    {isChangingPassword ? 'Changing...' : 'Change Password'}
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Appearance Settings */}
        <Box sx={{ width: { xs: '100%', md: '50%' }, flex: { xs: '0 0 100%', md: '0 0 50%' } }}>
          <Card 
            elevation={2}
            sx={{ height: '100%' }}
          >
            <CardHeader
              title="Appearance"
              subheader="Customize your interface"
              avatar={
                <Avatar sx={{ bgcolor: 'secondary.main' }}>
                  <Palette />
                </Avatar>
              }
              sx={{
                pb: 2,
                '& .MuiCardHeader-title': {
                  fontSize: '1.25rem',
                  fontWeight: 600
                },
                '& .MuiCardHeader-subheader': {
                  fontSize: '0.875rem'
                }
              }}
            />
            <Divider />
            <CardContent sx={{ pt: 3, px: 3, pb: 3 }}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'action.hover'
                }}
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={theme === 'dark'}
                      onChange={toggleTheme}
                      sx={{ mr: 1 }}
                    />
                  }
                  label={
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      Dark Mode
                    </Typography>
                  }
                  sx={{ mb: 1 }}
                />
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ 
                    ml: 4.5,
                    fontSize: '0.875rem'
                  }}
                >
                  Switch between light and dark themes
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Container>
  );
};

export default ProfilePage;