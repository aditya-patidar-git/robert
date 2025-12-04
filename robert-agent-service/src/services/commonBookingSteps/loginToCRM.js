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
    console.log('🔐 [STEP 2] Navigating to CRM login page...');
    
    await page.goto(credentials.loginUrl);
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of login page
    await takeScreenshot(page, 'login-page-loaded.png', screenshotsDir);
    
    // Fill login form with correct selectors
    console.log('📝 Filling login form...');
    
    // Login Name field
    const loginNameField = page.locator('#Loginname input.dx-texteditor-input');
    await loginNameField.fill(credentials.loginName);
    
    // Username field
    const usernameField = page.locator('#Username input.dx-texteditor-input');
    await usernameField.fill(credentials.username);
    
    // Password field
    const passwordField = page.locator('#UserPassword input.dx-texteditor-input');
    await passwordField.fill(credentials.password);
    
    // Wait for form fields to sync before clicking login button
    console.log('⏳ Waiting for form fields to sync...');
    await page.waitForTimeout(2500); // 2.5 seconds to allow form fields to sync
    
    // Click Login button
    const loginButton = page.locator('#btnLogin');
    await loginButton.click();
    
    await page.waitForLoadState('networkidle');
    
    // Take screenshot after login attempt
    await takeScreenshot(page, 'login-attempted.png', screenshotsDir);
    
    // Verify login success by looking for the sidebar with Contacts tab
    try {
      // Wait for the sidebar to appear with Contacts tab
      await page.waitForSelector('h3.list-menu-item-heading:has-text("Contacts")', { timeout: 10000 });
      
      // Additional verification - check if login form is gone
      const stillOnLoginPage = await page.locator('#Loginname').isVisible();
      if (stillOnLoginPage) {
        throw new Error('Login failed - still on login page');
      }
      
      console.log('✅ [STEP 2] Login successful - sidebar with Contacts tab found');
      
    } catch (verifyError) {
      console.log('⚠️ [STEP 2] Login verification failed, but continuing...');
      // Don't throw error, just log and continue
    }
    
  } catch (error) {
    console.error('❌ [STEP 2] Login failed:', error);
    await takeScreenshot(page, 'login-error.png', screenshotsDir);
    throw new Error(`[STEP 2] CRM login failed: ${error.message}`);
  }
}

