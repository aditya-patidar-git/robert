import { takeScreenshot } from './utils.js';

/**
 * Step 2: Login to CRM
 * @param {Page} page - Playwright page object
 * @param {Object} credentials - CRM credentials object
 * @param {string} credentials.loginUrl - CRM login URL
 * @param {string} credentials.loginName - Login name
 * @param {string} credentials.username - Username
 * @param {string} credentials.password - Password
 * @param {string} screenshotsDir - Directory to save screenshots
 */
export async function loginToCRM(page, credentials, screenshotsDir) {
  try {
    // If page is at about:blank or not on CRM, navigate first
    const currentUrl = page.url();
    if (currentUrl === 'about:blank' || !currentUrl.includes('takeabyte.co.uk/InContact')) {
      console.log('🔐 [STEP 2] Page not on CRM, navigating to CRM...');
      await page.goto('https://takeabyte.co.uk/InContact');
      await page.waitForLoadState('networkidle');
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
        await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
      }
      await takeScreenshot(page, 'step-2-already-logged-in.png', screenshotsDir);
      return true; // Return success status
    }
    
    await page.goto(credentials.loginUrl);
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of login page
    await takeScreenshot(page, 'login-page-loaded.png', screenshotsDir);
    
    // Fill login form
    const loginNameField = page.locator('#Loginname input.dx-texteditor-input');
    await loginNameField.fill(credentials.loginName);
    await page.waitForTimeout(1000);
    
    const usernameField = page.locator('#Username input.dx-texteditor-input');
    await usernameField.fill(credentials.username);
    await page.waitForTimeout(1000);
    
    const passwordField = page.locator('#UserPassword input.dx-texteditor-input');
    await passwordField.fill(credentials.password);
    await page.waitForTimeout(1000);
    
    await page.locator('body').click({ position: { x: 100, y: 100 } });
    await page.waitForTimeout(2000);
    
    // Click Login button
    const loginButton = page.locator('#btnLogin');
    await loginButton.click();
    
    await page.waitForLoadState('networkidle');
    
    // Take screenshot after login attempt
    await takeScreenshot(page, 'login-attempted.png', screenshotsDir);
    
    // Verify login success by looking for the sidebar with Contacts tab
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
      await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      
      // Verify we're on the dashboard
      await page.waitForSelector('h3.list-menu-item-heading:has-text("Contacts")', { timeout: 10000 });
      console.log('✅ [STEP 2] Successfully navigated to CRM dashboard');
      loginSucceeded = true;
    } else if (!finalUrl.includes('takeabyte.co.uk/InContact') || finalUrl.includes('/Account/Login')) {
      // If we're not on CRM dashboard or still on login page, navigate to dashboard
      console.log('🔐 [STEP 2] Navigating to CRM dashboard...');
      await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'networkidle' });
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

