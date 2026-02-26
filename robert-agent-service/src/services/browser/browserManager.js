import { chromium } from 'playwright';
import fs from 'fs';
import { 
  getRealisticUserAgent, 
  getStealthBrowserArgs, 
  getStealthInitScript
} from '../../utils/stealthUtils.js';
import { loginToCRM } from '../commonBookingSteps/index.js';
import { ensureDirectories } from '../commonBookingSteps/utils.js';
import browserPoolService from './browserPoolService.js';

// Production: headless; development: headed (for debugging). VPN path always uses headed.
const isProduction = process.env.NODE_ENV === 'production';
const headless = isProduction;

export class BrowserManager {
  constructor(crmCredentials, screenshotsDir, auditDir) {
    this.crmCredentials = crmCredentials;
    this.screenshotsDir = screenshotsDir;
    this.auditDir = auditDir;
    
    // Browser pooling instance variables
    this.browserInstance = null;
    this.browserContext = null;
    this.persistentContext = null; // For VPN persistent context mode
    this.browserInitialized = false;
    this.authenticatedPage = null; // Store the authenticated page for reuse
    this.usingPersistentContext = false; // Track if using VPN mode
    
    // Pool mode tracking
    this.usePoolMode = process.env.BROWSER_POOL_ENABLED !== 'false';
    this.poolInitialized = false;
    this.currentPooledBrowser = null; // Track currently acquired browser from pool
    
    // Ensure directories exist
    ensureDirectories([screenshotsDir, auditDir]);
  }

  /**
   * Initialize browser pool for normal (non-VPN) mode
   * Called once during service startup
   * @returns {Promise<void>}
   */
  async initializePool() {
    // Skip pool initialization in VPN mode
    const userDataDir = process.env.CHROME_USER_DATA_DIR;
    const isVpnMode = userDataDir && process.env.NODE_ENV !== 'production';
    
    if (isVpnMode) {
      console.log('ℹ️ VPN mode detected - browser pool disabled (single CDP connection)');
      this.usePoolMode = false;
      return;
    }

    if (!this.usePoolMode) {
      console.log('ℹ️ Browser pool disabled via BROWSER_POOL_ENABLED=false');
      return;
    }

    if (this.poolInitialized) {
      console.log('⚠️ Browser pool already initialized');
      return;
    }

    try {
      await browserPoolService.initialize({
        vpnMode: false,
        browserFactory: async () => {
          console.log('🌐 Pool: Creating new browser instance with stealth mode...');
          return await chromium.launch({
            headless,
            args: getStealthBrowserArgs()
          });
        }
      });
      
      this.poolInitialized = true;
      console.log('✅ Browser pool initialized for normal mode');
    } catch (error) {
      console.error('❌ Failed to initialize browser pool:', error.message);
      console.log('⚠️ Falling back to single browser mode');
      this.usePoolMode = false;
    }
  }

  /**
   * Get pool status for monitoring
   * @returns {Object|null}
   */
  getPoolStatus() {
    if (!this.usePoolMode || !this.poolInitialized) {
      return null;
    }
    return browserPoolService.getStatus();
  }

