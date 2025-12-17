import { useState, useCallback } from 'react';
import { useToast } from '../components/common/ToastProvider';

/**
 * useConnectionTest Hook
 * Reusable hook for testing connections
 * Used by SIP configuration, Payment Gateway configuration, etc.
 */
const useConnectionTest = (testFunction) => {
  const { showSuccess, showError } = useToast();
  const [status, setStatus] = useState('not_tested'); // 'not_tested', 'testing', 'success', 'failed'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastAttempt, setLastAttempt] = useState(null);
  const [testData, setTestData] = useState(null);

  const testConnection = useCallback(async (config) => {
    if (!testFunction) {
      console.error('testFunction is required for useConnectionTest');
      return;
    }

    setLoading(true);
    setStatus('testing');
    setError(null);

    try {
      const result = await testFunction(config);
      
      setLastAttempt(new Date());
      
      if (result.success) {
        setStatus('success');
        setTestData(result.data || null);
        showSuccess(result.message || 'Connection test successful');
      } else {
        setStatus('failed');
        setError(result.error || result.message || 'Connection test failed');
        setTestData(null);
        showError(result.message || 'Connection test failed', 'Test Failed');
      }
      
      return result;
    } catch (err) {
      const errorMessage = err.message || 'Connection test failed';
      setStatus('failed');
      setError(errorMessage);
      setTestData(null);
      setLastAttempt(new Date());
      showError(errorMessage, 'Test Error');
      
      return {
        success: false,
        status: 'failed',
        message: errorMessage,
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  }, [testFunction, showSuccess, showError]);

  const reset = useCallback(() => {
    setStatus('not_tested');
    setLoading(false);
    setError(null);
    setLastAttempt(null);
    setTestData(null);
  }, []);

  return {
    testConnection,
    status,
    loading,
    error,
    lastAttempt,
    testData,
    reset
  };
};

export default useConnectionTest;

