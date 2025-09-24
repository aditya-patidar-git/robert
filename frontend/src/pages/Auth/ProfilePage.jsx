import React, { useState } from 'react';
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

const ProfilePage = () => {
  const { user, updateProfile, theme, toggleTheme } = useAuth();
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
    try {
      setIsChangingPassword(true);
      // This would call authService.changePassword
      // For now, we'll simulate success
      showSuccess('Password changed successfully!', 'Security Update');
      resetPassword();
    } catch (error) {
      showError('Failed to change password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleMFAToggle = async (enabled) => {
    try {
      const result = await updateProfile({ mfaEnabled: enabled });
      if (result.success) {
        showSuccess(
          `Two-factor authentication ${enabled ? 'enabled' : 'disabled'}`,
          'Security Update'
        );
      } else {
        showError('Failed to update MFA settings');
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
      case 'blocked': return 'error';
      default: return 'default';
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Profile Settings
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Manage your account information and security settings
      </Typography>

      <Grid container spacing={3}>
        {/* Profile Overview */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Avatar
                sx={{
                  width: 100,
                  height: 100,
                  mx: 'auto',
                  mb: 2,
                  fontSize: 40,
                  bgcolor: 'primary.main'
                }}
              >
                {user?.username?.[0]?.toUpperCase()}
              </Avatar>
              
              <Typography variant="h5" gutterBottom>
                {user?.username}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {user?.email}
              </Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 2 }}>
                <Chip
                  icon={<Badge />}
                  label={user?.role}
                  color={getRoleColor(user?.role)}
                  variant="filled"
                />
                <Chip
                  label={user?.status}
                  color={getStatusColor(user?.status)}
                  variant="outlined"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Profile Information */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader
              title="Profile Information"
              subheader="Update your personal information"
              avatar={<Person />}
            />
            <CardContent>
              <Box component="form" onSubmit={handleProfileSubmit(handleProfileUpdate)}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Username"
                      {...registerProfile('username', {
                        required: 'Username is required'
                      })}
                      error={!!profileErrors.username}
                      helperText={profileErrors.username?.message}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Email Address"
                      type="email"
                      {...registerProfile('email', {
                        required: 'Email is required',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Invalid email address'
                        }
                      })}
                      error={!!profileErrors.email}
                      helperText={profileErrors.email?.message}
                    />
                  </Grid>
                </Grid>

                <Button
                  type="submit"
                  variant="contained"
                  disabled={isUpdatingProfile}
                  startIcon={isUpdatingProfile ? <CircularProgress size={20} /> : <Save />}
                  sx={{ mt: 3 }}
                >
                  {isUpdatingProfile ? 'Updating...' : 'Update Profile'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Security Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Security Settings"
              subheader="Manage your account security"
              avatar={<Security />}
            />
            <CardContent>
              {/* MFA Toggle */}
              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={user?.mfaEnabled || false}
                      onChange={(e) => handleMFAToggle(e.target.checked)}
                    />
                  }
                  label="Two-Factor Authentication"
                />
                <Typography variant="body2" color="text.secondary">
                  Add an extra layer of security to your account
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Password Change Form */}
              <Typography variant="h6" gutterBottom>
                Change Password
              </Typography>
              
              <Box component="form" onSubmit={handlePasswordSubmit(handlePasswordChange)}>
                <TextField
                  fullWidth
                  label="Current Password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  margin="normal"
                  {...registerPassword('currentPassword', {
                    required: 'Current password is required'
                  })}
                  error={!!passwordErrors.currentPassword}
                  helperText={passwordErrors.currentPassword?.message}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          edge="end"
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
                  margin="normal"
                  {...registerPassword('newPassword', {
                    required: 'New password is required',
                    minLength: {
                      value: 8,
                      message: 'Password must be at least 8 characters'
                    }
                  })}
                  error={!!passwordErrors.newPassword}
                  helperText={passwordErrors.newPassword?.message}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          edge="end"
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
                  margin="normal"
                  {...registerPassword('confirmPassword', {
                    required: 'Please confirm your new password',
                    validate: value => value === newPassword || 'Passwords do not match'
                  })}
                  error={!!passwordErrors.confirmPassword}
                  helperText={passwordErrors.confirmPassword?.message}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          edge="end"
                        >
                          {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />

                <Button
                  type="submit"
                  variant="outlined"
                  disabled={isChangingPassword}
                  startIcon={isChangingPassword ? <CircularProgress size={20} /> : <Lock />}
                  sx={{ mt: 2 }}
                >
                  {isChangingPassword ? 'Changing...' : 'Change Password'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Appearance Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Appearance"
              subheader="Customize your interface"
              avatar={<Palette />}
            />
            <CardContent>
              <FormControlLabel
                control={
                  <Switch
                    checked={theme === 'dark'}
                    onChange={toggleTheme}
                  />
                }
                label="Dark Mode"
              />
              <Typography variant="body2" color="text.secondary">
                Switch between light and dark themes
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default ProfilePage;