import authenticatedApiClient from '../api/authenticatedApi.js';

const authService = {
  // Login user with email/password
  async login(credentials) {
    const response = await authenticatedApiClient.post('/api/auth/login', credentials);
    
    // Store token in localStorage
    if (response.data.token) {
      localStorage.setItem('authToken', response.data.token);
    }
    return response.data;
  },

  // Register new user
  async register(userData) {
    const response = await authenticatedApiClient.post('/api/auth/register', userData);
    return response.data;
  },

  // Get current user profile (validates session)
  async getProfile() {
    const response = await authenticatedApiClient.get('/api/auth/me');
    return response.data.user;
  },

  // Update user profile
  async updateProfile(profileData) {
    const response = await authenticatedApiClient.put('/api/auth/me', profileData);
    return response.data.user;
  },

  // Logout user
  async logout() {
    const response = await authenticatedApiClient.post('/api/auth/logout');
    // Remove token from localStorage
    localStorage.removeItem('authToken');
    return response.data;
  },

  // Change password
  async changePassword(passwordData) {
    const response = await authenticatedApiClient.put('/api/auth/change-password', passwordData);
    return response.data;
  },

  // Toggle MFA
  async toggleMFA(mfaEnabled) {
    const response = await authenticatedApiClient.patch('/api/auth/mfa', { mfaEnabled });
    return response.data;
  }
};

export default authService;