  /**
   * Connect to existing Chrome instance via CDP (recommended for VPN extensions)
   * @returns {Promise<Browser>} Connected browser instance
   */
  async connectToExistingChrome() {
    // Use IPv4 explicitly to avoid IPv6 resolution issues
    const chromeWsEndpoint = process.env.CHROME_WS_ENDPOINT || 'http://127.0.0.1:9222';
    console.log(`🔌 Connecting to existing Chrome instance at: ${chromeWsEndpoint}`);
    console.log('ℹ️ Make sure Chrome is running with: --remote-debugging-port=9222');
    console.log('ℹ️ IMPORTANT: Chrome must have at least one page/tab open for extensions to work');
    
    try {
      const browser = await chromium.connectOverCDP(chromeWsEndpoint);
      console.log('✅ Connected to existing Chrome instance with VPN');
      
      // Get existing contexts
      const contexts = browser.contexts();
      console.log(`📊 Found ${contexts.length} existing context(s)`);
      
      // NEW: Log all pages across all contexts to debug Issue 2
      for (let i = 0; i < contexts.length; i++) {
        const context = contexts[i];
        const pages = context.pages();
        console.log(`📄 Context ${i + 1} has ${pages.length} page(s)`);
        for (let j = 0; j < pages.length; j++) {
          const page = pages[j];
          const url = page.url();
          console.log(`   Page ${j + 1}: ${url}`);
        }
      }
      
      if (contexts.length > 0) {
        // Use the first existing context (should have extensions)
        this.persistentContext = contexts[0];
        this.usingPersistentContext = true;
        console.log('✅ Using existing Chrome context with VPN extension');
        
        // Check if context has pages
        const pages = this.persistentContext.pages();
        console.log(`📄 Context has ${pages.length} page(s)`);
        
        // If no pages, create one to ensure context is active
        if (pages.length === 0) {
          console.log('📄 Creating initial page in existing context...');
          await this.persistentContext.newPage();
        }
        
        // Verify extension is loaded
        await this.verifyExtensionLoaded();
        
        return browser;
      }
      
      // No contexts exist - this means Chrome was launched but has no pages
      // Create a context - extensions should still be available at browser level
      console.log('⚠️ No existing contexts found - creating new context');
      console.log('⚠️ Extensions should still work as they are loaded at browser level');
      const context = await browser.newContext();
      this.persistentContext = context;
      this.usingPersistentContext = true;
      
      // Create a page to activate the context
      await context.newPage();
      
      // Verify extension is loaded
      await this.verifyExtensionLoaded();
      
      return browser;
      
    } catch (error) {
      console.error('❌ Failed to connect to existing Chrome:', error.message);
      
      // Check if it's a connection refused error
      if (error.message.includes('ECONNREFUSED') || error.message.includes('connect')) {
        console.error('❌ Connection refused - Chrome may not be running with remote debugging');
        console.error('ℹ️ Launch Chrome manually with:');
        const userDataDir = process.env.CHROME_USER_DATA_DIR;
        if (userDataDir) {
          console.error(`   chrome.exe --remote-debugging-port=9222 --user-data-dir="${userDataDir}" --profile-directory="Profile 5"`);
        } else {
          console.error('   chrome.exe --remote-debugging-port=9222');
        }
        console.error('ℹ️ IMPORTANT: Open at least one page/tab in Chrome before starting agent service');
        console.error('ℹ️ Then ensure Urban VPN is connected before starting the agent service');
      }
      
      throw error;
    }
  }

