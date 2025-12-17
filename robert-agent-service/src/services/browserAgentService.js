import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { formatUserFriendlyError, getErrorContext } from '../utils/errorFormatter.js';
import urlValidation from '../utils/urlValidation.js';
import { 
  getRealisticUserAgent, 
  getStealthBrowserArgs, 
  getStealthInitScript,
  generateBezierPath,
  waitForRecaptchaReady,
  simulateHumanBehaviorBeforeSubmit,
  clearRecaptchaStorage,
  enhanceBehavioralPatterns,
  clickRecaptchaCheckbox,
  checkForRecaptchaChallenge
} from '../utils/stealthUtils.js';

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
    // Browser pooling instance variables
    this.browserInstance = null;
    this.browserContext = null;
    this.browserInitialized = false;
    this.authenticatedPage = null; // Store the authenticated page for reuse
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
    if (!fs.existsSync(this.auditDir)) {
      fs.mkdirSync(this.auditDir, { recursive: true });
    }
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

  async getBrowser() {
    // Return existing browser if connected, otherwise launch new one
    if (this.browserInstance && this.browserInstance.isConnected()) {
      return this.browserInstance;
    }
    
    // Launch new browser with stealth arguments
    console.log('🌐 Launching new browser instance with stealth mode...');
    
    this.browserInstance = await chromium.launch({ 
      headless: false,
      args: getStealthBrowserArgs()
    });
    
    return this.browserInstance;
  }

  async getContext(progressCallback = null) {
    // Check if existing context is still valid
    if (this.browserContext) {
      try {
        // Verify the context is still connected - trust that cookies persist
        const browser = this.browserContext.browser();
        if (browser && browser.isConnected()) {
          // Trust that cookies in context are valid - no need to verify with test page
          // Session expiration will be detected when we get redirected to login page
          console.log('✅ Reusing existing browser context (cookies persist in context)');
      return this.browserContext;
        } else {
          console.log('⚠️ Existing context is disconnected, will create new one');
          this.browserContext = null;
        }
      } catch (error) {
        console.log('⚠️ Error checking existing context, will create new one:', error.message);
        this.browserContext = null;
      }
    }
    
    // No valid context exists - try to load from storageState first, then login if needed
    const authFilePath = './auth.json';
    let shouldLoadFromStorage = false;
    
    // Try to load from auth.json if it exists (for browser restarts)
    if (fs.existsSync(authFilePath)) {
      try {
        const authData = JSON.parse(fs.readFileSync(authFilePath, 'utf8'));
        if (authData.cookies && authData.cookies.length > 0) {
          shouldLoadFromStorage = true;
          console.log('📂 Found auth.json, attempting to load session...');
        }
      } catch (e) {
        console.warn('⚠️ Could not read auth.json:', e.message);
      }
    }
    
    // Get or create browser
    const browser = await this.getBrowser();
    
    // Create context - try loading from storageState first
    const contextOptions = {
      userAgent: getRealisticUserAgent(),
      viewport: { width: 1280, height: 720 },
      locale: 'en-GB',
      timezoneId: 'Europe/London',
      permissions: [],
      colorScheme: 'light'
    };
    
    if (shouldLoadFromStorage) {
      try {
      this.browserContext = await browser.newContext({
          ...contextOptions,
          storageState: authFilePath
      });
        console.log('📂 Loaded browser context from auth.json');
      
        // Verify the loaded session by checking if we get redirected to login
      const testPage = await this.browserContext.newPage();
      try {
          await testPage.goto('https://takeabyte.co.uk/InContact', { 
            waitUntil: 'domcontentloaded', 
            timeout: 15000 
          });
          await testPage.waitForTimeout(2000); // Wait for any redirects
          
          // Check if we're redirected to login page (session expired indicator)
          const currentUrl = testPage.url();
          const isOnLoginPage = currentUrl.includes('/Account/Login');
          await testPage.close();
          
          if (isOnLoginPage) {
            console.log('⚠️ Loaded session from auth.json expired (redirected to login), will re-login');
              await this.browserContext.close();
            this.browserContext = null;
            shouldLoadFromStorage = false; // Force fresh login
          } else {
            console.log('✅ Loaded session from auth.json is valid');
            // Inject stealth script
            await this.browserContext.addInitScript(getStealthInitScript());
            return this.browserContext;
        }
      } catch (error) {
          await testPage.close().catch(() => {});
          console.log('⚠️ Could not verify loaded session, will re-login');
          await this.browserContext.close().catch(() => {});
          this.browserContext = null;
          shouldLoadFromStorage = false;
        }
      } catch (error) {
        console.warn('⚠️ Failed to load from auth.json, will create fresh context:', error.message);
          this.browserContext = null;
        shouldLoadFromStorage = false;
      }
    }
    
    // Create fresh context and login
      if (!this.browserContext) {
      console.log('🔐 Creating new browser context and logging in...');
      this.browserContext = await browser.newContext(contextOptions);
      
      // Inject stealth script to remove automation indicators
      await this.browserContext.addInitScript(getStealthInitScript());
      
      // Perform cookie-based login and save authentication state
      console.log('🔐 Performing cookie-based login and saving authentication state...');
      let loginPage = await this.browserContext.newPage();
      
      try {
        // Use cookie-based authentication instead of form-based login
        await this.loginToCRM(loginPage, 'context-init');
        
        // Save authentication state for future browser restarts
        await this.browserContext.storageState({ path: authFilePath });
        this.authenticatedPage = loginPage;
        console.log('✅ Cookie-based session established and saved');
        
      } catch (error) {
        console.error('❌ Cookie-based login failed:', error.message);
        
        // Close login page before throwing
        try {
          if (!loginPage.isClosed()) {
            await loginPage.close();
          }
        } catch (closeError) {
          console.warn('⚠️ Error closing login page after failure:', closeError.message);
        }
        
        // Close the context since login failed
        if (this.browserContext) {
          try {
            await this.browserContext.close();
            console.log('🧹 Closed browser context after login failure');
          } catch (closeError) {
            console.warn('⚠️ Error closing context after login failure:', closeError.message);
          }
          this.browserContext = null;
        }
        
        throw error;
      }
    }
    
    // Keep authenticated page open for reuse (session cookies remain active)
    // Keep authenticated page open for reuse (session cookies remain active)
    this.browserInitialized = true;
    return this.browserContext;
  }

  async getPublicContext() {
    // Get or create browser
    const browser = await this.getBrowser();
    
    // Create a new context without authentication (for public pages)
    const context = await browser.newContext({
      userAgent: this.crmCredentials.userAgent,
      viewport: { width: 1280, height: 720 }
    });
    
    return context;
  }

  async cleanup() {
    try {
      if (this.browserContext) {
        // Check if browser is still connected before trying to close context
        try {
          const browser = this.browserContext.browser();
          if (browser && browser.isConnected()) {
            await this.browserContext.close();
            console.log('🧹 Browser context closed');
          } else {
            console.log('🧹 Browser context already closed or disconnected');
          }
        } catch (error) {
          // Context might already be closed
          if (error.message.includes('closed') || error.message.includes('Target page')) {
            console.log('🧹 Browser context was already closed');
          } else {
            throw error;
          }
        }
        this.browserContext = null;
      }
      if (this.browserInstance) {
        try {
          if (this.browserInstance.isConnected()) {
            await this.browserInstance.close();
            console.log('🧹 Browser instance closed');
          } else {
            console.log('🧹 Browser instance already closed or disconnected');
          }
        } catch (error) {
          // Browser might already be closed
          if (error.message.includes('closed') || error.message.includes('Target page')) {
            console.log('🧹 Browser instance was already closed');
          } else {
            throw error;
          }
        }
        this.browserInstance = null;
      }
      this.browserInitialized = false;
    } catch (error) {
      console.error('❌ Error cleaning up browser:', error);
    }
  }

  async executeTask(task, args, callContext = {}, progressCallback = null) {
    const callSid = callContext.callSid || 'unknown';
    const executionKey = `${callSid}_${task}`;
    
    // Helper function to call progress callback if provided
    const reportProgress = (milestone, message, progress = null) => {
      if (progressCallback && typeof progressCallback === 'function') {
        try {
          progressCallback({ milestone, message, progress, timestamp: Date.now() });
        } catch (err) {
          console.warn(`⚠️ [${callSid}] Error in progress callback:`, err.message);
        }
      }
    };
    
    // Check if there's already an active execution for this call and task
    if (this.activeExecutions.has(executionKey)) {
      const activeExecution = this.activeExecutions.get(executionKey);
      const now = Date.now();
      const elapsedTime = now - activeExecution.startTime;
      const timeSinceHeartbeat = activeExecution.lastHeartbeat ? (now - activeExecution.lastHeartbeat) : elapsedTime;
      
      // If execution is stuck (exceeded timeout or no heartbeat), force clear it to allow retry
      if (elapsedTime > this.executionLockTimeout || timeSinceHeartbeat > this.executionHeartbeatInterval * 2) {
        console.warn(`⚠️ [${callSid}] Execution lock was stuck for ${Math.round(elapsedTime / 1000)}s (timeout: ${this.executionLockTimeout / 1000}s), force clearing to allow retry`);
        this.activeExecutions.delete(executionKey);
      } else {
        // SMART OVERRIDE: Handle cases where first call is waiting and second call has the needed information
        let shouldOverride = false;
        let overrideReason = '';
        
        // Case 1: Second call with agreedSlot while first call is in Step 1 (availability check)
        if (task === 'create_booking' && args.agreedSlot && activeExecution.phase === 'step1_availability') {
          shouldOverride = true;
          overrideReason = 'Second call with agreedSlot detected while first call is in Step 1 (prevents duplicate availability check)';
        }
        // Case 2: First call is waiting for preferences (bikeType, etc.) and second call has them
        else if (task === 'create_booking' && (activeExecution.phase === 'step7_booking_options' || activeExecution.phase === 'waiting_for_preferences')) {
          // Check if second call has preferences that first call might be missing
          if (args.bikeType || args.preferredDate || args.preferredTime || args.location || args.instructor) {
            shouldOverride = true;
            overrideReason = `Second call with preferences (bikeType, etc.) detected while first call is waiting for preferences (phase: ${activeExecution.phase})`;
          }
        }
        // Case 3: Second call has agreedSlot and first call is in early stages (before Step 6)
        else if (task === 'create_booking' && args.agreedSlot && 
                 (activeExecution.phase === 'step2_login' || 
                  activeExecution.phase === 'step3_workflow_type' || 
                  activeExecution.phase === 'step4_5_find_client' ||
                  activeExecution.phase === 'step4_select_session')) {
          shouldOverride = true;
          overrideReason = `Second call with agreedSlot detected while first call is in ${activeExecution.phase} (allows retry with complete information)`;
        }
        
        if (shouldOverride) {
          console.log(`🔄 [${callSid}] Smart override: ${overrideReason}`);
          
          // Signal cancellation to the first call
          if (activeExecution.cancelToken) {
            activeExecution.cancelToken.cancelled = true;
            activeExecution.cancelToken.reason = overrideReason;
          }
          
          // Clear the first execution lock
          this.activeExecutions.delete(executionKey);
          
          // Log the cancellation
          console.log(`✅ [${callSid}] First call cancelled. Proceeding with second call that has complete information.`);
        } else {
          console.log(`⚠️ [${callSid}] Task "${task}" is already running (started ${Math.round(elapsedTime / 1000)}s ago, last heartbeat: ${Math.round(timeSinceHeartbeat / 1000)}s ago, phase: ${activeExecution.phase || 'unknown'}). Rejecting concurrent execution.`);
        return {
          success: false,
          error: `Task "${task}" is already in progress for this call. Please wait for it to complete.`,
          dryRun: false
        };
      }
    }
    }
    
    // Create cancellation token for this execution
    const cancelToken = {
      cancelled: false,
      reason: null
    };
    
    // Mark execution as active with heartbeat tracking and phase
    this.activeExecutions.set(executionKey, {
      task,
      startTime: Date.now(),
      lastHeartbeat: Date.now(),
      phase: 'initializing', // Will be updated as workflow progresses
      cancelToken: cancelToken
    });
    
    // Check if this is an availability check (public page, no auth needed)
    // All availability checks use public URLs, so they don't need authentication
    const isAvailabilityCheck = (task === 'check_availability');
    
    let context;
    let shouldCloseContext = false; // Track if we need to close this context (not the pooled one)
    let page = null;
    const auditId = `audit_${Date.now()}_${callSid}`;
    
    try {
      // Get context - wrap in try-catch to handle errors early
    if (isAvailabilityCheck) {
      // For availability checks, use a browser context without authentication (public page)
      console.log('🌐 [Availability Check] Using browser without authentication for public availability page');
      context = await this.getPublicContext();
      shouldCloseContext = true; // Mark this context for cleanup since it's not the pooled one
    } else {
      // For other tasks (create_booking, reschedule, cancel, update_customer), use authenticated context
      context = await this.getContext(reportProgress);
    }
    
    // Track all pages for cleanup
    let testPage = null;
    let loginPage = null;
      
      // CRITICAL: For authenticated tasks, reuse authenticated page OR create new page from context
      // Both will have session cookies because cookies are stored in the browser context
      if (!isAvailabilityCheck && this.authenticatedPage && !this.authenticatedPage.isClosed()) {
        console.log('✅ Reusing authenticated page (cookies persist in context)');
        page = this.authenticatedPage;
        
        // Navigate if needed - cookies in context will persist
        const currentUrl = page.url();
        if (!currentUrl.includes('takeabyte.co.uk/InContact')) {
          await page.goto('https://takeabyte.co.uk/InContact', { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
          });
          await page.waitForTimeout(2000);
          
          // Check if redirected to login (session expired indicator)
          const newUrl = page.url();
          if (newUrl.includes('/Account/Login')) {
            console.warn('⚠️ Session expired - redirected to login, will re-login');
            await page.close();
            this.authenticatedPage = null;
            this.browserContext = null;
            // Re-get context (will trigger re-login)
            context = await this.getContext();
    page = await context.newPage();
            await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'domcontentloaded' });
          }
        }
      } else {
        // Create new page from context
        if (isAvailabilityCheck) {
          // For availability checks, just create page - service will navigate to availability URL
          console.log('📄 Creating new page for availability check (will navigate to availability URL)');
          page = await context.newPage();
          // Don't navigate here - let the ITM service navigate to availability URL
        } else {
          // For authenticated tasks, create page and navigate to CRM
          console.log('📄 Creating new page from authenticated context (cookies inherited from context)');
          page = await context.newPage();
          
          // Navigate to CRM - cookies from context will be used
          await page.goto('https://takeabyte.co.uk/InContact', { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
          });
          await page.waitForTimeout(2000);
          
          // Check if redirected to login (session expired indicator)
          const currentUrl = page.url();
          if (currentUrl.includes('/Account/Login')) {
            console.warn('⚠️ Session expired - new page redirected to login, will re-login');
            await page.close();
            this.browserContext = null;
            this.authenticatedPage = null;
            // Re-get context (will trigger re-login)
            context = await this.getContext();
            page = await context.newPage();
            await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'domcontentloaded' });
          } else {
            // Session is valid - store as authenticated page for future reuse
            if (!this.authenticatedPage) {
              this.authenticatedPage = page;
            }
          }
        }
      }
      // 🔍 VISIBILITY: Log tool invocation
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🔧 [CRM BROWSER TOOL] Invoked at ${new Date().toISOString()}`);
      console.log(`📞 Call SID: ${callContext.callSid || 'unknown'}`);
      console.log(`📋 Task: ${task}`);
      console.log(`📋 Course Type: ${args.courseType || 'not specified'}`);
      console.log(`📋 Customer: ${args.customerEmail || 'not specified'}`);
      console.log(`${'='.repeat(80)}\n`);
      
      console.log(`🤖 Browser agent executing task: ${task}`);
      
      // Send heartbeat to keep lock alive during long-running tasks
      const heartbeatInterval = setInterval(() => {
        const execution = this.activeExecutions.get(executionKey);
        if (execution) {
          execution.lastHeartbeat = Date.now();
        }
      }, this.executionHeartbeatInterval);
      
      try {
        // Route to course-specific service for create_booking
        if (task === 'create_booking' && args.courseType) {
          // Get cancelToken from execution lock for cancellation support
          const executionKey = `${callSid}_${task}`;
          const execution = this.activeExecutions.get(executionKey);
          const cancelToken = execution ? execution.cancelToken : null;
          
          return await this.executeCourseBooking(page, args, callContext, auditId, progressCallback, cancelToken, executionKey);
        }
        
        // Always start with dry-run for other tasks
        const dryRunResult = await this.executeDryRun(page, task, args, auditId);
        
        if (!dryRunResult.success) {
          return {
            success: false,
            error: dryRunResult.error,
            dryRun: true
          };
        }

        // If dry-run successful and task requires confirmation, return for user confirmation
        if (dryRunResult.requiresConfirmation) {
          return {
            success: true,
            result: dryRunResult.result,
            dryRun: true,
            requiresConfirmation: true,
            auditId
          };
        }

        // Execute actual task
        const result = await this.executeActualTask(page, task, args, auditId);
        
        return {
          success: result.success,
          result: result.result,
          dryRun: false,
          requiresConfirmation: false,
          auditId,
          screenshots: result.screenshots
        };
      } finally {
        // Always clear heartbeat interval
        clearInterval(heartbeatInterval);
      }

    } catch (error) {
      console.error(`❌ [${callSid}] Browser agent error:`, error);
      return {
        success: false,
        error: error.message,
        dryRun: true
      };
    } finally {
      // ALWAYS clean up pages and execution lock, even on error
      try {
        if (page && !page.isClosed()) {
          // CRITICAL: Do NOT close the authenticated page - we need to keep it open for session persistence
          if (page === this.authenticatedPage) {
            console.log(`✅ [${callSid}] Keeping authenticated page open for session persistence`);
          } else if (process.env.KEEP_BROWSER_OPEN !== 'true') {
            // Only close non-authenticated pages if not in debug mode
            await page.close();
          } else {
            console.log(`🔍 [${callSid}] Keeping page open for debugging (KEEP_BROWSER_OPEN=true)`);
          }
        }
      } catch (error) {
        console.warn(`⚠️ [${callSid}] Error closing page:`, error.message);
      }
      
      // Close the context if it was created for availability check (not the pooled one)
      if (shouldCloseContext && context) {
        try {
          await context.close();
          console.log(`🧹 [${callSid}] Closed public availability context`);
        } catch (error) {
          console.warn(`⚠️ [${callSid}] Error closing public availability context:`, error.message);
        }
      }
      
      // ALWAYS remove from active executions, even on error - this allows retries
      const execution = this.activeExecutions.get(executionKey);
      if (execution) {
        const elapsed = Date.now() - execution.startTime;
        if (elapsed > this.executionLockTimeout) {
          console.warn(`⚠️ [${callSid}] Execution lock exceeded timeout (${this.executionLockTimeout / 1000}s), force releasing`);
        }
        this.activeExecutions.delete(executionKey);
        console.log(`🧹 [${callSid}] Cleaned up execution lock and pages for task: ${task} (duration: ${Math.round(elapsed / 1000)}s)`);
      } else {
        console.warn(`⚠️ [${callSid}] Execution lock not found for key: ${executionKey}`);
      }
    }
  }

  async executeDryRun(page, task, args, auditId) {
    try {
      // For check_availability with ITM, skip login - it uses public availability page
      const courseType = args.courseType || '';
      const isITMAvailability = (task === 'check_availability' && 
                                (courseType === 'ITM' || courseType === 'Introduction to Motorcycling'));
      
      if (!isITMAvailability) {
        await this.loginToCRM(page, auditId);
      }
      
      switch (task) {
        case 'create_booking':
          return await this.dryRunCreateBooking(page, args, auditId);
        case 'reschedule_booking':
          return await this.dryRunRescheduleBooking(page, args, auditId);
        case 'cancel_booking':
          return await this.dryRunCancelBooking(page, args, auditId);
        case 'update_customer':
          return await this.dryRunUpdateCustomer(page, args, auditId);
        case 'check_availability':
          return await this.dryRunCheckAvailability(page, args, auditId);
        default:
          throw new Error(`Unknown task: ${task}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async executeActualTask(page, task, args, auditId) {
    try {
      switch (task) {
        case 'create_booking':
          return await this.createBooking(page, args, auditId);
        case 'reschedule_booking':
          return await this.rescheduleBooking(page, args, auditId);
        case 'cancel_booking':
          return await this.cancelBooking(page, args, auditId);
        case 'update_customer':
          return await this.updateCustomer(page, args, auditId);
        case 'check_availability':
          // Use common availability check for all course types
          const courseType = args.courseType || '';
          if (!courseType) {
            throw new Error('Course type is required for availability check');
          }
          
          console.log(`📚 [${auditId}] Checking availability for ${courseType}...`);
          const commonSteps = await import('./commonBookingSteps/index.js');
          
          // Extract preferences from args if provided
          const preferences = {
            preferredDate: args.preferredDate,
            preferredTime: args.preferredTime,
            location: args.location
          };
          
          const availability = await commonSteps.checkAvailabilityAndNoteDetails(page, courseType, this.screenshotsDir, preferences);
          const screenshot = await this.takeScreenshot(page, `${auditId}_${courseType.toLowerCase().replace(/\s+/g, '-')}_availability_check.png`);
          
          // Store availability data to file as fallback (for development/debugging)
          const availabilityCachePath = './availability-cache.json';
          try {
            // Extract callSid from auditId (format: audit_${timestamp}_${callSid})
            const callSidFromAuditId = auditId.split('_').slice(2).join('_') || 'unknown';
            
            const cacheData = {
              courseType: courseType,
              allSlots: availability.allSlots,
              selectedSlot: availability.selectedSlot,
              sessionDetails: availability.selectedSlot, // Keep for backward compatibility
              monthYear: availability.monthYear,
              timestamp: new Date().toISOString(),
              callSid: callSidFromAuditId
            };
            fs.writeFileSync(availabilityCachePath, JSON.stringify(cacheData, null, 2));
            console.log(`💾 [${auditId}] Stored availability data to ${availabilityCachePath} as fallback`);
          } catch (error) {
            console.warn(`⚠️ [${auditId}] Could not save availability cache:`, error.message);
          }
          
          return {
            success: true,
            result: {
              allSlots: availability.allSlots, // All available slots
              selectedSlot: availability.selectedSlot, // Best matching slot
              sessionDetails: availability.selectedSlot, // Keep for backward compatibility
              monthYear: availability.monthYear,
              ...availability.selectedSlot // Also include slot fields directly for easy access
            },
            screenshots: [screenshot]
          };
        default:
          throw new Error(`Unknown task: ${task}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async loginToCRM(page, auditId) {
    try {
      console.log('🔐 Logging into CRM...');
      
      // Step 1: Navigate to CRM_LOGIN_URL
      console.log('🔐 Navigating to CRM login URL...');
      await page.goto(this.crmCredentials.loginUrl);
      await page.waitForLoadState('networkidle');
      
      // Take screenshot of login page
      await this.takeScreenshot(page, `${auditId}_login_start.png`);
      
      // Step 2: Set authentication cookies
      console.log('🍪 Setting authentication cookies...');
      const crmHomeUrl = process.env.CRM_HOME_URL || 'https://takeabyte.co.uk/InContact';
      const loginUrlObj = new URL(this.crmCredentials.loginUrl);
      const domain = loginUrlObj.hostname;
      
      // Get cookie values from environment
      const cName = process.env.CRM_LOGIN_NAME || this.crmCredentials.loginName;
      const uName = process.env.CRM_USERNAME || this.crmCredentials.username;
      
      // Get .AspNetCore cookie values from environment
      const antiforgeryCookieValue = process.env.CRM_ANTIFORGERY_COOKIE;
      const aspNetCoreCookiesValue = process.env.CRM_SESSION_COOKIE;
      
      // Validate required cookies are present
      if (!antiforgeryCookieValue) {
        throw new Error('CRM_ANTIFORGERY_COOKIE environment variable is required');
      }
      if (!aspNetCoreCookiesValue) {
        throw new Error('CRM_SESSION_COOKIE environment variable is required');
      }
      
      // Set cookies using Playwright's context API
      await page.context().addCookies([
        {
          name: '.AspNetCore.Antiforgery.LaUgxCHdbb8',
          value: antiforgeryCookieValue,
          domain: domain,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Lax'
        },
        {
          name: '.AspNetCore.Cookies',
          value: aspNetCoreCookiesValue,
          domain: domain,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Lax'
        },
        {
          name: 'cName',
          value: cName,
          domain: domain,
          path: '/',
          httpOnly: false,
          secure: true,
          sameSite: 'Lax'
        },
        {
          name: 'uName',
          value: uName,
          domain: domain,
          path: '/',
          httpOnly: false,
          secure: true,
          sameSite: 'Lax'
        }
      ]);
      
      console.log('✅ Cookies set successfully');
      
      // Step 3: Navigate to CRM_HOME_URL and reload
      console.log('🔐 Navigating to CRM home URL...');
      await page.goto(crmHomeUrl, { waitUntil: 'networkidle' });
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      
      // Take screenshot after navigation
      await this.takeScreenshot(page, `${auditId}_login_attempted.png`);
      
      // Step 4: Verify we're on Contacts page
      try {
        // Wait for the sidebar to appear with Contacts tab
        await page.waitForSelector('h3.list-menu-item-heading:has-text("Contacts")', { timeout: 10000 });
        
        // Additional verification - check if login form is gone
        const stillOnLoginPage = await page.locator('#Loginname').isVisible({ timeout: 2000 }).catch(() => false);
        if (stillOnLoginPage) {
          throw new Error('Login failed - still on login page');
        }
        
        console.log('✅ CRM login successful - sidebar with Contacts tab found');
        
      } catch (verifyError) {
        console.log('⚠️ Login verification failed, but continuing...');
        // Don't throw error, just log and continue
      }
      
      await this.takeScreenshot(page, `${auditId}_login_success.png`);
      
    } catch (error) {
      console.error('❌ CRM login failed:', error);
      await this.takeScreenshot(page, `${auditId}_login_error.png`);
      throw new Error(`CRM login failed: ${error.message}`);
    }
  }

  async dryRunCreateBooking(page, args, auditId) {
    try {
      console.log(`🔍 [${auditId}] Dry run: Create booking for course type: ${args.courseType || 'unspecified'}`);
      
      const courseType = args.courseType || '';
      
      // For ITM bookings, the actual workflow handles everything including validation
      // So we just validate that courseType is provided and return success
      if (courseType === 'ITM' || courseType === 'Introduction to Motorcycling') {
        if (!args.customerEmail) {
          return {
            success: false,
            error: 'customerEmail is required for ITM booking'
          };
        }
        
        return {
          success: true,
          result: {
            action: 'create_booking',
            courseType: courseType,
            customerEmail: args.customerEmail,
            message: 'ITM booking dry-run validated - will proceed with full workflow'
          },
          requiresConfirmation: false // ITM workflow handles its own confirmation steps
        };
      }
      
      // For other course types, use generic validation (to be implemented)
      if (!courseType) {
        return {
          success: false,
          error: 'courseType is required for booking creation'
        };
      }
      
      return {
        success: true,
        result: {
          action: 'create_booking',
          courseType: courseType,
          message: `Dry-run validated for ${courseType} (implementation pending)`
        },
        requiresConfirmation: true
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async dryRunRescheduleBooking(page, args, auditId) {
    try {
      console.log(`🔍 [${auditId}] Dry run: Reschedule booking`);
      
      // Import common steps
      const commonSteps = await import('./commonBookingSteps/index.js');
      const feeCalculationService = (await import('./feeCalculationService.js')).default;
      
      // Step 1: Find customer and booking
      if (!args.customerEmail && !args.customerMobile && !args.customerPhone) {
        return {
          success: false,
          error: 'Customer email or mobile number is required to find booking'
        };
      }
      
      // Find customer first
      const searchType = args.customerMobile || args.customerPhone ? 'mobile' : 'email';
      const searchValue = args.customerMobile || args.customerPhone || args.customerEmail;
      
      const searchResult = await commonSteps.findAndVerifyClient(page, searchType, searchValue, this.screenshotsDir, args.customerEmail);
      
      if (!searchResult.found) {
        return {
          success: false,
          error: 'Customer not found. Please verify customer details.'
        };
      }
      
      // Find booking
      const iframe = page.frameLocator('#contactLookup_iframe');
      const bookingResult = await commonSteps.findBooking(page, iframe, this.screenshotsDir, args.bookingReference);
      
      if (!bookingResult.found || !bookingResult.bookings || bookingResult.bookings.length === 0) {
        return {
          success: false,
          error: args.bookingReference 
            ? `Booking with reference ${args.bookingReference} not found`
            : 'No bookings found for this customer'
        };
      }
      
      const existingBooking = args.bookingReference 
        ? bookingResult.bookings.find(b => b.bookingReference === args.bookingReference)
        : bookingResult.bookings[0];
      
      if (!existingBooking) {
        return {
          success: false,
          error: `Booking with reference ${args.bookingReference} not found`
        };
      }
      
      // Calculate reschedule fee
      const bookingPrice = this.extractPriceFromBooking(existingBooking) || 125; // Default price if not found
      const feeResult = feeCalculationService.calculateRescheduleFee(
        existingBooking.date,
        args.newDate,
        bookingPrice,
        existingBooking.courseType
      );
      
      await this.takeScreenshot(page, `${auditId}_reschedule_dryrun.png`);
      
      return {
        success: true,
        result: {
          action: 'reschedule_booking',
          bookingReference: existingBooking.bookingReference,
          currentBooking: {
            date: existingBooking.date,
            time: existingBooking.time,
            location: existingBooking.location,
            courseType: existingBooking.courseType
          },
          newBooking: {
            date: args.newDate,
            time: args.newTime || existingBooking.time,
            location: args.newLocation || existingBooking.location
          },
          fee: feeResult.fee,
          feePolicy: feeResult.policy
        },
        requiresConfirmation: true
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  extractPriceFromBooking(booking) {
    // Try to extract price from booking object or use default
    if (booking.price) {
      const match = String(booking.price).match(/[\d,]+\.?\d*/);
      if (match) {
        return parseFloat(match[0].replace(/,/g, ''));
      }
    }
    return null;
  }

  async dryRunCancelBooking(page, args, auditId) {
    try {
      console.log(`🔍 [${auditId}] Dry run: Cancel booking`);
      
      // Import common steps
      const commonSteps = await import('./commonBookingSteps/index.js');
      const feeCalculationService = (await import('./feeCalculationService.js')).default;
      
      // Step 1: Find customer and booking
      if (!args.customerEmail && !args.customerMobile && !args.customerPhone) {
        return {
          success: false,
          error: 'Customer email or mobile number is required to find booking'
        };
      }
      
      // Find customer first
      const searchType = args.customerMobile || args.customerPhone ? 'mobile' : 'email';
      const searchValue = args.customerMobile || args.customerPhone || args.customerEmail;
      
      const searchResult = await commonSteps.findAndVerifyClient(page, searchType, searchValue, this.screenshotsDir, args.customerEmail);
      
      if (!searchResult.found) {
        return {
          success: false,
          error: 'Customer not found. Please verify customer details.'
        };
      }
      
      // Find booking
      const iframe = page.frameLocator('#contactLookup_iframe');
      const bookingResult = await commonSteps.findBooking(page, iframe, this.screenshotsDir, args.bookingReference);
      
      if (!bookingResult.found || !bookingResult.bookings || bookingResult.bookings.length === 0) {
        return {
          success: false,
          error: args.bookingReference 
            ? `Booking with reference ${args.bookingReference} not found`
            : 'No bookings found for this customer'
        };
      }
      
      const existingBooking = args.bookingReference 
        ? bookingResult.bookings.find(b => b.bookingReference === args.bookingReference)
        : bookingResult.bookings[0];
      
      if (!existingBooking) {
        return {
          success: false,
          error: `Booking with reference ${args.bookingReference} not found`
        };
      }
      
      // Check if already cancelled
      if (existingBooking.status === 'cancelled') {
        return {
          success: false,
          error: 'Booking is already cancelled'
        };
      }
      
      // Calculate cancellation fee
      const bookingPrice = this.extractPriceFromBooking(existingBooking) || 125; // Default price if not found
      const feeResult = feeCalculationService.calculateCancellationFee(
        existingBooking.date,
        bookingPrice
      );
      
      await this.takeScreenshot(page, `${auditId}_cancel_booking_dryrun.png`);
      
      return {
        success: true,
        result: {
          action: 'cancel_booking',
          bookingReference: existingBooking.bookingReference,
          bookingDetails: {
            date: existingBooking.date,
            time: existingBooking.time,
            location: existingBooking.location,
            courseType: existingBooking.courseType,
            status: existingBooking.status
          },
          cancellationFee: feeResult.fee,
          refundAmount: feeResult.refundAmount,
          feePolicy: feeResult.policy,
          reason: args.reason || 'Customer request'
        },
        requiresConfirmation: true
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async dryRunUpdateCustomer(page, args, auditId) {
    try {
      console.log(`🔍 [${auditId}] Dry run: Update customer`);
      
      // Import common steps
      const commonSteps = await import('./commonBookingSteps/index.js');
      
      // Step 1: Find customer
      if (!args.customerEmail && !args.customerMobile && !args.customerPhone) {
        return {
          success: false,
          error: 'Customer email or mobile number is required to find customer'
        };
      }
      
      // Find customer
      const searchType = args.customerMobile || args.customerPhone ? 'mobile' : 'email';
      const searchValue = args.customerMobile || args.customerPhone || args.customerEmail;
      
      const searchResult = await commonSteps.findAndVerifyClient(page, searchType, searchValue, this.screenshotsDir, args.customerEmail);
      
      if (!searchResult.found) {
        return {
          success: false,
          error: 'Customer not found. Please verify customer details.'
        };
      }
      
      // Extract current values from client details
      const iframe = page.frameLocator('#contactLookup_iframe');
      const currentValues = {};
      
      if (args.email) {
        const emailField = iframe.locator('input[id*="email"], input[name*="email"], input[type="email"]').first();
        if (await emailField.count() > 0) {
          currentValues.email = await emailField.inputValue().catch(() => '');
        }
      }
      
      if (args.mobile || args.phone) {
        const mobileField = iframe.locator('input[id*="mobile_number"], input[id*="mobile"], input[name*="mobile"]').first();
        if (await mobileField.count() > 0) {
          currentValues.mobile = await mobileField.inputValue().catch(() => '');
        }
      }
      
      if (args.postcode) {
        const postcodeField = iframe.locator('input[id*="post_code"], input[id*="postcode"], input[name*="postcode"]').first();
        if (await postcodeField.count() > 0) {
          currentValues.postcode = await postcodeField.inputValue().catch(() => '');
        }
      }
      
      // Build updates list
      const updates = [];
      if (args.email) updates.push(`Email: ${currentValues.email || 'N/A'} → ${args.email}`);
      if (args.mobile || args.phone) updates.push(`Mobile: ${currentValues.mobile || 'N/A'} → ${args.mobile || args.phone}`);
      if (args.postcode) updates.push(`Postcode: ${currentValues.postcode || 'N/A'} → ${args.postcode}`);
      if (args.firstName) updates.push(`First Name: → ${args.firstName}`);
      if (args.surname) updates.push(`Surname: → ${args.surname}`);
      if (args.address) updates.push(`Address: → ${args.address}`);
      
      await this.takeScreenshot(page, `${auditId}_update_customer_dryrun.png`);
      
      return {
        success: true,
        result: {
          action: 'update_customer',
          currentValues: currentValues,
          newValues: {
            email: args.email,
            mobile: args.mobile || args.phone,
            postcode: args.postcode,
            firstName: args.firstName,
            surname: args.surname,
            address: args.address
          },
          updates: updates
        },
        requiresConfirmation: true
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async dryRunCheckAvailability(page, args, auditId) {
    try {
      console.log(`🔍 [${auditId}] Dry run: Check availability for ${args.courseType || 'unspecified'}`);
      
      const courseType = args.courseType || '';
      
      if (!courseType) {
        return {
          success: false,
          error: 'Course type is required for availability check'
        };
      }
      
      // Use common availability check function for all course types
      const commonSteps = await import('./commonBookingSteps/index.js');
      
      // Extract preferences from args if provided
      const preferences = {
        preferredDate: args.preferredDate,
        preferredTime: args.preferredTime,
        location: args.location
      };
      
      const availability = await commonSteps.checkAvailabilityAndNoteDetails(page, courseType, this.screenshotsDir, preferences);
      await this.takeScreenshot(page, `${auditId}_${courseType.toLowerCase().replace(/\s+/g, '-')}_availability_dryrun.png`);
      
      return {
        success: true,
        result: {
          action: 'check_availability',
          courseType: courseType,
          allSlots: availability.allSlots,
          selectedSlot: availability.selectedSlot,
          sessionDetails: availability.selectedSlot, // Keep for backward compatibility
          monthYear: availability.monthYear,
          availability: availability.selectedSlot // Keep for backward compatibility
        },
        requiresConfirmation: false
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Helper method to update execution phase
  updateExecutionPhase(executionKey, phase) {
    const execution = this.activeExecutions.get(executionKey);
    if (execution) {
      execution.phase = phase;
      execution.lastHeartbeat = Date.now();
    }
  }

  async executeCourseBooking(page, args, callContext, auditId, progressCallback = null, cancelToken = null, executionKey = null) {
    try {
      // Map course type to service module
      const courseServiceMap = {
        'ITM': () => import('./itmBookingService.js'),
        'Introduction to Motorcycling': () => import('./itmBookingService.js'),
        'CBT': () => import('./cbtBookingService.js'),
        'Compulsory Basic Training': () => import('./cbtBookingService.js'),
        'CBT Executive': () => import('./cbtExecutiveBookingService.js'),
        'CBT Executive 1-2-1': () => import('./cbtExecutiveBookingService.js'),
        'Private Lesson': () => import('./privateLessonBookingService.js'),
        'Gear Conversion': () => import('./gearConversionBookingService.js'),
        'TfL 1-2-1': () => import('./tflOneToOneBookingService.js'),
        'TfL 1-2-1 Motorcycle Skills': () => import('./tflOneToOneBookingService.js'),
        'TfL Beyond CBT': () => import('./tflBeyondCbtBookingService.js'),
        'TfL - Beyond CBT - Skills for Delivery Riders': () => import('./tflBeyondCbtBookingService.js'),
        'Full Licence Assessment': () => import('./fullLicenceAssessmentBookingService.js'),
        'Full Motorcycle Licence Assessment': () => import('./fullLicenceAssessmentBookingService.js')
      };

      const courseType = args.courseType;
      const serviceLoader = courseServiceMap[courseType];

      if (!serviceLoader) {
        return {
          success: false,
          error: `I'm sorry, but "${courseType}" is not a recognized course type. Please specify a valid course type.`,
          dryRun: true,
          requiresConfirmation: false,
          auditId,
          screenshots: [],
          courseType: args.courseType
        };
      }

      console.log(`📚 Loading booking service for course type: ${courseType}`);
      
      // CRITICAL: Reuse authenticated page OR create new page from context
      // Both will have session cookies because cookies are stored in browser context
      if (this.authenticatedPage && !this.authenticatedPage.isClosed()) {
        console.log('✅ Reusing authenticated page for booking (cookies persist in context)');
        page = this.authenticatedPage;
        
        // Navigate if needed - cookies in context will persist
        const currentUrl = page.url();
        if (!currentUrl.includes('takeabyte.co.uk/InContact')) {
          await page.goto('https://takeabyte.co.uk/InContact', { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
          });
          await page.waitForTimeout(2000);
          
          // Check if redirected to login (session expired indicator)
          const newUrl = page.url();
          if (newUrl.includes('/Account/Login')) {
            console.warn('⚠️ Session expired - redirected to login, will re-login');
            await page.close();
            this.authenticatedPage = null;
            this.browserContext = null;
            // Re-get context (will trigger re-login)
            const context = await this.getContext();
            page = await context.newPage();
            await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'domcontentloaded' });
          }
        }
      } else {
        // Create new page from context - it automatically inherits cookies from context
        console.log('📄 Creating new page from authenticated context (cookies inherited)');
        await page.goto('https://takeabyte.co.uk/InContact', { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        await page.waitForTimeout(2000);
        
        // Check if redirected to login (session expired indicator)
        const currentUrl = page.url();
        if (currentUrl.includes('/Account/Login')) {
          console.warn('⚠️ Session expired - new page redirected to login, will re-login');
          await page.close();
          this.browserContext = null;
          this.authenticatedPage = null;
          // Re-get context (will trigger re-login)
          const context = await this.getContext();
          page = await context.newPage();
          await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'domcontentloaded' });
        } else {
          // Session is valid - store as authenticated page for future reuse
          if (!this.authenticatedPage) {
            this.authenticatedPage = page;
          }
        }
      }
      
      // Trust that cookies in context work - no need to verify login status
      // Session expiration is detected by login redirect above
      
      // Define login indicators for checking authentication status
      const loginIndicators = [
        'text=/Dashboard|Contacts|Diaries/i',
        'h3.list-menu-item-heading:has-text("Contacts")',
        'h3.list-menu-item-heading:has-text("Dashboard")'
      ];
      
      let isAlreadyLoggedIn = false;
      
      for (const selector of loginIndicators) {
        try {
          isAlreadyLoggedIn = await page.locator(selector).first().isVisible({ timeout: 5000 }).catch(() => false);
          if (isAlreadyLoggedIn) {
            console.log(`✅ Found login indicator: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue to next indicator
        }
      }
      
      if (!isAlreadyLoggedIn) {
        // This should not happen if getContext() worked correctly
        console.warn('⚠️ Page appears not logged in, but context should be authenticated. Reloading page and waiting longer...');
        
        // Reload the page to ensure cookies are loaded
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
        
        // Check again with longer timeout
        for (const selector of loginIndicators) {
          try {
            isAlreadyLoggedIn = await page.locator(selector).first().isVisible({ timeout: 10000 }).catch(() => false);
            if (isAlreadyLoggedIn) {
              console.log(`✅ Found login indicator after reload: ${selector}`);
              break;
            }
          } catch (e) {
            // Continue to next indicator
          }
        }
        
        if (!isAlreadyLoggedIn) {
          // Last resort: check if we're redirected to login page
          const isOnLoginPage = await page.locator('#Loginname').isVisible({ timeout: 3000 }).catch(() => false);
          if (isOnLoginPage) {
            throw new Error('Context should be authenticated but page redirected to login. This indicates the session expired or cookies were not saved properly.');
          }
          throw new Error('Context should be authenticated but page is not logged in. This indicates an issue with getContext().');
        }
      } else {
        console.log('✅ Page confirmed logged in via authenticated context');
      }
      
      // Load course-specific service
      const serviceModule = await serviceLoader();
      const bookingService = serviceModule.default;

      // Determine workflowType intelligently
      let workflowType = args.workflowType;
      if (!workflowType) {
        // For ITM, don't auto-determine - let the booking service handle it after availability check
        // According to documentation: Step 1 (availability) comes before Step 3 (workflowType)
        if (courseType === 'ITM' || courseType === 'Introduction to Motorcycling') {
          // Don't set workflowType - let ITM booking service handle it in Step 3 after Step 1
          workflowType = undefined;
          console.log('📋 WorkflowType will be determined by ITM booking service after availability check (Step 1 → Step 3)');
        } else {
          // For other courses, auto-determine as before
        if (args.customerMobile || args.customerPhone || args.customerEmail) {
          workflowType = 'existing';
          console.log('📋 WorkflowType determined: existing (customer info available)');
        } else {
          workflowType = 'new';
          console.log('📋 WorkflowType determined: new (no customer info available)');
          }
        }
      } else {
        console.log(`📋 WorkflowType explicitly set: ${workflowType}`);
      }

      // CRITICAL: Check if we're resuming from a previous requiresPreferences response
      // If the previous call returned requiresPreferences with resumeFromStep, preserve it
      const { conversations } = await import('../shared/state.js');
      const conversation = conversations[callContext.callSid] || {};
      const previousResult = conversation.lastBookingResult || {};
      const resumeFromStep = previousResult.resumeFromStep;
      const resumeContext = previousResult.resumeContext;
      
      // Log resume detection for debugging
      if (resumeFromStep && resumeContext) {
        console.log(`🔄 [${auditId}] Detected resume from Step ${resumeFromStep} - will skip Steps 1-6`);
        console.log(`🔄 [${auditId}] Resume context:`, resumeContext);
      }
      
      // Prepare booking arguments
      const bookingArgs = {
        customerEmail: args.customerEmail,
        customerPhone: args.customerPhone,
        customerMobile: args.customerMobile || args.customerPhone, // Support both field names
        preferredDate: args.preferredDate,
        preferredTime: args.preferredTime,
        location: args.location,
        instructor: args.instructor, // Add instructor preference
        bikeType: args.bikeType,
        cbtType: args.cbtType, // For CBT: 'standard' or 'renewal'
        duration: args.duration, // For Gear Conversion: '2', '3', or '4'
        workflowType: workflowType,
        // CRITICAL: Include agreedSlot and selectedSlot if provided
        // This allows the booking service to skip availability check when slot is already agreed
        agreedSlot: args.agreedSlot,
        selectedSlot: args.selectedSlot,
        // CRITICAL: Include resume information if we're continuing from requiresPreferences
        resumeFromStep: resumeFromStep,
        resumeContext: resumeContext
      };
      
      // Retrieve availability data from conversation if available
      // Note: conversations and conversation are already declared above (lines 1480-1481)
      
      // Check if we have availability data and need to re-match with preferences
      if (conversation.lastAvailabilityCheck) {
        const availabilityData = conversation.lastAvailabilityCheck;
        
        // Handle new format (with allSlots and selectedSlot)
        if (availabilityData.allSlots && availabilityData.selectedSlot) {
          // Re-match with current preferences if they differ from what was used before
          const commonSteps = await import('./commonBookingSteps/index.js');
          const preferences = {
            preferredDate: args.preferredDate,
            preferredTime: args.preferredTime,
            location: args.location
          };
          
          // Check if preferences have changed
          const hasPreferences = preferences.preferredDate || preferences.preferredTime || preferences.location;
          if (hasPreferences) {
            // Re-select best matching slot with current preferences
            const selectedSlot = commonSteps.selectBestMatchingSlot(availabilityData.allSlots, preferences);
            bookingArgs.sessionDetails = selectedSlot;
            console.log('📅 Re-matched availability with current preferences');
          } else {
            // Use previously selected slot
            bookingArgs.sessionDetails = availabilityData.selectedSlot;
            console.log('📅 Using previously selected slot from availability check');
          }
        } else {
          // Handle old format (single sessionDetails object) - backward compatibility
          bookingArgs.sessionDetails = availabilityData.sessionDetails || availabilityData;
          console.log('📅 Using availability data from previous check (conversation state - old format)');
        }
      } else {
        // FALLBACK: Try to load from file cache (for development/debugging)
        const availabilityCachePath = './availability-cache.json';
        if (fs.existsSync(availabilityCachePath)) {
          try {
            const cacheData = JSON.parse(fs.readFileSync(availabilityCachePath, 'utf8'));
            // Check if cache is recent (within last 1 hour) and matches course type
            const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime();
            const oneHour = 60 * 60 * 1000;
            
            if (cacheAge < oneHour && (cacheData.sessionDetails || cacheData.selectedSlot)) {
              // Optionally check if course type matches (for multi-course scenarios)
              if (!cacheData.courseType || cacheData.courseType === args.courseType || 
                  args.courseType === 'Introduction to Motorcycling' && cacheData.courseType === 'ITM') {
                
                // Handle new format with preference matching
                if (cacheData.allSlots && cacheData.selectedSlot) {
                  const commonSteps = await import('./commonBookingSteps/index.js');
                  const preferences = {
                    preferredDate: args.preferredDate,
                    preferredTime: args.preferredTime,
                    location: args.location
                  };
                  
                  const hasPreferences = preferences.preferredDate || preferences.preferredTime || preferences.location;
                  if (hasPreferences) {
                    bookingArgs.sessionDetails = commonSteps.selectBestMatchingSlot(cacheData.allSlots, preferences);
                    console.log(`📅 Re-matched cached availability with preferences (${Math.round(cacheAge / 1000 / 60)} minutes old)`);
                  } else {
                    bookingArgs.sessionDetails = cacheData.selectedSlot;
                    console.log(`📅 Using cached selected slot (${Math.round(cacheAge / 1000 / 60)} minutes old)`);
                  }
                } else {
                  // Old format
                  bookingArgs.sessionDetails = cacheData.sessionDetails;
                  console.log(`📅 Using availability data from file cache (${Math.round(cacheAge / 1000 / 60)} minutes old)`);
                }
                
                console.log(`📅 Cache course type: ${cacheData.courseType}, Requested: ${args.courseType}`);
              } else {
                console.warn(`⚠️ [${auditId}] Cache exists but course type mismatch: cache=${cacheData.courseType}, requested=${args.courseType}`);
              }
            } else {
              console.warn(`⚠️ [${auditId}] Cache exists but is too old (${Math.round(cacheAge / 1000 / 60)} minutes)`);
            }
          } catch (error) {
            console.warn(`⚠️ [${auditId}] Could not read availability cache:`, error.message);
          }
        }
        
        if (!bookingArgs.sessionDetails) {
          console.warn(`⚠️ [${auditId}] No availability data found in conversation state or file cache`);
        }
      }
      
      // Ensure callContext has clientDetails if available from previous search
      if (args.clientDetails) {
        callContext.clientDetails = args.clientDetails;
      }

      // Ensure callSid is in callContext for state tracking
      const callSid = callContext.callSid || 'unknown';
      if (!callContext.callSid) {
        callContext.callSid = callSid;
      }

      // Check if client verification is required (for existing clients)
      if (bookingArgs.workflowType === 'existing' && callContext.clientDetails && !callContext.clientVerified) {
        return {
          success: false,
          requiresVerification: true,
          clientDetails: callContext.clientDetails,
          message: 'Client found but requires verbal verification before proceeding with booking. Please use the client_verification tool first.',
          dryRun: true,
          requiresConfirmation: false,
          auditId,
          screenshots: [],
          courseType: args.courseType
        };
      }

      // Perform policy check before booking (per prompt_2.txt requirement)
      try {
        const { performPolicyCheck } = await import('./policyCheckService.js');
        const fileSearchTool = await import('../tools/fileSearch.js').then(m => m.default);
        const policyCheckResult = await performPolicyCheck(fileSearchTool, args.courseType, callContext);
        
        if (policyCheckResult.success && policyCheckResult.policyResults) {
          callContext.policyCheck = policyCheckResult.policyResults;
          console.log(`📋 [${auditId}] Policy check completed for ${args.courseType}`);
        } else {
          console.warn(`⚠️ [${auditId}] Policy check failed or incomplete:`, policyCheckResult.error);
        }
      } catch (policyError) {
        console.warn(`⚠️ [${auditId}] Policy check error (non-critical):`, policyError.message);
        // Don't fail booking if policy check fails
      }

      if (progressCallback) {
        progressCallback({ milestone: 'form_filling_started', message: 'Filling in booking details...', progress: 50 });
      }
      
      // Execute workflow - all services now use executeBookingWorkflow
      // Pass cancelToken and executionKey for phase tracking and cancellation support
      const result = await bookingService.executeBookingWorkflow(page, bookingArgs, callContext, cancelToken, executionKey, (phase) => {
        // Phase update callback - update execution lock phase
        if (executionKey) {
          this.updateExecutionPhase(executionKey, phase);
        }
      });
      
      // Log the result to debug workflow return values
      console.log(`📋 [${auditId}] ITM booking workflow result:`, {
        success: result.success,
        cancelled: result.cancelled || false,
        requiresWorkflowType: result.requiresWorkflowType,
        requiresVerification: result.requiresVerification,
        requiresPreferences: result.requiresPreferences,
        requiresCustomerInfo: result.requiresCustomerInfo,
        retryPrompt: result.retryPrompt ? 'present' : 'absent',
        error: result.error ? result.error.substring(0, 100) : 'none',
        message: result.message ? result.message.substring(0, 100) : 'none'
      });
      
      // If workflow was cancelled, return early with cancellation status
      // This allows the second call (with agreedSlot) to proceed
      // CRITICAL: Make it clear this is NOT booking completion - just a workflow replacement
      if (result.cancelled) {
        console.log(`🛑 [${auditId}] Workflow was cancelled - this is expected when replaced by a call with agreedSlot`);
        return {
          success: false,
          cancelled: true,
          message: result.message || 'The previous booking request was replaced by a new request with complete information. The booking is NOT complete - please wait for the new request to finish.',
          dryRun: true,
          requiresConfirmation: false,
          auditId,
          screenshots: result.screenshots || [],
          courseType: args.courseType,
          // CRITICAL: Add explicit flag to prevent agent from declaring booking complete
          isCancellation: true,
          bookingNotComplete: true
        };
      }
      
      if (progressCallback) {
        // CRITICAL: Only declare "Booking confirmed" if:
        // 1. result.success is true AND
        // 2. Payment is completed (paymentCompleted: true OR confirmationEmailSent: true) AND
        // 3. No structured response flags are present (not waiting for anything) AND
        // 4. Not a cancellation
        const paymentIsComplete = result.paymentCompleted === true || result.confirmationEmailSent === true;
        const isActuallyComplete = result.success && 
                                   paymentIsComplete && // CRITICAL: Payment must be completed
                                   !result.requiresVerification &&
                                   !result.requiresPreferences &&
                                   !result.requiresWorkflowType &&
                                   !result.requiresBookingContinuation &&
                                   !result.requiresCustomerInfo &&
                                   !result.requiresSlotSelection &&
                                   !result.cancelled &&
                                   !result.isCancellation;
        
        if (isActuallyComplete) {
          // CRITICAL: Only send "Booking confirmed" when payment is actually completed
          progressCallback({ milestone: 'confirmation_completed', message: 'Booking confirmed', progress: 100 });
        } else if (result.success && !paymentIsComplete) {
          // Success but payment not completed yet - explicitly say NOT confirmed
          progressCallback({ milestone: 'payment_pending', message: 'Processing payment - booking not yet confirmed', progress: 80 });
        } else if (result.success) {
          // Success but still waiting for something - explicitly say NOT confirmed
          progressCallback({ milestone: 'form_filling_completed', message: 'Details entered - booking not yet confirmed', progress: 70 });
        } else {
          // Not successful - explicitly say NOT confirmed
          progressCallback({ milestone: 'form_filling_completed', message: 'Details entered - booking not yet confirmed', progress: 70 });
        }
      }

      // If result indicates verification is required, return it with verification prompt
      if (result.requiresVerification) {
        return {
          success: false,
          requiresVerification: true,
          verificationPrompt: result.verificationPrompt,
          clientDetails: result.clientDetails || callContext.clientDetails,
          message: result.verificationPrompt || result.message || 'Client found but requires verbal verification before proceeding with booking.',
          dryRun: true,
          requiresConfirmation: false,
          auditId,
          screenshots: result.screenshots || [],
          courseType: args.courseType
        };
      }

      // If result indicates preferences are required, return it with preference prompt
      // IMPORTANT: Clear execution lock when returning requiresPreferences so retry with preferences can proceed immediately
      if (result.requiresPreferences) {
        // Clear execution lock to allow immediate retry with preferences
        // The page stays open (authenticated page), so the retry can continue from where it left off
        if (executionKey) {
          const execution = this.activeExecutions.get(executionKey);
          if (execution) {
            console.log(`🔄 [${auditId}] Clearing execution lock for requiresPreferences - allowing immediate retry with preferences`);
            this.activeExecutions.delete(executionKey);
          }
        }
        
        // CRITICAL: Store resume information in conversation state for next continuation call
        if (result.resumeFromStep && result.resumeContext) {
          const { conversations } = await import('../shared/state.js');
          if (!conversations[callContext.callSid]) {
            conversations[callContext.callSid] = {};
          }
          conversations[callContext.callSid].lastBookingResult = {
            resumeFromStep: result.resumeFromStep,
            resumeContext: result.resumeContext,
            requiresPreferences: true,
            missingPreferences: result.missingPreferences || []
          };
          console.log(`💾 [${auditId}] Stored resume information in conversation state (resumeFromStep: ${result.resumeFromStep})`);
        }
        
        return {
          success: false,
          requiresPreferences: true,
          missingPreferences: result.missingPreferences || [],
          message: result.message || 'I need some additional information to proceed with your booking.',
          validOptions: result.validOptions || {},
          dryRun: true,
          requiresConfirmation: false,
          auditId,
          screenshots: result.screenshots || [],
          courseType: args.courseType,
          sessionDetails: result.sessionDetails,
          // CRITICAL: Include resume information in return value
          resumeFromStep: result.resumeFromStep,
          resumeContext: result.resumeContext
        };
      }

      // If result indicates retry prompt (mobile search), return it
      if (result.retryPrompt) {
        return {
          success: false,
          requiresCustomerInfo: true,
          retryPrompt: result.retryPrompt,
          message: result.retryPrompt,
          dryRun: true,
          requiresConfirmation: false,
          auditId,
          screenshots: result.screenshots || [],
          courseType: args.courseType
        };
      }

      // If result indicates workflowType is required (ITM bookings), return it
      // Check this BEFORE the generic error handler to ensure it's not lost
      if (result && (result.requiresWorkflowType === true || result.requiresWorkflowType === 'true')) {
        // Clear execution lock to allow immediate retry with workflowType
        // The page stays open (authenticated page), so the retry can continue from where it left off
        if (executionKey) {
          const execution = this.activeExecutions.get(executionKey);
          if (execution) {
            console.log(`🔄 [${auditId}] Clearing execution lock for requiresWorkflowType - allowing immediate retry with workflowType`);
            this.activeExecutions.delete(executionKey);
          }
        }
        
        console.log(`✅ [${auditId}] Detected requiresWorkflowType: true, returning structured response`);
        return {
          success: false,
          requiresWorkflowType: true,
          message: result.message || 'I need to know if you have done training with us before. Have you done training with Universal Motorcycle Training before?',
          sessionDetails: result.sessionDetails,
          dryRun: true,
          requiresConfirmation: false,
          auditId,
          screenshots: result.screenshots || [],
          courseType: args.courseType
        };
      }

      // If result indicates failure, return it gracefully
      // BUT only if it's not a structured response that should be handled above
      if (!result.success && !result.requiresWorkflowType && !result.requiresVerification && !result.requiresPreferences && !result.retryPrompt) {
        // Log the actual error for debugging
        console.error(`❌ [${auditId}] Course booking failed:`, result.error);
        if (result.technicalError) {
          console.error(`❌ [${auditId}] Technical error:`, result.technicalError);
        }
        if (result.error && result.error.stack) {
          console.error(`❌ [${auditId}] Error stack:`, result.error.stack);
        }
        
        return {
          success: false,
          error: result.error || 'An unexpected error occurred during booking',
          technicalError: result.technicalError || result.error,
          dryRun: result.dryRun !== undefined ? result.dryRun : true,
          requiresConfirmation: false,
          auditId,
          screenshots: result.screenshots || [],
          courseType: args.courseType
        };
      }

      // CRITICAL: Clear resume information if booking completed successfully
      if (result.success && !result.requiresPreferences && !result.requiresVerification && !result.requiresWorkflowType) {
        const { conversations } = await import('../shared/state.js');
        if (conversations[callContext.callSid] && conversations[callContext.callSid].lastBookingResult) {
          console.log(`🧹 [${auditId}] Clearing resume information - booking completed successfully`);
          delete conversations[callContext.callSid].lastBookingResult;
        }
      }

      // Send email confirmation if booking was successful and customer email is available
      if (result.success && args.customerEmail) {
        try {
          const emailService = (await import('./emailService.js')).default;
          const { getTemplate } = await import('./emailTemplates.js');
          
          // Extract booking details from result if available
          const bookingDetails = result.sessionDetails || result.result || {};
          const templateData = {
            customerName: args.customerName || bookingDetails.customerName || 'Customer',
            bookingReference: bookingDetails.bookingReference || args.bookingReference || 'N/A',
            courseType: args.courseType || bookingDetails.courseType || 'N/A',
            date: args.bookingDate || bookingDetails.date || 'N/A',
            time: args.bookingTime || bookingDetails.time || 'N/A',
            centre: args.centre || bookingDetails.centre || 'N/A',
            address: bookingDetails.address,
            policyNote: callContext.policyCheck?.policyNote
          };

          // Send booking confirmation email (non-blocking)
          emailService.sendTemplateEmail(
            'booking_confirmation',
            templateData,
            args.customerEmail
          ).then(emailResult => {
            if (emailResult.success) {
              console.log(`✅ [${auditId}] Booking confirmation email sent to ${args.customerEmail}`);
            } else {
              console.warn(`⚠️ [${auditId}] Failed to send booking confirmation email: ${emailResult.error}`);
            }
          }).catch(emailError => {
            console.warn(`⚠️ [${auditId}] Error sending booking confirmation email (non-critical):`, emailError.message);
          });
        } catch (emailServiceError) {
          // Don't fail booking if email service fails
          console.warn(`⚠️ [${auditId}] Could not send booking confirmation email (non-critical):`, emailServiceError.message);
        }
      }

      return {
        success: result.success,
        result: result.result || result,
        dryRun: false,
        requiresConfirmation: false,
        auditId,
        screenshots: result.screenshots || [],
        courseType: args.courseType
      };

    } catch (error) {
      console.error('❌ Course booking execution failed:', error);
      await this.takeScreenshot(page, `${auditId}_course_booking_error.png`);
      
      // Return error gracefully with user-friendly message
      const errorContext = getErrorContext(error, 'create_booking');
      const userFriendlyError = formatUserFriendlyError(error, errorContext);
      
      return {
        success: false,
        error: userFriendlyError,
        technicalError: error.message, // Keep technical error for logging
        dryRun: true,
        requiresConfirmation: false,
        auditId,
        screenshots: [],
        courseType: args.courseType
      };
    }
  }

  async createBooking(page, args, auditId) {
    // This method is kept for backward compatibility
    // Actual booking creation is handled by executeCourseBooking
    console.log('✅ Creating booking...');
    return { success: true, result: 'Booking created successfully' };
  }

  async rescheduleBooking(page, args, auditId) {
    try {
      console.log(`✅ [${auditId}] Rescheduling booking...`);
      
      // Import common steps
      const commonSteps = await import('./commonBookingSteps/index.js');
      
      // Find customer and booking (same as dry-run)
      if (!args.customerEmail && !args.customerMobile && !args.customerPhone) {
        throw new Error('Customer email or mobile number is required');
      }
      
      const searchType = args.customerMobile || args.customerPhone ? 'mobile' : 'email';
      const searchValue = args.customerMobile || args.customerPhone || args.customerEmail;
      
      const searchResult = await commonSteps.findAndVerifyClient(page, searchType, searchValue, this.screenshotsDir, args.customerEmail);
      
      if (!searchResult.found) {
        throw new Error('Customer not found');
      }
      
      const iframe = page.frameLocator('#contactLookup_iframe');
      const bookingResult = await commonSteps.findBooking(page, iframe, this.screenshotsDir, args.bookingReference);
      
      if (!bookingResult.found || !bookingResult.bookings || bookingResult.bookings.length === 0) {
        throw new Error(args.bookingReference ? `Booking ${args.bookingReference} not found` : 'No bookings found');
      }
      
      const existingBooking = args.bookingReference 
        ? bookingResult.bookings.find(b => b.bookingReference === args.bookingReference)
        : bookingResult.bookings[0];
      
      if (!existingBooking) {
        throw new Error(`Booking ${args.bookingReference} not found`);
      }
      
      // Execute reschedule
      const result = await commonSteps.rescheduleBooking(page, iframe, args, existingBooking, this.screenshotsDir);
      
      if (result.success) {
        await this.takeScreenshot(page, `${auditId}_reschedule_success.png`);
        return {
          success: true,
          result: result.result,
          screenshots: [`${auditId}_reschedule_success.png`]
        };
      } else {
        throw new Error(result.error || 'Reschedule failed');
      }
      
    } catch (error) {
      console.error(`❌ [${auditId}] Reschedule booking error:`, error);
      await this.takeScreenshot(page, `${auditId}_reschedule_error.png`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async cancelBooking(page, args, auditId) {
    try {
      console.log(`✅ [${auditId}] Cancelling booking...`);
      
      // Import common steps
      const commonSteps = await import('./commonBookingSteps/index.js');
      
      // Find customer and booking (same as dry-run)
      if (!args.customerEmail && !args.customerMobile && !args.customerPhone) {
        throw new Error('Customer email or mobile number is required');
      }
      
      const searchType = args.customerMobile || args.customerPhone ? 'mobile' : 'email';
      const searchValue = args.customerMobile || args.customerPhone || args.customerEmail;
      
      const searchResult = await commonSteps.findAndVerifyClient(page, searchType, searchValue, this.screenshotsDir, args.customerEmail);
      
      if (!searchResult.found) {
        throw new Error('Customer not found');
      }
      
      const iframe = page.frameLocator('#contactLookup_iframe');
      const bookingResult = await commonSteps.findBooking(page, iframe, this.screenshotsDir, args.bookingReference);
      
      if (!bookingResult.found || !bookingResult.bookings || bookingResult.bookings.length === 0) {
        throw new Error(args.bookingReference ? `Booking ${args.bookingReference} not found` : 'No bookings found');
      }
      
      const existingBooking = args.bookingReference 
        ? bookingResult.bookings.find(b => b.bookingReference === args.bookingReference)
        : bookingResult.bookings[0];
      
      if (!existingBooking) {
        throw new Error(`Booking ${args.bookingReference} not found`);
      }
      
      // Execute cancellation
      const result = await commonSteps.cancelBooking(page, iframe, args, existingBooking, this.screenshotsDir);
      
      if (result.success) {
        await this.takeScreenshot(page, `${auditId}_cancel_success.png`);
        return {
          success: true,
          result: result.result,
          screenshots: [`${auditId}_cancel_success.png`]
        };
      } else {
        throw new Error(result.error || 'Cancellation failed');
      }
      
    } catch (error) {
      console.error(`❌ [${auditId}] Cancel booking error:`, error);
      await this.takeScreenshot(page, `${auditId}_cancel_error.png`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateCustomer(page, args, auditId) {
    try {
      console.log(`✅ [${auditId}] Updating customer...`);
      
      // Import common steps
      const commonSteps = await import('./commonBookingSteps/index.js');
      
      // Find customer
      if (!args.customerEmail && !args.customerMobile && !args.customerPhone) {
        throw new Error('Customer email or mobile number is required');
      }
      
      const searchType = args.customerMobile || args.customerPhone ? 'mobile' : 'email';
      const searchValue = args.customerMobile || args.customerPhone || args.customerEmail;
      
      const searchResult = await commonSteps.findAndVerifyClient(page, searchType, searchValue, this.screenshotsDir, args.customerEmail);
      
      if (!searchResult.found) {
        throw new Error('Customer not found');
      }
      
      const iframe = page.frameLocator('#contactLookup_iframe');
      
      // Execute update
      const result = await commonSteps.updateCustomer(page, iframe, args, this.screenshotsDir);
      
      if (result.success) {
        await this.takeScreenshot(page, `${auditId}_update_customer_success.png`);
        return {
          success: true,
          result: result.result,
          screenshots: [`${auditId}_update_customer_success.png`]
        };
      } else {
        throw new Error(result.error || 'Update failed');
      }
      
    } catch (error) {
      console.error(`❌ [${auditId}] Update customer error:`, error);
      await this.takeScreenshot(page, `${auditId}_update_customer_error.png`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async checkAvailability(page, args, auditId) {
    // Implementation for actual availability check
    console.log('✅ Checking availability...');
    // Add actual implementation here
    return { success: true, result: 'Availability checked successfully' };
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

  async takeScreenshot(page, filename) {
    try {
      const screenshotPath = path.join(this.screenshotsDir, filename);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 Screenshot saved: ${filename}`);
    } catch (error) {
      console.error('Screenshot error:', error);
    }
  }

  async saveAuditLog(auditId, action, result) {
    try {
      const auditLog = {
        auditId,
        timestamp: new Date().toISOString(),
        action,
        result,
        screenshots: fs.readdirSync(this.screenshotsDir)
          .filter(file => file.startsWith(auditId))
      };
      
      const logPath = path.join(this.auditDir, `${auditId}.json`);
      fs.writeFileSync(logPath, JSON.stringify(auditLog, null, 2));
      
      console.log(`📝 Audit log saved: ${auditId}`);
    } catch (error) {
      console.error('Audit log error:', error);
    }
  }
}

export default new BrowserAgentService();

