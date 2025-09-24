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
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          sx={{ mt: 8 }} // Offset from top to avoid app bar
        >
          <Alert
            severity={toast.severity}
            onClose={() => removeToast(toast.id)}
            variant="filled"
            sx={{ minWidth: 300 }}
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