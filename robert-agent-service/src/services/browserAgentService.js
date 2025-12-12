import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { formatUserFriendlyError, getErrorContext } from '../utils/errorFormatter.js';
import { 
  getRealisticUserAgent, 
  getStealthBrowserArgs, 
  getStealthInitScript,
  generateBezierPath,
  waitForRecaptchaReady,
  simulateHumanBehaviorBeforeSubmit
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
    this.activeExecutions = new Map(); // Map<callSid, { task, startTime }>
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

  async getContext() {
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
      
      // Perform login and save authentication state with retry logic
      console.log('🔐 Performing login and saving authentication state...');
      const loginPage = await this.browserContext.newPage();
    let loginAttempt = 0;
    const maxAttempts = 2;
    let lastError = null;
    
    while (loginAttempt < maxAttempts) {
      loginAttempt++;
      const isRetry = loginAttempt > 1;
      
      try {
        if (isRetry) {
          console.log(`🔄 [RETRY ${loginAttempt}/${maxAttempts}] Retrying login with enhanced field handling...`);
          // On retry, navigate to login page again
        await loginPage.goto(this.crmCredentials.loginUrl);
          await loginPage.waitForLoadState('networkidle');
          await loginPage.waitForTimeout(2000); // Extra wait on retry
        } else {
          await loginPage.goto(this.crmCredentials.loginUrl);
          await loginPage.waitForLoadState('networkidle');
          await loginPage.waitForTimeout(3000);
          
          // Simulate reading the page (human-like pause)
          const readingTime = 2000 + Math.random() * 3000; // 2-5 seconds
          await loginPage.waitForTimeout(readingTime);
          
          // Random small scroll to simulate reading
          await loginPage.evaluate(() => {
            window.scrollBy(0, Math.random() * 100);
          });
          await loginPage.waitForTimeout(500 + Math.random() * 500);
          
          // Initial natural mouse movements using Bezier curves
          const viewport = loginPage.viewportSize() || { width: 1280, height: 720 };
          const startX = Math.random() * viewport.width;
          const startY = Math.random() * viewport.height;
          const endX = 200 + Math.random() * 200;
          const endY = 200 + Math.random() * 200;
          
          const bezierPath = generateBezierPath(startX, startY, endX, endY, 15);
          for (const point of bezierPath) {
            await loginPage.mouse.move(point.x, point.y);
            await loginPage.waitForTimeout(50 + Math.random() * 100);
          }
        }
        
        await loginPage.waitForLoadState('domcontentloaded');
        await loginPage.waitForTimeout(1000);
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
        
        console.log(`🔐 Login form ready, filling fields${isRetry ? ' (RETRY with enhanced handling)' : ''}...`);
        
        // Get field locators
        const loginNameField = loginPage.locator('#Loginname input.dx-texteditor-input');
        const usernameField = loginPage.locator('#Username input.dx-texteditor-input');
        const passwordField = loginPage.locator('#UserPassword input.dx-texteditor-input');
        
        // Clear any existing values first (in case of stale state or previous failed attempt)
        console.log('🧹 Clearing any existing field values...');
        await loginNameField.waitFor({ state: 'visible' });
        await loginNameField.click({ clickCount: 3 }); // Triple-click to select all
        await loginNameField.press('Backspace');
        await loginPage.waitForTimeout(500);
        
        await usernameField.waitFor({ state: 'visible' });
        await usernameField.click({ clickCount: 3 });
        await usernameField.press('Backspace');
        await loginPage.waitForTimeout(500);
        
        await passwordField.waitFor({ state: 'visible' });
        await passwordField.click({ clickCount: 3 });
        await passwordField.press('Backspace');
        await loginPage.waitForTimeout(500);
        
        // Fill login form fields with human-like behavior
        // Move mouse to first field using Bezier curve
        const loginNameBox = await loginNameField.boundingBox().catch(() => null);
        if (loginNameBox) {
          const viewportSize = loginPage.viewportSize() || { width: 1280, height: 720 };
          const currentMousePos = { x: viewportSize.width / 2, y: viewportSize.height / 2 };
          const fieldPath = generateBezierPath(
            currentMousePos.x, currentMousePos.y,
            loginNameBox.x + loginNameBox.width / 2,
            loginNameBox.y + loginNameBox.height / 2,
            10
          );
          for (const point of fieldPath) {
            await loginPage.mouse.move(point.x, point.y);
            await loginPage.waitForTimeout(30 + Math.random() * 50);
          }
        }
        
        await loginNameField.click();
        await loginPage.waitForTimeout(200 + Math.random() * 200);
        // Type with variable speed (faster for common words)
        await loginNameField.type(this.crmCredentials.loginName, { delay: 30 + Math.random() * 50 });
        await loginNameField.blur();
        await loginPage.waitForTimeout(isRetry ? 2000 : 1500);
        
        const loginNameValue = await loginNameField.inputValue();
        if (loginNameValue !== this.crmCredentials.loginName) {
          await loginNameField.click({ clickCount: 3 });
          await loginNameField.press('Backspace');
          await loginPage.waitForTimeout(500);
          await loginNameField.type(this.crmCredentials.loginName, { delay: 50 });
          await loginNameField.blur();
          await loginPage.waitForTimeout(1000);
          const retryValue = await loginNameField.inputValue();
          if (retryValue !== this.crmCredentials.loginName) {
            throw new Error(`Login name not filled correctly. Expected: "${this.crmCredentials.loginName}", Got: "${retryValue}"`);
        }
        }
        
        // Move to username field using Tab key (more natural)
        await loginPage.keyboard.press('Tab');
        await loginPage.waitForTimeout(200 + Math.random() * 200);
        // Small random micro-movement while hovering
        const usernameBox = await usernameField.boundingBox().catch(() => null);
        if (usernameBox) {
          await loginPage.mouse.move(
            usernameBox.x + usernameBox.width / 2 + (Math.random() * 10 - 5),
            usernameBox.y + usernameBox.height / 2 + (Math.random() * 10 - 5)
          );
          await loginPage.waitForTimeout(100 + Math.random() * 100);
        }
        await usernameField.click();
        await loginPage.waitForTimeout(200 + Math.random() * 200);
        await usernameField.type(this.crmCredentials.username, { delay: 30 + Math.random() * 50 });
        await usernameField.blur();
        await loginPage.waitForTimeout(isRetry ? 2000 : 1500);
        
        const usernameValue = await usernameField.inputValue();
        if (usernameValue !== this.crmCredentials.username) {
          await usernameField.click({ clickCount: 3 });
          await usernameField.press('Backspace');
          await loginPage.waitForTimeout(500);
          await usernameField.type(this.crmCredentials.username, { delay: 50 });
          await usernameField.blur();
          await loginPage.waitForTimeout(1000);
          const retryValue = await usernameField.inputValue();
          if (retryValue !== this.crmCredentials.username) {
            throw new Error(`Username not filled correctly. Expected: "${this.crmCredentials.username}", Got: "${retryValue}"`);
        }
        }
        
        // Move to password field using Tab key
        await loginPage.keyboard.press('Tab');
        await loginPage.waitForTimeout(200 + Math.random() * 200);
        // Small random micro-movement
        const passwordBox = await passwordField.boundingBox().catch(() => null);
        if (passwordBox) {
          await loginPage.mouse.move(
            passwordBox.x + passwordBox.width / 2 + (Math.random() * 10 - 5),
            passwordBox.y + passwordBox.height / 2 + (Math.random() * 10 - 5)
          );
          await loginPage.waitForTimeout(100 + Math.random() * 100);
        }
        await passwordField.click();
        await loginPage.waitForTimeout(200 + Math.random() * 200);
        // Type password slower (more careful with sensitive data)
        await passwordField.type(this.crmCredentials.password, { delay: 50 + Math.random() * 100 });
        await passwordField.blur();
        await loginPage.waitForTimeout(isRetry ? 1500 : 1000); // Reduced from 2000/1500ms
        
        const passwordLength = (await passwordField.inputValue()).length;
        if (passwordLength !== this.crmCredentials.password.length) {
          await passwordField.click({ clickCount: 3 });
          await passwordField.press('Backspace');
          await loginPage.waitForTimeout(500);
          await passwordField.type(this.crmCredentials.password, { delay: 50 });
          await passwordField.blur();
          await loginPage.waitForTimeout(1000);
          const retryLength = (await passwordField.inputValue()).length;
          if (retryLength !== this.crmCredentials.password.length) {
            throw new Error(`Password not filled correctly. Expected length: ${this.crmCredentials.password.length}, Got: ${retryLength}`);
          }
        }
        
        // Trigger form events and wait for validation
        await loginPage.locator('body').click({ position: { x: 100, y: 100 } });
        await loginPage.waitForTimeout(1500);
        
        await loginNameField.dispatchEvent('input');
        await loginNameField.dispatchEvent('change');
        await loginNameField.dispatchEvent('blur');
        await usernameField.dispatchEvent('input');
        await usernameField.dispatchEvent('change');
        await usernameField.dispatchEvent('blur');
        await passwordField.dispatchEvent('input');
        await passwordField.dispatchEvent('change');
        await passwordField.dispatchEvent('blur');
        
        await loginPage.waitForTimeout(isRetry ? 2500 : 2000);
        
        // Verify login button is enabled
        let buttonEnabled = false;
        let buttonCheckAttempts = 0;
        const maxButtonChecks = 5;
        
        while (buttonCheckAttempts < maxButtonChecks && !buttonEnabled) {
          buttonCheckAttempts++;
          buttonEnabled = await loginButton.isEnabled();
          if (buttonEnabled) break;
          if (buttonCheckAttempts < maxButtonChecks) {
            await loginPage.waitForTimeout(1000);
          }
        }
        
        if (!buttonEnabled) {
          throw new Error(`Login button is disabled after ${maxButtonChecks} checks - form may not be ready`);
        }
        
        // Enhanced human-like behavior for reCAPTCHA with Bezier curves
        const viewport = loginPage.viewportSize() || { width: 1280, height: 720 };
        const currentPos = { x: viewport.width / 2, y: viewport.height / 2 };
        
        // Natural mouse movement pattern before clicking login
        const formBox = await loginPage.locator('form').first().boundingBox().catch(() => null);
        if (formBox) {
          // Move to form area using Bezier curve
          const formPath = generateBezierPath(
            currentPos.x, currentPos.y,
            formBox.x + formBox.width / 2,
            formBox.y + formBox.height / 2,
            20
          );
          for (const point of formPath) {
            await loginPage.mouse.move(point.x, point.y);
            await loginPage.waitForTimeout(40 + Math.random() * 60);
          }
          await loginPage.waitForTimeout(300 + Math.random() * 200);
        
          // Small random micro-movements (human-like jitter)
          for (let i = 0; i < 3; i++) {
            await loginPage.mouse.move(
              formBox.x + formBox.width / 2 + (Math.random() * 20 - 10),
              formBox.y + formBox.height / 2 + (Math.random() * 20 - 10)
            );
            await loginPage.waitForTimeout(100 + Math.random() * 150);
          }
        }
        
        // Move to login button using Bezier curve
        const loginButtonBox = await loginButton.boundingBox().catch(() => null);
        if (loginButtonBox) {
          // Use form center or viewport center as starting point
          const startX = formBox ? formBox.x + formBox.width / 2 : viewport.width / 2;
          const startY = formBox ? formBox.y + formBox.height / 2 : viewport.height / 2;
          
          const buttonPath = generateBezierPath(
            startX,
            startY,
            loginButtonBox.x + loginButtonBox.width / 2,
            loginButtonBox.y + loginButtonBox.height / 2,
            15
          );
          
          for (const point of buttonPath) {
            await loginPage.mouse.move(point.x, point.y);
            await loginPage.waitForTimeout(50 + Math.random() * 80);
          }
          
          // Hover over button with slight movements (human hesitation)
          await loginPage.waitForTimeout(400 + Math.random() * 300);
          await loginPage.mouse.move(
            loginButtonBox.x + loginButtonBox.width / 2 + (Math.random() * 5 - 2.5),
            loginButtonBox.y + loginButtonBox.height / 2 + (Math.random() * 5 - 2.5)
          );
          await loginPage.waitForTimeout(200 + Math.random() * 300);
        }
        
        // Check for reCAPTCHA elements on the page before submission
        console.log('🔍 Checking for reCAPTCHA elements on page...');
        try {
          const recaptchaChecks = {
            iframe: await loginPage.locator('iframe[src*="recaptcha"]').count(),
            grecaptchaDiv: await loginPage.locator('.g-recaptcha').count(),
            grecaptchaScript: await loginPage.locator('script[src*="recaptcha"]').count(),
            recaptchaBadge: await loginPage.locator('[class*="recaptcha"]').count()
          };

          console.log('📊 reCAPTCHA Detection Results:');
          console.log(`   - reCAPTCHA iframes found: ${recaptchaChecks.iframe}`);
          console.log(`   - .g-recaptcha divs found: ${recaptchaChecks.grecaptchaDiv}`);
          console.log(`   - reCAPTCHA scripts found: ${recaptchaChecks.grecaptchaScript}`);
          console.log(`   - reCAPTCHA badges/classes found: ${recaptchaChecks.recaptchaBadge}`);

          if (recaptchaChecks.iframe > 0 || recaptchaChecks.grecaptchaDiv > 0) {
            console.log('✅ reCAPTCHA is present on the login page');
            
            // Try to get reCAPTCHA status
            try {
              const recaptchaStatus = await loginPage.evaluate(() => {
                if (window.grecaptcha) {
                  return {
                    ready: window.grecaptcha.ready !== undefined,
                    getResponse: typeof window.grecaptcha.getResponse === 'function'
                  };
                }
                return null;
              });
              if (recaptchaStatus) {
                console.log(`   - grecaptcha object available: ${recaptchaStatus.ready}`);
                console.log(`   ⚠️ Note: Actual score (0.0-1.0) is only available server-side`);
                console.log(`   The server verifies the token with Google and receives the score`);
              }
            } catch (e) {
              console.log('   - Could not check grecaptcha object:', e.message);
            }
          } else {
            console.log('⚠️ No reCAPTCHA elements detected on page (may be invisible or loaded dynamically)');
          }
        } catch (e) {
          console.log('⚠️ Could not check for reCAPTCHA elements:', e.message);
        }
        
        // Wait for reCAPTCHA to execute and calculate score
        await waitForRecaptchaReady(loginPage, 3000); // Reduced from 5000ms (usually ready faster)
        
        // Additional wait to let reCAPTCHA observe more behavior
        await loginPage.waitForTimeout(1000 + Math.random() * 1000); // Reduced from 2000-4000ms
        
        // Simulate human behavior before clicking login button
        const formLocator = loginPage.locator('form').first();
        await simulateHumanBehaviorBeforeSubmit(loginPage, formLocator, loginButton);
        
        // Reading pause before clicking (human hesitation)
        const preClickDelay = 500 + Math.random() * 1000;
        await loginPage.waitForTimeout(preClickDelay);
        
        console.log(`🔐 Submitting login form${isRetry ? ' (RETRY)' : ''}...`);
        
        // Intercept request for error analysis only
        let interceptedRequestData = null;
        const requestHandler = (request) => {
          const url = request.url();
          if (url.includes('/Account/Login') && (url.includes('handler=Wm_TryLogin') || url.includes('Wm_TryLogin'))) {
            interceptedRequestData = request.postData();
          }
        };
        loginPage.on('request', requestHandler);
        
        // Try multiple submission methods
        let submissionSuccessful = false;
        let lastResponse = null;
        
        // Method 1: Form submit
        try {
          const formElement = await loginPage.locator('form').first();
          const formExists = await formElement.count() > 0;
          
          if (formExists) {
            const [response] = await Promise.all([
              loginPage.waitForResponse(
                response => {
                  const url = response.url();
                  return url.includes('/Account/Login') || url.includes('/InContact/Account');
                },
                { timeout: 15000 }
              ).catch(() => null),
              loginPage.evaluate(() => {
                const form = document.querySelector('form');
                if (form) {
                  form.submit();
                  return true;
                }
                return false;
              })
            ]);
            
            if (response) {
              lastResponse = response;
              submissionSuccessful = true;
            }
          }
        } catch (formSubmitError) {
          // Continue to next method
        }
        
        // Method 2: Enter key
        if (!submissionSuccessful) {
          try {
            await passwordField.focus();
            await loginPage.waitForTimeout(500);
            
            const [response] = await Promise.all([
              loginPage.waitForResponse(
                response => {
                  const url = response.url();
                  return url.includes('/Account/Login') && url.includes('handler=Wm_TryLogin');
                },
                { timeout: 20000 }
              ).catch(() => null),
              passwordField.press('Enter', { delay: 100 + Math.random() * 100 })
            ]);
            
            if (response) {
              lastResponse = response;
              submissionSuccessful = true;
            }
          } catch (enterError) {
            // Continue to next method
          }
        }
        
        // Method 3: Button click
        if (!submissionSuccessful) {
          try {
            const [response] = await Promise.all([
              loginPage.waitForResponse(
                response => {
                  const url = response.url();
                  return url.includes('/Account/Login') && url.includes('handler=Wm_TryLogin');
                },
                { timeout: 20000 }
              ).catch(() => null),
              loginButton.click({ delay: 100 + Math.random() * 100 })
            ]);
            
            if (response) {
              lastResponse = response;
              submissionSuccessful = true;
            }
          } catch (buttonError) {
            // All methods failed
          }
        }
        
        loginPage.off('request', requestHandler);
        
        // CRITICAL: Parse JSON response body immediately to check for errors
        if (lastResponse) {
          try {
            const responseBody = await lastResponse.text().catch(() => '');
            
            if (responseBody) {
              try {
                const jsonResponse = JSON.parse(responseBody);
                
                // Check for reCAPTCHA score in response (if server includes it)
                if (jsonResponse.recaptchaScore !== undefined || jsonResponse.score !== undefined) {
                  const score = jsonResponse.recaptchaScore || jsonResponse.score;
                  console.log(`📊 reCAPTCHA Score from server: ${score}`);
                  if (score < 0.5) {
                    console.error(`🚨 LOW reCAPTCHA SCORE (${score}) - Likely detected as bot!`);
                    console.error(`   Score interpretation: ${score >= 0.9 ? 'Human' : score >= 0.7 ? 'Likely Human' : score >= 0.5 ? 'Suspicious' : 'Bot'}`);
                  } else if (score < 0.7) {
                    console.warn(`⚠️ MODERATE reCAPTCHA SCORE (${score}) - May be flagged`);
                  } else {
                    console.log(`✅ GOOD reCAPTCHA SCORE (${score})`);
                  }
                }
                
                // Check for error message in JSON response
                if (jsonResponse.errorMessage) {
                  console.error(`❌ Login failed: ${jsonResponse.errorMessage}`);
                  
                  // ENHANCED: Check for reCAPTCHA-specific error messages
                  const errorMsg = jsonResponse.errorMessage.toLowerCase();
                  const isRecaptchaError = 
                    errorMsg.includes('recaptcha') || 
                    errorMsg.includes('captcha') ||
                    errorMsg.includes('robot') ||
                    errorMsg.includes('automation') ||
                    errorMsg.includes('verification') ||
                    errorMsg.includes('suspicious');
                  
                  if (isRecaptchaError) {
                    console.error('🚨 CONFIRMED: This is a reCAPTCHA-related error!');
                    console.error(`   Error message: "${jsonResponse.errorMessage}"`);
                  }
                  
                  // ENHANCED: Analyze gToken with detailed logging
                  if (interceptedRequestData) {
                    const hasGToken = interceptedRequestData.includes('gToken=');
                    console.log(`📊 Request Analysis:`);
                    console.log(`   - gToken present: ${hasGToken}`);
                    
                    if (hasGToken) {
                      const tokenMatch = interceptedRequestData.match(/gToken=([^&]+)/);
                      if (tokenMatch && tokenMatch[1]) {
                        const tokenValue = decodeURIComponent(tokenMatch[1]);
                        const tokenLength = tokenValue.length;
                        console.log(`   - gToken length: ${tokenLength}`);
                        console.log(`   - gToken value (first 50 chars): ${tokenValue.substring(0, 50)}...`);
                        
                        if (tokenLength < 100 || tokenValue === '0' || tokenValue === '' || tokenValue === 'null') {
                          console.error(`❌ reCAPTCHA token invalid (length: ${tokenLength})`);
                          console.error('🚨 CONFIRMED: Invalid reCAPTCHA token - this is a reCAPTCHA issue!');
                        } else {
                          console.error(`⚠️ reCAPTCHA token present but rejected - likely automation detected`);
                          console.error('🚨 CONFIRMED: Valid token but rejected - reCAPTCHA detected automation!');
                          console.error(`   This suggests the reCAPTCHA score was too low (< 0.5 typically)`);
                        }
                      }
                    } else {
                      console.error(`❌ reCAPTCHA token missing from request`);
                      console.error('🚨 CONFIRMED: Missing reCAPTCHA token - this is a reCAPTCHA issue!');
                    }
                  } else {
                    console.warn('⚠️ Could not analyze request data - interceptedRequestData is missing');
                  }
                  
                  throw new Error(`Login failed: ${jsonResponse.errorMessage}`);
                }
                
                // Check for success indicators in JSON response
                if (jsonResponse.newPage || jsonResponse.login_token) {
                  console.log('✅ Login successful according to JSON response');
                  console.log(`📡 JSON response:`, JSON.stringify(jsonResponse, null, 2));
                  // Continue to DOM verification below
                } else {
                  // No error but also no success indicators - log for debugging
                  console.log(`⚠️ JSON response has no error but also no success indicators:`, JSON.stringify(jsonResponse, null, 2));
                }
              } catch (jsonParseError) {
                // Not JSON, log as text
                if (responseBody.length < 1000) {
                  console.log(`📡 Response body (not JSON): ${responseBody.substring(0, 500)}`);
                } else {
                  console.log(`📡 Response body preview: ${responseBody.substring(0, 200)}...`);
                }
              }
            }
          } catch (bodyError) {
            console.log('⚠️ Could not read response body:', bodyError.message);
          }
        }
        
        // Wait for either success or error (don't just wait for networkidle)
        console.log('🔐 Waiting for login response to process...');
        await loginPage.waitForTimeout(3000); // Give time for error messages to appear
        
        // Check for error messages first (before waiting for success)
        const errorIndicators = [
          loginPage.locator('text=/invalid/i'),
          loginPage.locator('text=/incorrect/i'),
          loginPage.locator('text=/error/i'),
          loginPage.locator('text=/recaptcha/i'),
          loginPage.locator('text=/captcha/i'),
          loginPage.locator('text=/robot/i'),
          loginPage.locator('text=/verification/i'),
          loginPage.locator('.dx-error-message'),
          loginPage.locator('[class*="error"]'),
          loginPage.locator('.alert-danger'),
          loginPage.locator('.validation-summary-errors'),
          loginPage.locator('[role="alert"]')
        ];
        
        for (const errorLocator of errorIndicators) {
          try {
            const isVisible = await errorLocator.first().isVisible({ timeout: 2000 }).catch(() => false);
            if (isVisible) {
              const errorText = await errorLocator.first().textContent().catch(() => '');
              if (errorText && errorText.trim().length > 0) {
                console.error(`❌ Login error detected: ${errorText}`);
                
                // ENHANCED: Check if it's a reCAPTCHA error
                const errorLower = errorText.toLowerCase();
                if (errorLower.includes('recaptcha') || errorLower.includes('captcha') || 
                    errorLower.includes('robot') || errorLower.includes('verification')) {
                  console.error('🚨 CONFIRMED: Error message indicates reCAPTCHA issue!');
                }
                
                // Take screenshot when error is detected
                try {
                  await loginPage.screenshot({ path: `./screenshots/login-error-detected-${Date.now()}.png` });
                  console.log('📸 Screenshot saved: login-error-detected-*.png');
                } catch (screenshotError) {
                  console.warn('⚠️ Could not take error screenshot:', screenshotError.message);
                }
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
        const stillOnLoginPage = await loginPage.locator('#Loginname').isVisible({ timeout: 3000 }).catch(() => false);
        if (stillOnLoginPage) {
          // Wait a bit more and check again - sometimes the page takes time to redirect
          await loginPage.waitForTimeout(3000);
          const stillOnLoginPage2 = await loginPage.locator('#Loginname').isVisible({ timeout: 2000 }).catch(() => false);
          if (stillOnLoginPage2) {
            // Check one more time after waiting for network idle
            await loginPage.waitForLoadState('networkidle').catch(() => {});
            await loginPage.waitForTimeout(2000);
            const stillOnLoginPage3 = await loginPage.locator('#Loginname').isVisible({ timeout: 2000 }).catch(() => false);
            if (stillOnLoginPage3) {
              // Take screenshot before throwing error
              try {
                await loginPage.screenshot({ path: `./screenshots/login-still-on-page-${Date.now()}.png` });
                console.log('📸 Screenshot saved: login-still-on-page-*.png');
              } catch (screenshotError) {
                console.warn('⚠️ Could not take screenshot:', screenshotError.message);
              }
            throw new Error('Login failed - still on login page after submission');
            }
          }
        }
        
        // Wait for successful login
        await loginPage.waitForSelector('h3.list-menu-item-heading:has-text("Contacts")', { timeout: 30000 });
        console.log(`✅ Login successful${isRetry ? ' (RETRY)' : ''}`);
        
        // Don't navigate if already on dashboard - cookies are already in context
        const currentUrl = loginPage.url();
        if (!currentUrl.includes('/InContact') || currentUrl.includes('/Account/Login')) {
          // Navigate to CRM dashboard - cookies in context will persist
          await loginPage.goto('https://takeabyte.co.uk/InContact', { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
          });
          await loginPage.waitForTimeout(2000); // Allow page to settle
        }
        
        // Trust that cookies in context work - no need to verify
        // Session expiration will be detected if we get redirected to login page
        
        // Save authentication state for future browser restarts
        await this.browserContext.storageState({ path: authFilePath });
        this.authenticatedPage = loginPage;
        console.log('✅ Session established and saved (cookies persist in context)');
        
        // Success! Break out of retry loop
        break;
        
      } catch (error) {
        lastError = error;
        console.error(`❌ Login attempt ${loginAttempt}/${maxAttempts} failed:`, error.message);
        
        // Take a screenshot for debugging
        try {
          await loginPage.screenshot({ path: `./screenshots/login-error-attempt-${loginAttempt}-${Date.now()}.png` });
        } catch (screenshotError) {
          console.warn('⚠️ Could not take screenshot:', screenshotError.message);
        }
        
        // If this was the last attempt, throw the error
        if (loginAttempt >= maxAttempts) {
          console.error(`❌ All ${maxAttempts} login attempts failed`);
          // Close login page before throwing
          try {
            if (!loginPage.isClosed()) {
        await loginPage.close();
      }
          } catch (closeError) {
            console.warn('⚠️ Error closing login page after failure:', closeError.message);
          }
          
          // Close the context since login failed - this allows retry with fresh context
          if (this.browserContext) {
            try {
              await this.browserContext.close();
              console.log('🧹 Closed browser context after login failure');
            } catch (closeError) {
              console.warn('⚠️ Error closing context after login failure:', closeError.message);
            }
            this.browserContext = null;
          }
          
          throw new Error(`Failed to login after ${maxAttempts} attempts: ${error.message}`);
        } else {
          // Wait a bit before retrying
          console.log(`⏳ Waiting 2 seconds before retry attempt ${loginAttempt + 1}...`);
          await loginPage.waitForTimeout(2000);
        }
      }
    }
    }
    
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

  async executeTask(task, args, callContext = {}) {
    const callSid = callContext.callSid || 'unknown';
    const executionKey = `${callSid}_${task}`;
    
    // Check if there's already an active execution for this call and task
    if (this.activeExecutions.has(executionKey)) {
      const activeExecution = this.activeExecutions.get(executionKey);
      const elapsedTime = Date.now() - activeExecution.startTime;
      
      // If execution is stuck for more than 5 minutes, force clear it to allow retry
      if (elapsedTime > 300000) {
        console.warn(`⚠️ [${callSid}] Execution lock was stuck for ${Math.round(elapsedTime / 1000)}s, force clearing to allow retry`);
        this.activeExecutions.delete(executionKey);
      } else {
      console.log(`⚠️ [${callSid}] Task "${task}" is already running (started ${Math.round(elapsedTime / 1000)}s ago). Rejecting concurrent execution.`);
      return {
        success: false,
        error: `Task "${task}" is already in progress for this call. Please wait for it to complete.`,
        dryRun: false
      };
      }
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
      context = await this.getContext();
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
          // Use common availability check for all course types
          const courseType = args.courseType || '';
          if (!courseType) {
            throw new Error('Course type is required for availability check');
          }
          
          console.log(`📚 [${auditId}] Checking availability for ${courseType}...`);
          const commonSteps = await import('./commonBookingSteps/index.js');
          const availability = await commonSteps.checkAvailabilityAndNoteDetails(page, courseType, this.screenshotsDir);
          const screenshot = await this.takeScreenshot(page, `${auditId}_${courseType.toLowerCase().replace(/\s+/g, '-')}_availability_check.png`);
          
          // Store availability data to file as fallback (for development/debugging)
          const availabilityCachePath = './availability-cache.json';
          try {
            // Extract callSid from auditId (format: audit_${timestamp}_${callSid})
            const callSidFromAuditId = auditId.split('_').slice(2).join('_') || 'unknown';
            
            const cacheData = {
              courseType: courseType,
              sessionDetails: availability,
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
              sessionDetails: availability, // Store as sessionDetails for consistency
              ...availability // Also include all fields directly
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
      
      await page.goto(this.crmCredentials.loginUrl);
      await page.waitForLoadState('networkidle');
      
      // Initial human-like behavior: simulate reading the page
      console.log('📖 Simulating reading the login page...');
      await page.waitForTimeout(2000 + Math.random() * 2000);
      
      // Small random scroll to simulate reading
      await page.evaluate(() => {
        window.scrollBy(0, Math.random() * 50);
      });
      await page.waitForTimeout(500 + Math.random() * 500);
      
      // Take screenshot of login page
      await this.takeScreenshot(page, `${auditId}_login_start.png`);
      
      // Wait for form fields to be ready
      await page.waitForSelector('#Loginname input.dx-texteditor-input', { state: 'visible', timeout: 15000 });
      await page.waitForSelector('#Username input.dx-texteditor-input', { state: 'visible', timeout: 15000 });
      await page.waitForSelector('#UserPassword input.dx-texteditor-input', { state: 'visible', timeout: 15000 });
      await page.waitForTimeout(1000);
      
      // Get field locators
      const loginNameField = page.locator('#Loginname input.dx-texteditor-input');
      const usernameField = page.locator('#Username input.dx-texteditor-input');
      const passwordField = page.locator('#UserPassword input.dx-texteditor-input');
      const loginButton = page.locator('#btnLogin');
      
      // Fill login form with human-like typing
      console.log('⌨️ Filling login form with human-like behavior...');
      
      // Move mouse to first field using Bezier curve
      const loginNameBox = await loginNameField.boundingBox().catch(() => null);
      if (loginNameBox) {
        const viewportSize = page.viewportSize() || { width: 1280, height: 720 };
        const currentMousePos = { x: viewportSize.width / 2, y: viewportSize.height / 2 };
        const fieldPath = generateBezierPath(
          currentMousePos.x, currentMousePos.y,
          loginNameBox.x + loginNameBox.width / 2,
          loginNameBox.y + loginNameBox.height / 2,
          10
        );
        for (const point of fieldPath) {
          await page.mouse.move(point.x, point.y);
          await page.waitForTimeout(30 + Math.random() * 50);
        }
      }
      
      // Fill Login Name
      await loginNameField.click();
      await page.waitForTimeout(200 + Math.random() * 200);
      await loginNameField.type(this.crmCredentials.loginName, { delay: 30 + Math.random() * 50 });
      await loginNameField.blur();
      await page.waitForTimeout(1000 + Math.random() * 500);
      
      // Move to username field using Tab (more natural)
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200 + Math.random() * 200);
      
      // Small mouse movement
      const usernameBox = await usernameField.boundingBox().catch(() => null);
      if (usernameBox) {
        await page.mouse.move(
          usernameBox.x + usernameBox.width / 2 + (Math.random() * 10 - 5),
          usernameBox.y + usernameBox.height / 2 + (Math.random() * 10 - 5)
        );
        await page.waitForTimeout(100 + Math.random() * 100);
      }
      
      // Fill Username
      await usernameField.click();
      await page.waitForTimeout(200 + Math.random() * 200);
      await usernameField.type(this.crmCredentials.username, { delay: 30 + Math.random() * 50 });
      await usernameField.blur();
      await page.waitForTimeout(1000 + Math.random() * 500);
      
      // Move to password field using Tab
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200 + Math.random() * 200);
      
      // Small mouse movement
      const passwordBox = await passwordField.boundingBox().catch(() => null);
      if (passwordBox) {
        await page.mouse.move(
          passwordBox.x + passwordBox.width / 2 + (Math.random() * 10 - 5),
          passwordBox.y + passwordBox.height / 2 + (Math.random() * 10 - 5)
        );
        await page.waitForTimeout(100 + Math.random() * 100);
      }
      
      // Fill Password (type slower for sensitive data)
      await passwordField.click();
      await page.waitForTimeout(200 + Math.random() * 200);
      await passwordField.type(this.crmCredentials.password, { delay: 50 + Math.random() * 100 });
      await passwordField.blur();
      await page.waitForTimeout(1000 + Math.random() * 500); // Reduced from 1500-2500ms
      
      // Trigger form events
      await page.locator('body').click({ position: { x: 100, y: 100 } });
      await page.waitForTimeout(500); // Reduced from 1000ms
      
      // Wait for reCAPTCHA to execute and calculate score
      await waitForRecaptchaReady(page, 3000); // Reduced from 5000ms (usually ready faster)
      
      // Additional wait to let reCAPTCHA observe more behavior
      await page.waitForTimeout(1000 + Math.random() * 1000); // Reduced from 2000-4000ms
      
      // Simulate human behavior before clicking login button
      const formLocator = page.locator('form').first();
      await simulateHumanBehaviorBeforeSubmit(page, formLocator, loginButton);
      
      // Click Login button
      console.log('🔐 Clicking login button...');
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
      const availability = await commonSteps.checkAvailabilityAndNoteDetails(page, courseType, this.screenshotsDir);
      await this.takeScreenshot(page, `${auditId}_${courseType.toLowerCase().replace(/\s+/g, '-')}_availability_dryrun.png`);
      
      return {
        success: true,
        result: {
          action: 'check_availability',
          courseType: courseType,
          availability: availability
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
        // If customer info is available, assume existing; otherwise assume new
        if (args.customerMobile || args.customerPhone || args.customerEmail) {
          workflowType = 'existing';
          console.log('📋 WorkflowType determined: existing (customer info available)');
        } else {
          workflowType = 'new';
          console.log('📋 WorkflowType determined: new (no customer info available)');
        }
      } else {
        console.log(`📋 WorkflowType explicitly set: ${workflowType}`);
      }

      // Prepare booking arguments
      const bookingArgs = {
        customerEmail: args.customerEmail,
        customerPhone: args.customerPhone,
        customerMobile: args.customerMobile || args.customerPhone, // Support both field names
        preferredDate: args.preferredDate,
        preferredTime: args.preferredTime,
        location: args.location,
        bikeType: args.bikeType,
        cbtType: args.cbtType, // For CBT: 'standard' or 'renewal'
        duration: args.duration, // For Gear Conversion: '2', '3', or '4'
        workflowType: workflowType
      };
      
      // Retrieve availability data from conversation if available
      const { conversations } = await import('../shared/state.js');
      const conversation = conversations[callContext.callSid] || {};
      if (conversation.lastAvailabilityCheck) {
        bookingArgs.sessionDetails = conversation.lastAvailabilityCheck;
        console.log('📅 Using availability data from previous check (conversation state)');
      } else {
        // FALLBACK: Try to load from file cache (for development/debugging)
        const availabilityCachePath = './availability-cache.json';
        if (fs.existsSync(availabilityCachePath)) {
          try {
            const cacheData = JSON.parse(fs.readFileSync(availabilityCachePath, 'utf8'));
            // Check if cache is recent (within last 1 hour) and matches course type
            const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime();
            const oneHour = 60 * 60 * 1000;
            
            if (cacheAge < oneHour && cacheData.sessionDetails) {
              // Optionally check if course type matches (for multi-course scenarios)
              if (!cacheData.courseType || cacheData.courseType === args.courseType || 
                  args.courseType === 'Introduction to Motorcycling' && cacheData.courseType === 'ITM') {
                bookingArgs.sessionDetails = cacheData.sessionDetails;
                console.log(`📅 Using availability data from file cache (${Math.round(cacheAge / 1000 / 60)} minutes old)`);
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

      // Execute workflow - all services now use executeBookingWorkflow
      const result = await bookingService.executeBookingWorkflow(page, bookingArgs, callContext);

      // If result indicates verification is required, return it
      if (result.requiresVerification) {
        return {
          success: false,
          requiresVerification: true,
          clientDetails: result.clientDetails || callContext.clientDetails,
          message: result.message || 'Client found but requires verbal verification before proceeding with booking.',
          dryRun: true,
          requiresConfirmation: false,
          auditId,
          screenshots: result.screenshots || [],
          courseType: args.courseType
        };
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

