import { BrowserManager } from './browserManager.js';
import { TaskExecutor } from './taskExecutor.js';
// DEPRECATED: CourseBookingRouter removed - create_booking task is blocked
import { takeScreenshot, saveAuditLog, extractPriceFromBooking } from '../commonBookingSteps/utils.js';
import urlValidation from '../../utils/urlValidation.js';
import { clearRecaptchaStorage } from '../../utils/stealthUtils.js';

/**
 * Browser Agent Service
 * Main service class that orchestrates browser automation tasks
 * Maintains backward compatibility with original browserAgentService API
 */
class BrowserAgentService {
  constructor() {
    this.crmCredentials = {
      loginUrl: 'https://takeabyte.co.uk/InContact/Account/Login',
      loginName: process.env.CRM_LOGIN || 'universalmct',
      username: process.env.CRM_USERNAME || 'auagent',
      password: process.env.CRM_PASSWORD || 'Robert2025!',
      userAgent: 'auagent'
    };
    this.screenshotsDir = './screenshots';
    this.auditDir = './audit-logs';
    
    // Lock mechanism to prevent concurrent executions per call
    this.activeExecutions = new Map(); // Map<executionKey, { task, startTime, lastHeartbeat, phase, cancelToken }>
    
    // Execution lock configuration
    this.executionLockTimeout = parseInt(process.env.EXECUTION_LOCK_TIMEOUT_MINUTES || '2', 10) * 60 * 1000; // Default 2 minutes
    this.executionHeartbeatInterval = parseInt(process.env.EXECUTION_HEARTBEAT_INTERVAL_SECONDS || '30', 10) * 1000; // Default 30 seconds
    
    // Initialize browser manager
    this.browserManager = new BrowserManager(this.crmCredentials, this.screenshotsDir, this.auditDir);
    
    // Initialize task executor
    this.taskExecutor = new TaskExecutor(
      this.browserManager,
      this.updateExecutionPhase.bind(this),
      this.activeExecutions,
      this.executionLockTimeout,
      this.executionHeartbeatInterval,
      this.crmCredentials,
      this.screenshotsDir
    );
  }

  // Delegate browser management methods
  async getBrowser() {
    return await this.browserManager.getBrowser();
  }

  async getContext(progressCallback = null) {
    return await this.browserManager.getContext(progressCallback);
  }

  async getPublicContext() {
    return await this.browserManager.getPublicContext();
  }

  async cleanup() {
    return await this.browserManager.cleanup();
  }

  // Main task execution method
  async executeTask(task, args, callContext = {}, progressCallback = null) {
    return await this.taskExecutor.executeTask(task, args, callContext, progressCallback);
  }

  // Helper method to update execution phase
  updateExecutionPhase(executionKey, phase) {
    const execution = this.activeExecutions.get(executionKey);
    if (execution) {
      execution.phase = phase;
      execution.lastHeartbeat = Date.now();
    }
  }

  // Helper methods (maintained for backward compatibility)
  async takeScreenshot(page, filename) {
    return await takeScreenshot(page, filename, this.screenshotsDir);
  }

  async saveAuditLog(auditId, action, result) {
    return await saveAuditLog(auditId, action, result, this.auditDir, this.screenshotsDir);
  }

  extractPriceFromBooking(booking) {
    return extractPriceFromBooking(booking);
  }

