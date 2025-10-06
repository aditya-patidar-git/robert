import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    // Clean up any legacy tokens on app initialization
      const cleanupLegacyTokens = () => {
        const legacyTokens = ['voxipro_token', 'token', 'access_token', 'jwt_token'];
        legacyTokens.forEach(legacyToken => {
          if (localStorage.getItem(legacyToken)) {
            localStorage.removeItem(legacyToken);
          }
        });
      };
    
    cleanupLegacyTokens();
    checkAuthStatus();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      
      // Clean up any legacy tokens that might interfere
      const legacyTokens = ['voxipro_token', 'token', 'access_token', 'jwt_token'];
      legacyTokens.forEach(legacyToken => {
        if (localStorage.getItem(legacyToken)) {
          localStorage.removeItem(legacyToken);
        }
      });
      
      // Only check auth status if we have a token
      const token = localStorage.getItem('authToken');
      if (!token) {
        setUser(null);
        setIsAuthenticated(false);
        return;
      }
      
      // Check if token is expired (basic JWT decode)
      try {
        const parts = token.split('.');
        if (parts.length !== 3) {
          throw new Error('Invalid token format');
        }
        
        const payload = JSON.parse(atob(parts[1]));
        const currentTime = Date.now() / 1000;
        
        if (payload.exp && payload.exp < currentTime) {
          throw new Error('Token expired');
        }
      } catch (jwtError) {
        console.log('Token validation failed:', jwtError.message);
        localStorage.removeItem('authToken');
        setUser(null);
        setIsAuthenticated(false);
        return;
      }
      
      const userData = await authService.getProfile();
      
      if (userData && userData.id) {
        setUser(userData);
        setIsAuthenticated(true);
      } else {
        throw new Error('Invalid user data');
      }
    } catch (error) {
      console.log('No valid session found:', error.message);
      setUser(null);
      setIsAuthenticated(false);
      // Clear invalid token
      localStorage.removeItem('authToken');
      
      // Only redirect to login if we're not already on an auth page
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/auth/') && !currentPath.includes('/login') && !currentPath.includes('/register')) {
        // Use a small delay to prevent race conditions
        setTimeout(() => {
          window.location.href = '/auth/login';
        }, 100);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      const response = await authService.login(credentials);
      
      // Validate the response structure
      if (response && response.user && response.token) {
        setUser(response.user);
        setIsAuthenticated(true);
        return { success: true, user: response.user };
      } else {
        throw new Error('Invalid login response structure');
      }
    } catch (error) {
      console.log("error:", error);
      const message =
        error?.response?.data?.message || 'Invalid credentials. Please try again.';
      const isBlocked = message.toLowerCase().includes('blocked');
      return { success: false, error: message, isBlocked };
    }
  };

  const register = async (userData) => {
    try {
      await authService.register(userData);
      return { success: true, message: 'Registration successful! Please log in.' };
    } catch (error) {
      const message =
        error?.response?.data?.message || 'Registration failed. Please try again.';
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      // Clear token from localStorage
      localStorage.removeItem('authToken');
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const updatedUser = await authService.updateProfile(profileData);
      setUser(updatedUser);
      return { success: true, message: 'Profile updated successfully!' };
    } catch (error) {
      const message =
        error?.response?.data?.message || 'Profile update failed.';
      return { success: false, error: message };
    }
  };

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

  const clearAllTokens = () => {
    // Clear all possible token keys
    const allTokenKeys = ['authToken', 'voxipro_token', 'token', 'access_token', 'jwt_token', 'user'];
    allTokenKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
      }
    });
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        theme,
        login,
        register,
        logout,
        updateProfile,
        toggleTheme,
        checkAuthStatus,
        clearAllTokens
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
