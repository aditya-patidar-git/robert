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
    checkAuthStatus();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const checkAuthStatus = async () => {
    const mockadminuser = {
      _id: "68d3d2d86f15796dc1badabc",
      email: "admin@example.com",
      username: "admin",
      role: "admin",
      status: "active"
    }
    try {
      setIsLoading(true);
      const userData = await authService.getProfile();
      setUser(userData);
      setIsAuthenticated(true);
    } catch {
      setUser(null);
      setIsAuthenticated(false);
      // setIsAuthenticated(true);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      const response = await authService.login(credentials);
      console.log("response:", response)
      setUser(response.user);
      setIsAuthenticated(true);
      return { success: true, user: response.user };
    } catch (error) {
      console.log("eroro:", error)
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
        checkAuthStatus
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