  async validateBookingForm(page) {
    // Check if all required fields are filled
    const requiredFields = ['customerName', 'customerEmail', 'customerPhone', 'courseType'];
    
    for (const field of requiredFields) {
      const value = await page.inputValue(`input[name="${field}"]`);
      if (!value || value.trim() === '') {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Determines if an error is reCAPTCHA-related
   * @param {Error|string} error - Error object or error message
   * @param {Object} context - Additional context (response, score, token, etc.)
   * @returns {Object} Object with isRecaptchaFailure boolean and details
   */
  isRecaptchaFailure(error, context = {}) {
    const errorMessage = typeof error === 'string' ? error : (error?.message || '');
    const errorLower = errorMessage.toLowerCase();
    
    const recaptchaKeywords = [
      'recaptcha', 'captcha', 'robot', 'automation', 'verification',
      'suspicious', 'bot detection', 'invalid token', 'token missing',
      'grecaptcha', 'g-recaptcha', 'reCAPTCHA'
    ];
    
    const isKeywordMatch = recaptchaKeywords.some(keyword => errorLower.includes(keyword));
    
    // Check for low reCAPTCHA score
    const lowScore = context.score !== undefined && context.score < 0.5;
    
    // Check for invalid/missing token
    const invalidToken = context.tokenInvalid === true || context.tokenMissing === true;
    
    // Check for reCAPTCHA challenge
    const hasChallenge = context.hasChallenge === true;
    
    // Check for reCAPTCHA timeout
    const hasTimeout = errorLower.includes('timeout') && (errorLower.includes('recaptcha') || errorLower.includes('captcha'));
    
    const isRecaptchaFailure = isKeywordMatch || lowScore || invalidToken || hasChallenge || hasTimeout;
    
    const details = {
      isRecaptchaFailure,
      reason: isRecaptchaFailure ? (
        isKeywordMatch ? 'keyword_match' :
        lowScore ? 'low_score' :
        invalidToken ? 'invalid_token' :
        hasChallenge ? 'challenge_required' :
        hasTimeout ? 'timeout' :
        'unknown'
      ) : null,
      score: context.score,
      tokenStatus: context.tokenInvalid ? 'invalid' : context.tokenMissing ? 'missing' : 'present',
      errorMessage: errorMessage
    };
    
    if (isRecaptchaFailure) {
      console.log(`🚨 reCAPTCHA failure detected: ${details.reason}`);
      if (details.score !== undefined) {
        console.log(`   Score: ${details.score}`);
      }
      if (details.tokenStatus !== 'present') {
        console.log(`   Token status: ${details.tokenStatus}`);
      }
    }
    
    return details;
  }

  /**
   * Clears reCAPTCHA storage and prepares for retry
   * @param {Page} page - Playwright page object
   * @returns {Promise<void>}
   */
  async prepareRecaptchaRetry(page) {
    console.log('🔄 Preparing for reCAPTCHA retry...');
    
    // Clear reCAPTCHA storage
    await clearRecaptchaStorage(page);
    
    // Wait for fresh initialization
    await page.waitForTimeout(500 + Math.random() * 500); // 500-1000ms
    
    console.log('✅ reCAPTCHA retry preparation complete');
  }

  /**
   * Safely navigate to URL with SSRF protection
   * @param {Object} page - Playwright page object
   * @param {string} url - URL to navigate to
   * @param {Object} options - Navigation options
   * @returns {Promise<void>}
   */
  async safeNavigate(page, url, options = {}) {
    // Validate URL before navigation
    const validation = urlValidation.validateUrl(url);
    if (!validation.valid) {
      throw new Error(`SSRF protection: ${validation.error}`);
    }

    // Navigate to validated URL
    await page.goto(url, options);
  }

  // DEPRECATED: Legacy createBooking method removed - use booking_step_* tools instead
  // createBooking is blocked in crmBrowserTool.js

  async rescheduleBooking(page, args, auditId) {
    const { rescheduleBooking } = await import('./tasks/rescheduleBooking.js');
    return await rescheduleBooking(page, args, auditId, this.screenshotsDir);
  }

  async cancelBooking(page, args, auditId) {
    const { cancelBooking } = await import('./tasks/cancelBooking.js');
    return await cancelBooking(page, args, auditId, this.screenshotsDir);
  }

  async updateCustomer(page, args, auditId) {
    const { updateCustomer } = await import('./tasks/updateCustomer.js');
    return await updateCustomer(page, args, auditId, this.screenshotsDir);
  }

  async checkAvailability(page, args, auditId) {
    const { checkAvailability } = await import('./tasks/checkAvailability.js');
    return await checkAvailability(page, args, auditId, this.screenshotsDir);
  }
}

// Export singleton instance (maintains backward compatibility)
export default new BrowserAgentService();

