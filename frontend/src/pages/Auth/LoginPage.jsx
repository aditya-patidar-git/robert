import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress,
  Divider
} from '@mui/material';
import { Visibility, VisibilityOff, Email, Lock, Login as LoginIcon, Pin } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/ToastProvider';
import authService from '../../services/authService';

const MFA_OTP_SENT_EMAIL_KEY = 'mfa_otp_sent_email';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, sendLoginOtp, isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState(null);
  const [otp, setOtp] = useState('');
  const [sendOtpCooldownSeconds, setSendOtpCooldownSeconds] = useState(0);

  const { register, handleSubmit, getValues, formState: { errors } } = useForm({
    defaultValues: { email: '', password: '' }
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      console.log('✅ User already authenticated, redirecting to dashboard...');
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isAuthenticated, authLoading, user, navigate]);

  // On mount: if an OTP was sent before refresh, invalidate it so the code is expired
  useEffect(() => {
    const email = sessionStorage.getItem(MFA_OTP_SENT_EMAIL_KEY);
    if (email) {
      sessionStorage.removeItem(MFA_OTP_SENT_EMAIL_KEY);
      authService.invalidateLoginOtp(email).catch(() => {});
    }
  }, []);

  // 10-minute cooldown after Send OTP
  useEffect(() => {
    if (sendOtpCooldownSeconds <= 0) return;
    const t = setInterval(() => {
      setSendOtpCooldownSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [sendOtpCooldownSeconds]);

  const onSubmit = async (data) => {
    setIsLoading(true);
    setLoginError('');

    try {
      const payload = mfaRequired ? { ...getValues(), otp: otp.trim() } : data;
      const result = await login(payload);
      if (result.success) {
        showSuccess(`Welcome back, ${result.user.username}!`);
        navigate('/admin/dashboard');
      } else if (result.mfaRequired) {
        setMfaRequired(true);
        setPendingCredentials({ email: data.email, password: data.password });
        showSuccess('Enter the OTP sent to your email.');
      } else {
        setLoginError(result.error);
        showError(result.error, result.isBlocked ? 'Account Suspended' : 'Login Failed');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      const errorMessage = 'An unexpected error occurred. Please try again.';
      setLoginError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const onSendOtp = async () => {
    const creds = pendingCredentials || getValues();
    if (!creds?.email || !creds?.password) {
      showError('Please enter email and password first.');
      return;
    }
    setIsSendingOtp(true);
    setLoginError('');
    try {
      const result = await sendLoginOtp(creds);
      if (result.success) {
        showSuccess('OTP sent to your email.');
        setSendOtpCooldownSeconds(600); // 10 minutes
        sessionStorage.setItem(MFA_OTP_SENT_EMAIL_KEY, creds.email);
      } else {
        setLoginError(result.error);
        showError(result.error);
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  const canSubmit = !mfaRequired || (getValues('email') && getValues('password') && otp.trim().length >= 6);

  const formatCooldown = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        py: 3,
        px: 2
      }}
    >
      <Card elevation={8} sx={{ maxWidth: 450, width: '100%', borderRadius: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <LoginIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Welcome Back
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Sign in to your Robert Voice Agent account
            </Typography>
          </Box>

          {/* <-- Use actual form element --> */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              autoComplete="email"
              autoFocus
              margin="normal"
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Invalid email' }
              })}
              error={!!errors.email}
              helperText={errors.email?.message}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email color={errors.email ? 'error' : 'action'} />
                  </InputAdornment>
                )
              }}
            />

            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              margin="normal"
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' }
              })}
              error={!!errors.password}
              helperText={errors.password?.message}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color={errors.password ? 'error' : 'action'} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            {mfaRequired && (
              <Box sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  label="Verification code"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  margin="normal"
                  inputProps={{ maxLength: 6, inputMode: 'numeric' }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Pin color="action" />
                      </InputAdornment>
                    )
                  }}
                />
                <Button
                  type="button"
                  fullWidth
                  variant="outlined"
                  size="medium"
                  disabled={
                    isSendingOtp ||
                    sendOtpCooldownSeconds > 0 ||
                    !pendingCredentials?.email ||
                    !pendingCredentials?.password
                  }
                  onClick={onSendOtp}
                  sx={{ mt: 1, mb: 1 }}
                  startIcon={isSendingOtp ? <CircularProgress size={18} /> : null}
                >
                  {isSendingOtp
                    ? 'Sending...'
                    : sendOtpCooldownSeconds > 0
                      ? `Resend in ${formatCooldown(sendOtpCooldownSeconds)}`
                      : 'Send OTP'}
                </Button>
              </Box>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isLoading || (mfaRequired && !canSubmit)}
              sx={{ mt: 3, mb: 2, py: 1.5 }}
              startIcon={isLoading ? <CircularProgress size={20} /> : <LoginIcon />}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>

          <Divider sx={{ my: 3 }} />

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Don't have an account?{' '}
              <Link to="/auth/register" style={{ fontWeight: 'bold', textDecoration: 'none' }}>
                Create Account
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LoginPage;