  /**
   * Launch persistent context with VPN extension (fallback if CDP not available)
   * @param {string} userDataDir - Chrome user data directory path
   * @returns {Promise<void>}
   */
  async launchPersistentContextWithVpn(userDataDir) {
    console.log('🌐 Launching persistent browser context with VPN extension...');
    console.log(`📁 [DEV] Using Chrome profile: ${userDataDir}`);
    
    // Build args with VPN extension if provided
    const args = [...getStealthBrowserArgs()];
    const vpnExtensionPath = process.env.URBAN_VPN_EXTENSION_PATH;
    
    if (vpnExtensionPath) {
      // Normalize Windows path for Chrome args
      const normalizedPath = vpnExtensionPath.replace(/\\/g, '/');
      args.push(`--disable-extensions-except=${normalizedPath}`);
      args.push(`--load-extension=${normalizedPath}`);
      console.log(`🔌 Loading Urban VPN extension: ${normalizedPath}`);
      console.log('⚠️ NOTE: Chrome 137+ may have deprecated --load-extension flag');
    } else {
      console.warn('⚠️ URBAN_VPN_EXTENSION_PATH not set - VPN extension will not be loaded');
    }
    
    this.persistentContext = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: args,
      userAgent: getRealisticUserAgent(),
      viewport: { width: 1280, height: 720 },
      locale: 'en-GB',
      timezoneId: 'Europe/London',
      permissions: [],
      colorScheme: 'light'
    });
    
    // Inject stealth script
    await this.persistentContext.addInitScript(getStealthInitScript());
    this.usingPersistentContext = true;
    console.log('✅ Persistent context created');
    
    // Brief wait for extension to initialize
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('⏳ Waited 3s for VPN extension to initialize');
    
    // Verify extension loaded
    await this.verifyExtensionLoaded();
  }

  /**
   * Verify VPN extension is loaded and working
   */
  async verifyExtensionLoaded() {
    if (!this.persistentContext) return;
    
    try {
      // Method 1: Try to check chrome://extensions (may not work via CDP)
      try {
        const testPage = await this.persistentContext.newPage();
        await testPage.goto('chrome://extensions', { waitUntil: 'domcontentloaded', timeout: 5000 });
        await testPage.waitForTimeout(2000);
        
        // Check extension count
        const extensionCount = await testPage.evaluate(() => {
          const items = document.querySelectorAll('extensions-item');
          return items.length;
        });
        
        console.log(`📊 Extensions visible in chrome://extensions: ${extensionCount}`);
        
        if (extensionCount > 0) {
          // Try to find Urban VPN extension
          const extensionInfo = await testPage.evaluate(() => {
            const items = Array.from(document.querySelectorAll('extensions-item'));
            return items.map(item => {
              const nameEl = item.shadowRoot?.querySelector('#name');
              return nameEl?.textContent?.trim() || 'Unknown';
            });
          });
          
          const urbanVpn = extensionInfo.find(name => 
            name.toLowerCase().includes('urban') || name.toLowerCase().includes('vpn')
          );
          
          if (urbanVpn) {
            console.log(`✅ Urban VPN extension detected: ${urbanVpn}`);
          }
        }
        
        await testPage.close();
      } catch (error) {
        console.log('⚠️ Could not check chrome://extensions (this is normal for CDP connections)');
      }
      
      // Method 2: Test VPN connectivity (more reliable)
      try {
        const vpnTestPage = await this.persistentContext.newPage();
        console.log('🌐 Testing VPN connectivity...');
        
        await vpnTestPage.goto('https://api.ipify.org?format=json', { 
          waitUntil: 'networkidle', 
          timeout: 10000 
        });
        
        const ipInfo = await vpnTestPage.evaluate(() => {
          return JSON.parse(document.body.textContent);
        });
        
        console.log(`🌐 Current IP address: ${ipInfo.ip}`);
        console.log('ℹ️ If VPN is working, this should be a UK IP address');
        console.log('ℹ️ If it shows your local IP, VPN is not active');
        
        await vpnTestPage.close();
      } catch (error) {
        console.warn('⚠️ Could not test VPN connectivity:', error.message);
        console.warn('ℹ️ This might indicate VPN is not working or network issue');
      }
      
      // Method 3: For CDP connections, extensions ARE loaded (just not visible in chrome://extensions)
      if (this.usingPersistentContext) {
        console.log('ℹ️ CDP connection active - extensions from Chrome instance are available');
        console.log('ℹ️ Ensure Urban VPN is connected in the Chrome window');
      }
      
    } catch (error) {
      console.warn('⚠️ Error verifying extensions:', error.message);
    }
  }

  async getBrowser() {
    // DEVELOPMENT ONLY: Check if we should use VPN mode
    const userDataDir = process.env.CHROME_USER_DATA_DIR;
    const usePersistentContext = userDataDir && process.env.NODE_ENV !== 'production';
    
    if (usePersistentContext) {
      // VPN mode - use single persistent context (pool not applicable)
      // Check if we already have a persistent context
      if (this.persistentContext) {
        try {
          const browser = this.persistentContext.browser();
          if (browser && browser.isConnected()) {
            return browser;
          }
        } catch (error) {
          console.log('⚠️ Persistent context disconnected, will recreate');
          this.persistentContext = null;
        }
      }
      
      // Option 1: Connect to existing Chrome instance (RECOMMENDED for VPN)
      const connectToExistingChrome = process.env.CONNECT_TO_EXISTING_CHROME === 'true';
      if (connectToExistingChrome) {
        try {
          return await this.connectToExistingChrome();
        } catch (error) {
          console.error('❌ CDP connection failed. Cannot fallback to persistent context because Chrome is already running.');
          console.error('❌ Please ensure Chrome is running with remote debugging enabled.');
          console.error('❌ Or set CONNECT_TO_EXISTING_CHROME=false to use persistent context instead.');
          throw new Error('CDP connection failed and fallback not possible: ' + error.message);
        }
      }
      
      // Option 2: Launch persistent context with VPN extension (only if CDP not enabled)
      if (!this.persistentContext) {
        await this.launchPersistentContextWithVpn(userDataDir);
      }
      
      // Return the browser instance from persistent context
      return this.persistentContext.browser();
    }
    
    // Normal mode (no VPN) - use pool if available
    if (this.usePoolMode && this.poolInitialized) {
      return await this.getBrowserFromPool();
    }
    
    // Fallback: Single browser mode (pool not initialized)
    if (this.browserInstance && this.browserInstance.isConnected()) {
      return this.browserInstance;
    }
    
    // Launch new browser with stealth arguments
    console.log('🌐 Launching new browser instance with stealth mode...');
    console.log('🌐 [PROD] Using default browser profile (no VPN needed)');
    
    this.browserInstance = await chromium.launch({ 
      headless,
      args: getStealthBrowserArgs()
    });
    
    this.usingPersistentContext = false;
    return this.browserInstance;
  }

  /**
   * Get browser from pool (for normal mode only)
   * @returns {Promise<import('playwright').Browser>}
   */
  async getBrowserFromPool() {
    try {
      // Release previous browser if still held
      if (this.currentPooledBrowser) {
        console.log('🔄 Releasing previously held pooled browser');
        await browserPoolService.release(this.currentPooledBrowser);
        this.currentPooledBrowser = null;
      }

      // Acquire browser from pool
      this.currentPooledBrowser = await browserPoolService.acquire();
      console.log(`✅ Acquired browser from pool: ${this.currentPooledBrowser.id}`);
      
      return this.currentPooledBrowser.browser;
    } catch (error) {
      console.error('❌ Failed to acquire browser from pool:', error.message);
      
      // Fallback to single browser mode
      console.log('⚠️ Falling back to single browser mode');
      this.usePoolMode = false;
      
      if (this.browserInstance && this.browserInstance.isConnected()) {
        return this.browserInstance;
      }
      
      this.browserInstance = await chromium.launch({
        headless,
        args: getStealthBrowserArgs()
      });
      
      return this.browserInstance;
    }
  }

  /**
   * Release browser back to pool (call when done with browser operations)
   * @param {Object} [options] - Release options
   * @param {boolean} [options.recycle] - Force browser recycling
   */
  async releaseBrowserToPool(options = {}) {
    if (!this.usePoolMode || !this.currentPooledBrowser) {
      return;
    }
    
    try {
      await browserPoolService.release(this.currentPooledBrowser, options);
      console.log(`🔄 Released browser to pool: ${this.currentPooledBrowser.id}`);
      this.currentPooledBrowser = null;
    } catch (error) {
      console.warn('⚠️ Error releasing browser to pool:', error.message);
      this.currentPooledBrowser = null;
    }
  }

  async getContext(progressCallback = null) {
    // If using persistent context (VPN mode), return it directly
    if (this.usingPersistentContext && this.persistentContext) {
      // Check if context is still valid
      try {
        const browser = this.persistentContext.browser();
        if (browser && browser.isConnected()) {
          console.log('✅ Reusing persistent context (VPN mode)');
          return this.persistentContext;
        }
      } catch (error) {
        console.log('⚠️ Persistent context disconnected, will recreate');
        this.persistentContext = null;
        this.usingPersistentContext = false;
      }
    }
    
    // Normal mode - Check if existing context is still valid
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
    
    // CRITICAL FIX: After getBrowser(), check again if persistent context was created
    // This handles the case where getBrowser() sets up persistent context for VPN mode
    if (this.usingPersistentContext && this.persistentContext) {
      try {
        const persistentBrowser = this.persistentContext.browser();
        if (persistentBrowser && persistentBrowser.isConnected()) {
          console.log('✅ Using persistent context from getBrowser() (VPN mode)');
          return this.persistentContext;
        }
      } catch (error) {
        console.log('⚠️ Persistent context from getBrowser() is invalid');
        this.persistentContext = null;
        this.usingPersistentContext = false;
      }
    }
    
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
    // CRITICAL: Always check persistent context FIRST to avoid creating duplicate instances
    if (this.usingPersistentContext && this.persistentContext) {
      try {
        const browser = this.persistentContext.browser();
        if (browser && browser.isConnected()) {
          console.log('✅ Using persistent context for public page (VPN mode)');
          return this.persistentContext;
        }
      } catch (error) {
        console.log('⚠️ Persistent context disconnected');
        this.persistentContext = null;
        this.usingPersistentContext = false;
      }
    }
    
    // If persistent context doesn't exist yet, create it via getBrowser()
    // This ensures we only have ONE browser instance
    const browser = await this.getBrowser();
    
    // If we're using persistent context, return it directly (no need for new context)
    if (this.usingPersistentContext && this.persistentContext) {
      return this.persistentContext;
    }
    
    // Normal mode - Create a new context without authentication (for public pages)
    const context = await browser.newContext({
      userAgent: getRealisticUserAgent(),
      viewport: { width: 1280, height: 720 },
      locale: 'en-GB',
      timezoneId: 'Europe/London',
      permissions: [],
      colorScheme: 'light'
    });
    
    // Add stealth script
    await context.addInitScript(getStealthInitScript());
    
    return context;
  }

  async cleanup() {
    try {
      // Release current pooled browser if held
      if (this.currentPooledBrowser) {
        try {
          await browserPoolService.release(this.currentPooledBrowser);
          console.log('🧹 Released current pooled browser');
        } catch (error) {
          console.warn('⚠️ Error releasing pooled browser:', error.message);
        }
        this.currentPooledBrowser = null;
      }

      // Cleanup persistent context if exists (VPN mode)
      if (this.persistentContext) {
        try {
          const browser = this.persistentContext.browser();
          if (browser && browser.isConnected()) {
            await this.persistentContext.close();
            console.log('🧹 Persistent context closed');
          } else {
            console.log('🧹 Persistent context already closed or disconnected');
          }
        } catch (error) {
          if (error.message.includes('closed') || error.message.includes('Target page')) {
            console.log('🧹 Persistent context was already closed');
          } else {
            console.warn('⚠️ Error closing persistent context:', error.message);
          }
        }
        this.persistentContext = null;
        this.usingPersistentContext = false;
      }
      
      // Cleanup normal browser context
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
      
      // Cleanup normal browser instance (only if not using pool)
      if (this.browserInstance && !this.usePoolMode) {
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

  /**
   * Shutdown browser pool (call on service shutdown)
   * @returns {Promise<void>}
   */
  async shutdownPool() {
    if (this.usePoolMode && this.poolInitialized) {
      console.log('🛑 Shutting down browser pool...');
      await browserPoolService.shutdown();
      this.poolInitialized = false;
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

