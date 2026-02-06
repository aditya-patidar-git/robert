import { BaseService } from './baseService';

/**
 * Authentication Service
 * Handles user authentication, registration, and profile management
 * @extends BaseService
 */
class AuthService extends BaseService {
  constructor() {
    super('/api/auth', {
      dataPath: null,
      normalizeResponse: true
    });
  }

  /**
   * Login user with email/password (and optional OTP when MFA is enabled)
   * @param {Object} credentials - Login credentials
   * @param {string} credentials.email - User email
   * @param {string} credentials.password - User password
   * @param {string} [credentials.otp] - OTP when MFA is required
   * @returns {Promise<Object>} Login response with token
   */
  async login(credentials) {
    const response = await this.post('/login', credentials);
    
    // Store token in localStorage
    if (response.data?.token) {
      localStorage.setItem('authToken', response.data.token);
    }
    if (response.data?.refreshToken) {
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }
    
    return response.data || response;
  }

  /**
   * Register new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Registration response
   */
  async register(userData) {
    return this.post('/signup', userData);
  }

  async sendLoginOtp(credentials) {
    return this.post('/send-otp', { email: credentials.email, password: credentials.password });
  }

  async invalidateLoginOtp(email) {
    return this.post('/invalidate-login-otp', { email });
  }

  async sendSignupOtp(email) {
    return this.post('/send-signup-otp', { email });
  }

  async sendPendingVerificationOtp(credentials) {
    return this.post('/send-pending-verification-otp', {
      email: credentials.email,
      password: credentials.password
    });
  }

  async verifyPendingUser({ email, otp }) {
    const response = await this.post('/verify-pending-user', { email, otp });
    const data = response?.data ?? response;
    if (data?.token) {
      localStorage.setItem('authToken', data.token);
    }
    return data;
  }

  /**
   * Get current user profile (validates session)
   * @returns {Promise<Object>} User profile object
   */
  async getProfile() {
    const response = await this.get('/me');
    return response.data?.user || response.data;
  }

  /**
   * Update user profile
   * @param {Object} profileData - Profile data to update
   * @returns {Promise<Object>} Updated user profile
   */
  async updateProfile(profileData) {
    const response = await this.put('/me', profileData);
    return response.data?.user || response.data;
  }

  /**
   * Logout user
   * @returns {Promise<Object>} Logout response
   */
  async logout() {
    const response = await this.post('/logout');
    // Remove tokens from localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    return response.data || response;
  }

  /**
   * Change password
   * @param {Object} passwordData - Password change data
   * @param {string} passwordData.currentPassword - Current password
   * @param {string} passwordData.newPassword - New password
   * @returns {Promise<Object>} Change password response
   */
  async changePassword(passwordData) {
    return this.put('/change-password', passwordData);
  }

  /**
   * Toggle MFA (Multi-Factor Authentication)
   * @param {boolean} mfaEnabled - Whether to enable MFA
   * @returns {Promise<Object>} MFA toggle response
   */
  async toggleMFA(mfaEnabled) {
    return this.patch('/mfa', { mfaEnabled });
  }
}

// Export singleton instance
const authService = new AuthService();
export default authService;
