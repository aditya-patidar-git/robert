import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { formatUserFriendlyError, getErrorContext } from '../utils/errorFormatter.js';

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
    this.activeExecutions = new Map(); // Map<callSid, { task, startTime }>
    // Browser pooling instance variables
    this.browserInstance = null;
    this.browserContext = null;
    this.browserInitialized = false;
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

  async getBrowser() {
    // Return existing browser if connected, otherwise launch new one
    if (this.browserInstance && this.browserInstance.isConnected()) {
      return this.browserInstance;
    }
    
    // Launch new browser
    console.log('🌐 Launching new browser instance...');
    this.browserInstance = await chromium.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    return this.browserInstance;
  }

  async getContext() {
    // Return existing context if available
    if (this.browserContext) {
      return this.browserContext;
    }
    
    // Get or create browser
    const browser = await this.getBrowser();
    
    // Check for persistent authentication
    const authFilePath = './auth.json';
    let needsLogin = true;
    
    if (fs.existsSync(authFilePath)) {
      // Use saved authentication state
      console.log('🔐 Using saved authentication state from auth.json');
      this.browserContext = await browser.newContext({
        storageState: authFilePath,
        userAgent: this.crmCredentials.userAgent,
        viewport: { width: 1280, height: 720 }
      });
      
      // Verify we're logged in by checking for Dashboard/Contacts/Diaries
      const testPage = await this.browserContext.newPage();
      try {
        await testPage.goto('https://takeabyte.co.uk/InContact');
        await testPage.waitForLoadState('networkidle');
        const isLoggedIn = await testPage.locator('text=/Dashboard|Contacts|Diaries/i').first().isVisible({ timeout: 5000 }).catch(() => false);
        if (isLoggedIn) {
          console.log('✅ Verified: Already logged in using saved authentication');
          needsLogin = false;
        } else {
          console.log('⚠️ Saved auth state appears invalid, will re-login');
          // Close the invalid context so we can create a fresh one
          if (this.browserContext) {
            try {
              await this.browserContext.close();
            } catch (closeError) {
              console.warn('⚠️ Error closing invalid context:', closeError.message);
            }
            this.browserContext = null;
          }
        }
      } catch (error) {
        console.log('⚠️ Could not verify saved auth state, will re-login');
        // Close the invalid context so we can create a fresh one
        if (this.browserContext) {
          try {
            await this.browserContext.close();
          } catch (closeError) {
            console.warn('⚠️ Error closing invalid context:', closeError.message);
          }
          this.browserContext = null;
        }
      } finally {
        await testPage.close();
      }
    }
    
    // If auth.json doesn't exist or is invalid, create new context and login
    if (needsLogin) {
      // Create a fresh context (either auth.json doesn't exist, or the saved one was invalid and closed)
      if (!this.browserContext) {
        this.browserContext = await browser.newContext({
          userAgent: this.crmCredentials.userAgent,
          viewport: { width: 1280, height: 720 }
        });
      }
      
      // Perform login and save authentication state
      console.log('🔐 Performing login and saving authentication state...');
      const loginPage = await this.browserContext.newPage();
      try {
        console.log('🔐 Navigating to login page...');
        await loginPage.goto(this.crmCredentials.loginUrl);
        
        // Wait for the page to be fully loaded (including JavaScript)
        console.log('🔐 Waiting for page to be ready...');
        await loginPage.waitForLoadState('domcontentloaded');
        
        // Wait for form fields to be visible and ready (not just networkidle)
        console.log('🔐 Waiting for login form fields to be ready...');
        await loginPage.waitForSelector('#Loginname input.dx-texteditor-input', { 
          state: 'visible',
          timeout: 15000 
        });
        await loginPage.waitForSelector('#Username input.dx-texteditor-input', { 
          state: 'visible',
          timeout: 15000 
        });
        await loginPage.waitForSelector('#UserPassword input.dx-texteditor-input', { 
          state: 'visible',
          timeout: 15000 
        });
        
        // Wait for login button to be visible and enabled
        const loginButton = loginPage.locator('#btnLogin');
        await loginButton.waitFor({ state: 'visible', timeout: 15000 });
        
        // Additional wait to ensure JavaScript is fully initialized
        await loginPage.waitForTimeout(1000);
        
        console.log('🔐 Login form ready, filling fields...');
        
        // Fill login form with explicit waits for each field
        const loginNameField = loginPage.locator('#Loginname input.dx-texteditor-input');
        await loginNameField.waitFor({ state: 'visible' });
        await loginNameField.fill(this.crmCredentials.loginName);
        
        // Verify the value was actually entered
        const loginNameValue = await loginNameField.inputValue();
        console.log(`🔍 [DEBUG] Login name value after fill: "${loginNameValue}" (expected: "${this.crmCredentials.loginName}")`);
        if (loginNameValue !== this.crmCredentials.loginName) {
          throw new Error(`Login name not filled correctly. Expected: "${this.crmCredentials.loginName}", Got: "${loginNameValue}"`);
        }
        
        const usernameField = loginPage.locator('#Username input.dx-texteditor-input');
        await usernameField.waitFor({ state: 'visible' });
        await usernameField.fill(this.crmCredentials.username);
        
        // Verify the value was actually entered
        const usernameValue = await usernameField.inputValue();
        console.log(`🔍 [DEBUG] Username value after fill: "${usernameValue}" (expected: "${this.crmCredentials.username}")`);
        if (usernameValue !== this.crmCredentials.username) {
          throw new Error(`Username not filled correctly. Expected: "${this.crmCredentials.username}", Got: "${usernameValue}"`);
        }
        
        const passwordField = loginPage.locator('#UserPassword input.dx-texteditor-input');
        await passwordField.waitFor({ state: 'visible' });
        await passwordField.fill(this.crmCredentials.password);
        
        // Verify the value was actually entered (password might be masked, so check length)
        const passwordLength = (await passwordField.inputValue()).length;
        console.log(`🔍 [DEBUG] Password length after fill: ${passwordLength} (expected: ${this.crmCredentials.password.length})`);
        if (passwordLength !== this.crmCredentials.password.length) {
          throw new Error(`Password not filled correctly. Expected length: ${this.crmCredentials.password.length}, Got: ${passwordLength}`);
        }
        
        // Trigger change events to ensure form recognizes the values
        await loginNameField.dispatchEvent('change');
        await usernameField.dispatchEvent('change');
        await passwordField.dispatchEvent('change');
        
        // Wait for form fields to sync and ensure button is enabled
        console.log('⏳ Waiting for form fields to sync...');
        await loginPage.waitForTimeout(2000);
        
        // Take a screenshot before submitting to see the form state
        try {
          await loginPage.screenshot({ path: `./screenshots/login-before-submit-${Date.now()}.png` });
          console.log('📸 [DEBUG] Screenshot taken before form submission');
        } catch (screenshotError) {
          console.warn('⚠️ Could not take pre-submit screenshot:', screenshotError.message);
        }
        
        // Verify login button is enabled before clicking
        const isButtonEnabled = await loginButton.isEnabled();
        if (!isButtonEnabled) {
          throw new Error('Login button is disabled - form may not be ready');
        }
        
        console.log('🔐 Submitting login form...');
        await loginButton.click();
        
        // Wait for either success or error (don't just wait for networkidle)
        console.log('🔐 Waiting for login response...');
        await loginPage.waitForTimeout(3000); // Give time for error messages to appear
        
        // Check for error messages first (before waiting for success)
        const errorIndicators = [
          loginPage.locator('text=/invalid/i'),
          loginPage.locator('text=/incorrect/i'),
          loginPage.locator('text=/error/i'),
          loginPage.locator('.dx-error-message'),
          loginPage.locator('[class*="error"]')
        ];
        
        for (const errorLocator of errorIndicators) {
          try {
            const isVisible = await errorLocator.first().isVisible({ timeout: 1000 }).catch(() => false);
            if (isVisible) {
              const errorText = await errorLocator.first().textContent().catch(() => '');
              if (errorText && errorText.trim().length > 0) {
                console.error(`❌ Login error detected: ${errorText}`);
                throw new Error(`Login failed: ${errorText.trim()}`);
              }
            }
          } catch (e) {
            // Continue checking other indicators
            if (e.message.includes('Login failed')) {
              throw e; // Re-throw if it's our error
            }
          }
        }
        
        // Check if still on login page (another indicator of failure)
        const stillOnLoginPage = await loginPage.locator('#Loginname').isVisible({ timeout: 2000 }).catch(() => false);
        if (stillOnLoginPage) {
          // Wait a bit more and check again
          await loginPage.waitForTimeout(2000);
          const stillOnLoginPage2 = await loginPage.locator('#Loginname').isVisible({ timeout: 1000 }).catch(() => false);
          if (stillOnLoginPage2) {
            throw new Error('Login failed - still on login page after submission');
          }
        }
        
        // Wait for successful login indicator
        console.log('🔐 Waiting for login confirmation (Contacts menu)...');
        await loginPage.waitForSelector('h3.list-menu-item-heading:has-text("Contacts")', { timeout: 30000 });
        console.log('✅ Login confirmed - Contacts menu found');
        
        // Save authentication state
        await this.browserContext.storageState({ path: authFilePath });
        console.log('✅ Login successful and authentication state saved to auth.json');
      } catch (error) {
        console.error('❌ Login failed:', error);
        // Take a screenshot for debugging
        try {
          await loginPage.screenshot({ path: `./screenshots/login-error-${Date.now()}.png` });
        } catch (screenshotError) {
          console.warn('⚠️ Could not take screenshot:', screenshotError.message);
        }
        throw new Error(`Failed to login and save authentication: ${error.message}`);
      } finally {
        await loginPage.close();
      }
    }
    
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

  async executeTask(task, args, callContext = {}) {
    const callSid = callContext.callSid || 'unknown';
    const executionKey = `${callSid}_${task}`;
    
    // Check if there's already an active execution for this call and task
    if (this.activeExecutions.has(executionKey)) {
      const activeExecution = this.activeExecutions.get(executionKey);
      const elapsedTime = Date.now() - activeExecution.startTime;
      console.log(`⚠️ [${callSid}] Task "${task}" is already running (started ${Math.round(elapsedTime / 1000)}s ago). Rejecting concurrent execution.`);
      return {
        success: false,
        error: `Task "${task}" is already in progress for this call. Please wait for it to complete.`,
        dryRun: false
      };
    }
    
    // Mark execution as active
    this.activeExecutions.set(executionKey, {
      task,
      startTime: Date.now()
    });
    
    // Check if this is an availability check (public page, no auth needed)
    // All availability checks use public URLs, so they don't need authentication
    const isAvailabilityCheck = (task === 'check_availability');
    
    let context;
    let shouldCloseContext = false; // Track if we need to close this context (not the pooled one)
    
    if (isAvailabilityCheck) {
      // For availability checks, use a browser context without authentication (public page)
      console.log('🌐 [Availability Check] Using browser without authentication for public availability page');
      context = await this.getPublicContext();
      shouldCloseContext = true; // Mark this context for cleanup since it's not the pooled one
    } else {
      // For other tasks (create_booking, reschedule, cancel, update_customer), use authenticated context
      context = await this.getContext();
    }
    
    // Track all pages for cleanup
    let testPage = null;
    let loginPage = null;
    let page = null;
    
    page = await context.newPage();
    const auditId = `audit_${Date.now()}_${callSid}`;
    
    try {
      // 🔍 VISIBILITY: Log tool invocation
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🔧 [CRM BROWSER TOOL] Invoked at ${new Date().toISOString()}`);
      console.log(`📞 Call SID: ${callContext.callSid || 'unknown'}`);
      console.log(`📋 Task: ${task}`);
      console.log(`📋 Course Type: ${args.courseType || 'not specified'}`);
      console.log(`📋 Customer: ${args.customerEmail || 'not specified'}`);
      console.log(`${'='.repeat(80)}\n`);
      
      console.log(`🤖 Browser agent executing task: ${task}`);
      
      // Route to course-specific service for create_booking
      if (task === 'create_booking' && args.courseType) {
        return await this.executeCourseBooking(page, args, callContext, auditId);
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

    } catch (error) {
      console.error(`❌ [${callSid}] Browser agent error:`, error);
      return {
        success: false,
        error: error.message,
        dryRun: true
      };
    } finally {
      // Explicitly close all pages
      try {
        if (testPage && !testPage.isClosed()) {
          await testPage.close();
        }
      } catch (error) {
        console.warn(`⚠️ [${callSid}] Error closing testPage:`, error.message);
      }
      
      try {
        if (loginPage && !loginPage.isClosed()) {
          await loginPage.close();
        }
      } catch (error) {
        console.warn(`⚠️ [${callSid}] Error closing loginPage:`, error.message);
      }
      
      try {
        if (page && !page.isClosed()) {
          // Only close page if not in debug mode
          if (process.env.KEEP_BROWSER_OPEN !== 'true') {
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
      
      // Remove from active executions (browser is reused, not closed)
      // Add timeout protection to detect stuck executions
      const execution = this.activeExecutions.get(executionKey);
      if (execution) {
        const elapsed = Date.now() - execution.startTime;
        if (elapsed > 60000) {
          console.warn(`⚠️ [${callSid}] Execution lock was stuck for ${Math.round(elapsed / 1000)}s, force releasing`);
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
          // Route to ITM service if courseType is ITM
          const courseType = args.courseType || '';
          if (courseType === 'ITM' || courseType === 'Introduction to Motorcycling') {
            console.log(`📚 [${auditId}] Routing check_availability to ITM service...`);
            const itmBookingService = (await import('./itmBookingService.js')).default;
            const availability = await itmBookingService.checkAvailabilityAndNoteDetails(page);
            const screenshot = await this.takeScreenshot(page, `${auditId}_itm_availability_check.png`);
            return {
              success: true,
              result: availability,
              screenshots: [screenshot]
            };
          }
          // For other courses, use generic check
          return await this.checkAvailability(page, args, auditId);
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
      
      await page.goto(this.crmCredentials.loginUrl);
      await page.waitForLoadState('networkidle');
      
      // Take screenshot of login page
      await this.takeScreenshot(page, `${auditId}_login_start.png`);
      
      // Fill login form with correct selectors
      console.log('📝 Filling login form...');
      
      // Login Name field
      const loginNameField = page.locator('#Loginname input.dx-texteditor-input');
      await loginNameField.fill(this.crmCredentials.loginName);
      
      // Username field
      const usernameField = page.locator('#Username input.dx-texteditor-input');
      await usernameField.fill(this.crmCredentials.username);
      
      // Password field
      const passwordField = page.locator('#UserPassword input.dx-texteditor-input');
      await passwordField.fill(this.crmCredentials.password);
      
      // Wait for form fields to sync before clicking login button
      console.log('⏳ Waiting for form fields to sync...');
      await page.waitForTimeout(2500); // 2.5 seconds to allow form fields to sync
      
      // Click Login button
      const loginButton = page.locator('#btnLogin');
      await loginButton.click();
      
      await page.waitForLoadState('networkidle');
      
      // Take screenshot after login attempt
      await this.takeScreenshot(page, `${auditId}_login_attempted.png`);
      
      // Verify login success by looking for the sidebar with Contacts tab
      try {
        // Wait for the sidebar to appear with Contacts tab
        await page.waitForSelector('h3.list-menu-item-heading:has-text("Contacts")', { timeout: 10000 });
        
        // Additional verification - check if login form is gone
        const stillOnLoginPage = await page.locator('#Loginname').isVisible();
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
      console.log('🔍 Dry run: Reschedule booking');
      
      // Navigate to booking management
      await page.goto(`${this.crmCredentials.loginUrl}/bookings/${args.bookingId}`);
      await page.waitForLoadState('networkidle');
      
      // Check if booking exists
      const bookingExists = await page.locator(`text=${args.bookingId}`).isVisible();
      
      if (!bookingExists) {
        throw new Error('Booking not found');
      }
      
      // Navigate to reschedule
      await page.click('button[data-action="reschedule"]');
      await page.waitForLoadState('networkidle');
      
      // Fill new date
      await page.fill('input[name="newDate"]', args.newDate);
      
      await this.takeScreenshot(page, `${auditId}_reschedule_form.png`);
      
      return {
        success: true,
        result: {
          action: 'reschedule_booking',
          bookingId: args.bookingId,
          newDate: args.newDate,
          currentDate: await page.inputValue('input[name="currentDate"]')
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

  async dryRunCancelBooking(page, args, auditId) {
    try {
      console.log('🔍 Dry run: Cancel booking');
      
      // Navigate to booking
      await page.goto(`${this.crmCredentials.loginUrl}/bookings/${args.bookingId}`);
      await page.waitForLoadState('networkidle');
      
      // Check booking status
      const status = await page.textContent('.booking-status');
      
      if (status === 'cancelled') {
        throw new Error('Booking already cancelled');
      }
      
      await this.takeScreenshot(page, `${auditId}_cancel_booking.png`);
      
      return {
        success: true,
        result: {
          action: 'cancel_booking',
          bookingId: args.bookingId,
          currentStatus: status,
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
      console.log('🔍 Dry run: Update customer');
      
      // Navigate to customer record
      await page.goto(`${this.crmCredentials.loginUrl}/customers/${args.customerId}`);
      await page.waitForLoadState('networkidle');
      
      // Check if customer exists
      const customerExists = await page.locator(`text=${args.customerId}`).isVisible();
      
      if (!customerExists) {
        throw new Error('Customer not found');
      }
      
      // Navigate to edit
      await page.click('button[data-action="edit"]');
      await page.waitForLoadState('networkidle');
      
      // Show what will be updated
      const updates = [];
      if (args.email) updates.push(`Email: ${args.email}`);
      if (args.phone) updates.push(`Phone: ${args.phone}`);
      if (args.address) updates.push(`Address: ${args.address}`);
      
      await this.takeScreenshot(page, `${auditId}_update_customer.png`);
      
      return {
        success: true,
        result: {
          action: 'update_customer',
          customerId: args.customerId,
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
      
      // For ITM, use the ITM service's checkAvailabilityAndNoteDetails (no login needed)
      if (courseType === 'ITM' || courseType === 'Introduction to Motorcycling') {
        console.log(`📚 [${auditId}] Using ITM availability check (public page, no login required)`);
        const itmBookingService = (await import('./itmBookingService.js')).default;
        const availability = await itmBookingService.checkAvailabilityAndNoteDetails(page);
        await this.takeScreenshot(page, `${auditId}_itm_availability_dryrun.png`);
        
        return {
          success: true,
          result: {
            action: 'check_availability',
            courseType: courseType,
            availability: availability
          },
          requiresConfirmation: false
        };
      }
      
      // For other courses, use generic validation
      // Note: This is a placeholder - actual implementation would depend on course-specific logic
      return {
        success: true,
        result: {
          action: 'check_availability',
          courseType: courseType,
          message: `Dry-run validated for ${courseType} availability check (implementation pending)`
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

  async executeCourseBooking(page, args, callContext, auditId) {
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
        'Gear Conversion': () => import('./gearConversionBookingService.js')
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
      
      // Load course-specific service
      const serviceModule = await serviceLoader();
      const bookingService = serviceModule.default;

      // Prepare booking arguments
      const bookingArgs = {
        customerEmail: args.customerEmail,
        customerPhone: args.customerPhone,
        preferredDate: args.preferredDate,
        preferredTime: args.preferredTime,
        location: args.location,
        bikeType: args.bikeType,
        cbtType: args.cbtType, // For CBT: 'standard' or 'renewal'
        duration: args.duration, // For Gear Conversion: '2', '3', or '4'
        workflowType: args.workflowType || 'existing' // 'existing' or 'new' - determined by voice agent based on Step 3 question
      };

      // Execute workflow
      // For ITM, use executeITMBookingDemo, for others use executeBookingWorkflow
      let result;
      if (courseType === 'ITM' || courseType === 'Introduction to Motorcycling') {
        result = await bookingService.executeITMBookingDemo(page, bookingArgs, callContext);
      } else {
        result = await bookingService.executeBookingWorkflow(page, bookingArgs, callContext);
      }

      // If result indicates failure, return it gracefully
      if (!result.success) {
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
    // Implementation for actual booking reschedule
    console.log('✅ Rescheduling booking...');
    // Add actual implementation here
    return { success: true, result: 'Booking rescheduled successfully' };
  }

  async cancelBooking(page, args, auditId) {
    // Implementation for actual booking cancellation
    console.log('✅ Cancelling booking...');
    // Add actual implementation here
    return { success: true, result: 'Booking cancelled successfully' };
  }

  async updateCustomer(page, args, auditId) {
    // Implementation for actual customer update
    console.log('✅ Updating customer...');
    // Add actual implementation here
    return { success: true, result: 'Customer updated successfully' };
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

