import { chromium } from 'playwright';
import fs from 'fs';
import { 
  getRealisticUserAgent, 
  getStealthBrowserArgs, 
  getStealthInitScript
} from '../../utils/stealthUtils.js';
import { loginToCRM } from '../commonBookingSteps/index.js';
import { ensureDirectories } from '../commonBookingSteps/utils.js';

export class BrowserManager {
  constructor(crmCredentials, screenshotsDir, auditDir) {
    this.crmCredentials = crmCredentials;
    this.screenshotsDir = screenshotsDir;
    this.auditDir = auditDir;
    
    // Browser pooling instance variables
    this.browserInstance = null;
    this.browserContext = null;
    this.browserInitialized = false;
    this.authenticatedPage = null; // Store the authenticated page for reuse
    
    // Ensure directories exist
    ensureDirectories([screenshotsDir, auditDir]);
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
        // Use commonBookingSteps/loginToCRM for authentication
        await loginToCRM(loginPage, this.crmCredentials, this.screenshotsDir);
        
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

  getAuthenticatedPage() {
    return this.authenticatedPage;
  }

  setAuthenticatedPage(page) {
    this.authenticatedPage = page;
  }

  clearAuthenticatedPage() {
    this.authenticatedPage = null;
  }

  clearBrowserContext() {
    this.browserContext = null;
  }
}

