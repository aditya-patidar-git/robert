import { takeScreenshot } from './utils.js';

const CRM_NAVIGATION_TIMEOUT_MS = 60000;

/**
 * Step 2: Login to CRM using cookie-based authentication
 * @param {Page} page - Playwright page object
 * @param {Object} credentials - CRM credentials object
 * @param {string} credentials.loginUrl - CRM login URL
 * @param {string} credentials.loginName - Login name
 * @param {string} credentials.username - Username
 * @param {string} credentials.password - Password
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates
 */
export async function loginToCRM(page, credentials, screenshotsDir, progressCallback = null) {
  try {
    // If page is at about:blank or not on CRM, navigate first
    const currentUrl = page.url();
    if (currentUrl === 'about:blank' || !currentUrl.includes('takeabyte.co.uk/InContact')) {
      progressCallback?.({ message: 'Opening your account.' });
      console.log('🔐 [STEP 2] Page not on CRM, navigating to CRM...');
      await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'load', timeout: CRM_NAVIGATION_TIMEOUT_MS });
      // Use 'load' instead of 'networkidle' - networkidle can timeout on pages with continuous requests
      try {
        await page.waitForLoadState('load', { timeout: 10000 });
      } catch (e) {
        console.log('⚠️ [STEP 2] Load state timeout, continuing anyway...');
      }
    }
    
    // Check if already logged in
    const loginIndicators = [
      'text=/Dashboard|Contacts|Diaries/i',
      'h3.list-menu-item-heading:has-text("Contacts")',
      'h3.list-menu-item-heading:has-text("Dashboard")'
    ];
    
    let isAlreadyLoggedIn = false;
    for (const selector of loginIndicators) {
      try {
        isAlreadyLoggedIn = await page.locator(selector).first().isVisible({ timeout: 5000 }).catch(() => false);
        if (isAlreadyLoggedIn) break;
      } catch (e) {
        // Continue to next indicator
      }
    }
    
    if (isAlreadyLoggedIn) {
      if (currentUrl.includes('/Account/Login')) {
        await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'load', timeout: CRM_NAVIGATION_TIMEOUT_MS });
        await page.waitForTimeout(2000);
      }
      await takeScreenshot(page, 'step-2-already-logged-in.png', screenshotsDir);
      return true; // Return success status
    }
    
    // Step 1: Navigate to CRM_LOGIN_URL
    progressCallback?.({ message: 'Logging into the system.' });
    console.log('🔐 [STEP 2] Navigating to CRM login URL...');
    await page.goto(credentials.loginUrl, { waitUntil: 'load', timeout: CRM_NAVIGATION_TIMEOUT_MS });
    // Use 'load' instead of 'networkidle' - networkidle can timeout on pages with continuous requests
    try {
      await page.waitForLoadState('load', { timeout: 10000 });
    } catch (e) {
      console.log('⚠️ [STEP 2] Load state timeout after navigation to login URL, continuing anyway...');
    }
    
    // Take screenshot of login page
    await takeScreenshot(page, 'login-page-loaded.png', screenshotsDir);
    
    // Step 2: Set authentication cookies
    progressCallback?.({ message: 'Opening your account.' });
    console.log('🍪 [STEP 2] Setting authentication cookies...');
    const crmHomeUrl = process.env.CRM_HOME_URL || 'https://takeabyte.co.uk/InContact';
    const loginUrlObj = new URL(credentials.loginUrl);
    const domain = loginUrlObj.hostname;
    
    // Get cookie values from environment
    const cName = process.env.CRM_LOGIN_NAME || credentials.loginName;
    const uName = process.env.CRM_USERNAME || credentials.username;
    
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
    
    console.log('✅ [STEP 2] Cookies set successfully');
    
    // Step 3: Navigate to CRM_HOME_URL and reload
    progressCallback?.({ message: 'Opening the dashboard.' });
    console.log('🔐 [STEP 2] Navigating to CRM home URL...');
    await page.goto(crmHomeUrl, { waitUntil: 'load', timeout: CRM_NAVIGATION_TIMEOUT_MS });
    await page.reload({ waitUntil: 'load', timeout: CRM_NAVIGATION_TIMEOUT_MS });
    await page.waitForTimeout(2000);
    
    // Take screenshot after navigation
    await takeScreenshot(page, 'login-attempted.png', screenshotsDir);
    
    // Step 4: Verify we're on Contacts page
    let loginSucceeded = false;
    try {
      // Wait for the sidebar to appear with Contacts tab
      await page.waitForSelector('h3.list-menu-item-heading:has-text("Contacts")', { timeout: 10000 });
      
      // Additional verification - check if login form is gone
      const stillOnLoginPage = await page.locator('#Loginname').isVisible({ timeout: 2000 }).catch(() => false);
      if (!stillOnLoginPage) {
        loginSucceeded = true;
        console.log('✅ [STEP 2] Login successful - sidebar with Contacts tab found');
      } else {
        console.error('❌ [STEP 2] Login verification failed - still on login page');
      }
    } catch (verifyError) {
      console.error('❌ [STEP 2] Login verification failed - Contacts tab not found:', verifyError.message);
      // Check current URL to see where we are
      const currentUrl = page.url();
      console.error(`   Current URL: ${currentUrl}`);
      if (currentUrl.includes('/Account/Login')) {
        throw new Error('Login failed - still on login page after verification timeout');
      }
    }
    
    // CRITICAL: Ensure we're on CRM dashboard after login, not on availability URL
    const finalUrl = page.url();
    if (finalUrl.includes('bookcbtnow.com') || finalUrl.includes('gateway.aspx')) {
      console.log('🔐 [STEP 2] Page is on availability URL after login, navigating to CRM dashboard...');
      await page.goto(crmHomeUrl, { waitUntil: 'networkidle', timeout: CRM_NAVIGATION_TIMEOUT_MS });
      await page.waitForTimeout(2000);
      
      // Verify we're on the dashboard
      await page.waitForSelector('h3.list-menu-item-heading:has-text("Contacts")', { timeout: 10000 });
      console.log('✅ [STEP 2] Successfully navigated to CRM dashboard');
      loginSucceeded = true;
    } else if (!finalUrl.includes('takeabyte.co.uk/InContact') || finalUrl.includes('/Account/Login')) {
      // If we're not on CRM dashboard or still on login page, navigate to dashboard
      console.log('🔐 [STEP 2] Navigating to CRM dashboard...');
      await page.goto(crmHomeUrl, { waitUntil: 'load', timeout: CRM_NAVIGATION_TIMEOUT_MS });
      await page.waitForTimeout(2000);
      await page.waitForSelector('h3.list-menu-item-heading:has-text("Contacts")', { timeout: 10000 });
      console.log('✅ [STEP 2] Successfully navigated to CRM dashboard');
      loginSucceeded = true;
    }
    
    if (!loginSucceeded) {
      throw new Error('Login verification failed - could not confirm successful login');
    }
    
    return true; // Return success status
    
  } catch (error) {
    console.error('❌ [STEP 2] Login failed:', error);
    await takeScreenshot(page, 'login-error.png', screenshotsDir);
    throw new Error(`[STEP 2] CRM login failed: ${error.message}`);
  }
}

