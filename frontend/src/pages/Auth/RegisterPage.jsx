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
  Divider,
  Grid
} from '@mui/material';
import { 
  Visibility, 
  VisibilityOff, 
  Email, 
  Lock,
  Person,
  PersonAdd,
  Pin
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/ToastProvider';

const STEP_FORM = 'form';
const STEP_VERIFY = 'verify';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register: registerUser, sendSignupOtp } = useAuth();
  const { showSuccess, showError } = useToast();
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [step, setStep] = useState(STEP_FORM);
  const [otp, setOtp] = useState('');
  const [pendingData, setPendingData] = useState(null);
  const [resendOtpCooldownSeconds, setResendOtpCooldownSeconds] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset
  } = useForm({
    defaultValues: {
      email: '',
      username: '',
      password: '',
      confirmPassword: ''
    }
  });

  const password = watch('password');

  useEffect(() => {
    if (resendOtpCooldownSeconds <= 0) return;
    const t = setInterval(() => {
      setResendOtpCooldownSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [resendOtpCooldownSeconds]);

  const formatCooldown = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const onSubmit = async (data) => {
    setRegisterError('');
    const { confirmPassword, ...submitData } = data;

    if (step === STEP_FORM) {
      try {
        setIsSendingOtp(true);
        const result = await sendSignupOtp(submitData.email);
        if (result.success) {
          setPendingData(submitData);
          setStep(STEP_VERIFY);
          setOtp('');
          setResendOtpCooldownSeconds(600);
          showSuccess('Verification code sent to your email.');
        } else {
          setRegisterError(result.error);
          showError(result.error);
        }
      } finally {
        setIsSendingOtp(false);
      }
      return;
    }

    try {
      setIsLoading(true);
      const result = await registerUser({ ...pendingData, otp: otp.trim() });
      if (result.success) {
        showSuccess(result.message, 'Registration Successful');
        reset();
        setStep(STEP_FORM);
        setOtp('');
        setPendingData(null);
        navigate('/auth/login');
      } else {
        setRegisterError(result.error);
        showError(result.error, 'Registration Failed');
      }
    } catch (error) {
      const errorMessage = 'An unexpected error occurred. Please try again.';
      setRegisterError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const onResendOtp = async () => {
    if (!pendingData?.email) return;
    setIsSendingOtp(true);
    setRegisterError('');
    try {
      const result = await sendSignupOtp(pendingData.email);
      if (result.success) {
        setResendOtpCooldownSeconds(600);
        showSuccess('Verification code sent again.');
      } else showError(result.error);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const canSubmitVerify = step === STEP_VERIFY && otp.trim().length >= 6;

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
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
      <Card 
        elevation={8}
        sx={{ 
          maxWidth: 600, 
          width: '100%',
          borderRadius: 2
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <PersonAdd sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
              Create Account
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Join Robert Voice Agent platform
            </Typography>
          </Box>

          {/* Error Alert */}
          {registerError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {registerError}
            </Alert>
          )}

          {/* Registration Form */}
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            {step === STEP_VERIFY && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                We sent a verification code to {pendingData?.email}. Enter it below.
              </Typography>
            )}
            <TextField
              fullWidth
              label="Username"
              disabled={step === STEP_VERIFY}
              autoComplete="username"
              autoFocus
              margin="normal"
              {...register('username', {
                required: 'Username is required',
                minLength: {
                  value: 3,
                  message: 'Username must be at least 3 characters'
                },
                pattern: {
                  value: /^[a-zA-Z0-9_]+$/,
                  message: 'Username can only contain letters, numbers, and underscores'
                }
              })}
              error={!!errors.username}
              helperText={errors.username?.message}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Person color={errors.username ? 'error' : 'action'} />
                  </InputAdornment>
                )
              }}
            />

            <TextField
              fullWidth
              label="Email Address"
              type="email"
              autoComplete="email"
              margin="normal"
              disabled={step === STEP_VERIFY}
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address'
                }
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
              autoComplete="new-password"
              margin="normal"
              disabled={step === STEP_VERIFY}
              {...register('password', {
                required: 'Password is required',
                minLength: {
                  value: 8,
                  message: 'Password must be at least 8 characters'
                },
                pattern: {
                  value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                  message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
                }
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
                    <IconButton
                      onClick={togglePasswordVisibility}
                      edge="end"
                      aria-label="toggle password visibility"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            <TextField
              fullWidth
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              margin="normal"
              disabled={step === STEP_VERIFY}
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate: value => value === password || 'Passwords do not match'
              })}
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword?.message}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color={errors.confirmPassword ? 'error' : 'action'} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={toggleConfirmPasswordVisibility}
                      edge="end"
                      aria-label="toggle confirm password visibility"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            {step === STEP_VERIFY && (
              <Box sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  label="Verification code"
                  placeholder="Enter 6-digit code"
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
                  disabled={isSendingOtp || resendOtpCooldownSeconds > 0}
                  onClick={onResendOtp}
                  sx={{ mt: 1, mb: 1 }}
                  startIcon={isSendingOtp ? <CircularProgress size={18} /> : null}
                >
                  {isSendingOtp
                    ? 'Sending...'
                    : resendOtpCooldownSeconds > 0
                      ? `Resend in ${formatCooldown(resendOtpCooldownSeconds)}`
                      : 'Resend code'}
                </Button>
              </Box>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={step === STEP_FORM ? isSendingOtp : (isLoading || !canSubmitVerify)}
              sx={{ mt: 3, mb: 2, py: 1.5 }}
              startIcon={(step === STEP_FORM && isSendingOtp) || isLoading ? <CircularProgress size={20} /> : <PersonAdd />}
            >
              {step === STEP_FORM
                ? (isSendingOtp ? 'Sending code...' : 'Send verification code')
                : (isLoading ? 'Creating account...' : 'Verify and create account')}
            </Button>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Login Link */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Already have an account?{' '}
              <Link 
                to="/auth/login" 
                style={{ 
                  color: 'inherit',
                  textDecoration: 'none',
                  fontWeight: 'bold'
                }}
              >
                Sign In
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default RegisterPage;