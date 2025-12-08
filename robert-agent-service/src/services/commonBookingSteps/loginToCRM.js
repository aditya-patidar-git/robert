import { takeScreenshot } from './utils.js';
import { waitForRecaptchaReady, simulateHumanBehaviorBeforeSubmit, generateBezierPath } from '../../utils/stealthUtils.js';

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
    
    // Initial human-like behavior: simulate reading the page
    console.log('📖 Simulating reading the login page...');
    await page.waitForTimeout(2000 + Math.random() * 2000);
    
    // Small random scroll to simulate reading
    await page.evaluate(() => {
      window.scrollBy(0, Math.random() * 50);
    });
    await page.waitForTimeout(500 + Math.random() * 500);
    
    // Take screenshot of login page
    await takeScreenshot(page, 'login-page-loaded.png', screenshotsDir);
    
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
    await loginNameField.type(credentials.loginName, { delay: 30 + Math.random() * 50 });
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
    await usernameField.type(credentials.username, { delay: 30 + Math.random() * 50 });
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
    await passwordField.type(credentials.password, { delay: 50 + Math.random() * 100 });
    await passwordField.blur();
    await page.waitForTimeout(1500 + Math.random() * 1000);
    
    // Trigger form events
    await page.locator('body').click({ position: { x: 100, y: 100 } });
    await page.waitForTimeout(1000);
    
    // Wait for reCAPTCHA to execute and calculate score
    await waitForRecaptchaReady(page, 5000);
    
    // Additional wait to let reCAPTCHA observe more behavior
    await page.waitForTimeout(2000 + Math.random() * 2000);
    
    // Simulate human behavior before clicking login button
    const formLocator = page.locator('form').first();
    await simulateHumanBehaviorBeforeSubmit(page, formLocator, loginButton);
    
    // Click Login button
    console.log('🔐 Clicking login button...');
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

