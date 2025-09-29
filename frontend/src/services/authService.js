import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE,
  // withCredentials: true, // Important for httpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token if available
apiClient.interceptors.request.use(
  (config) => {
    // Token will be automatically included via httpOnly cookies
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - redirect to login
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

const authService = {
  // Login user with email/password
  async login(credentials) {
    const response = await apiClient.post('/api/auth/login', credentials);
    return response.data;
  },

  // Register new user
  async register(userData) {
    const response = await apiClient.post('/api/auth/register', userData);
    return response.data;
  },

  // Get current user profile (validates session)
  async getProfile() {
    const response = await apiClient.get('/api/auth/me');
    return response.data.user;
  },

  // Update user profile
  async updateProfile(profileData) {
    const response = await apiClient.put('/api/auth/me', profileData);
    return response.data.user;
  },

  // Logout user
  async logout() {
    const response = await apiClient.post('/api/auth/logout');
    return response.data;
  },

  // Change password
  async changePassword(passwordData) {
    const response = await apiClient.put('/api/auth/change-password', passwordData);
    return response.data;
  },

  // Toggle MFA
  async toggleMFA(mfaEnabled) {
    const response = await apiClient.patch('/api/auth/mfa', { mfaEnabled });
    return response.data;
  }
};

export default authService;