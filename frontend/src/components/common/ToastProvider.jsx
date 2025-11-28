import React, { createContext, useContext, useState } from 'react';
import { Snackbar, Alert, AlertTitle } from '@mui/material';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = ({ message, severity = 'info', title, duration = 6000 }) => {
    const id = Date.now() + Math.random();
    const toast = {
      id,
      message,
      severity,
      title,
      duration,
      open: true
    };
    
    setToasts(prev => [...prev, toast]);
    
    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    
    return id;
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const showSuccess = (message, title = 'Success') => {
    return addToast({ message, severity: 'success', title });
  };

  const showError = (message, title = 'Error') => {
    return addToast({ message, severity: 'error', title, duration: 8000 });
  };

  const showWarning = (message, title = 'Warning') => {
    return addToast({ message, severity: 'warning', title });
  };

  const showInfo = (message, title = 'Info') => {
    return addToast({ message, severity: 'info', title });
  };

  const value = {
    addToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeToast
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      
      {/* Render toasts */}
      {toasts.map((toast) => (
        <Snackbar
          key={toast.id}
          open={toast.open}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          sx={{
            mt: 2,
            zIndex: 9999,
            '& .MuiSnackbarContent-root': {
              justifyContent: 'center',
            },
          }}
          TransitionProps={{
            appear: true,
            timeout: { enter: 300, exit: 200 },
          }}
        >
          <Alert
            severity={toast.severity}
            variant="filled"
            sx={{
              minWidth: 400,
              maxWidth: 600,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
              borderRadius: 2,
              py: 1.5,
              px: 2,
              '& .MuiAlert-message': {
                width: '100%',
              },
              '& .MuiAlertTitle-root': {
                fontWeight: 600,
                mb: 0.5,
              },
            }}
          >
            {toast.title && <AlertTitle>{toast.title}</AlertTitle>}
            {toast.message}
          </Alert>
        </Snackbar>
      ))}
    </ToastContext.Provider>
  );
};

export default ToastProvider;