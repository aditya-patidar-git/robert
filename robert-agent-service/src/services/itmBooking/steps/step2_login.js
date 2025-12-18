import * as commonSteps from '../../commonBookingSteps/index.js';

/**
 * Step 2: Login to CRM
 * Verifies login status and navigates to Contacts page
 */
export async function step2Login(page, crmCredentials, screenshotsDir, screenshots) {
  console.log('🔐 Step 2: Logging into CRM...');
  const loginIndicators = [
    'text=/Dashboard|Contacts|Diaries/i',
    'h3.list-menu-item-heading:has-text("Contacts")',
    'h3.list-menu-item-heading:has-text("Dashboard")'
  ];
  
  let isAlreadyLoggedIn = false;
  for (const selector of loginIndicators) {
    try {
      isAlreadyLoggedIn = await page.locator(selector).first().isVisible({ timeout: 3000 }).catch(() => false);
      if (isAlreadyLoggedIn) break;
    } catch (e) {
      // Continue to next indicator
    }
  }
  
  if (!isAlreadyLoggedIn) {
    const loginSuccess = await commonSteps.loginToCRM(page, crmCredentials, screenshotsDir);
    
    if (!loginSuccess) {
      throw new Error('Step 2: Login verification failed');
    }
    
    // CRITICAL: Ensure we're on CRM dashboard, not on availability URL
    const currentUrl = page.url();
    console.log(`🔐 Step 2: Current URL after login: ${currentUrl}`);
    if (currentUrl.includes('bookcbtnow.com') || currentUrl.includes('gateway.aspx') || currentUrl.includes('func_id=')) {
      console.log('🔐 Step 2: Page is on availability URL - navigating to CRM dashboard...');
      await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await page.waitForSelector('h3.list-menu-item-heading:has-text("Contacts")', { timeout: 10000 });
      console.log('✅ Step 2: Confirmed on CRM dashboard after navigation');
    } else {
      console.log('✅ Step 2: Already on CRM dashboard (not on availability URL)');
    }
    
    // Navigate to Contacts tab after login
    try {
      const contactsTab = page.locator('h3.list-menu-item-heading:has-text("Contacts")').first();
      if (await contactsTab.isVisible({ timeout: 5000 })) {
        console.log('🔐 Step 2: Clicking Contacts tab to navigate to Contacts page...');
        await contactsTab.click();
        await page.waitForTimeout(2000);
        // Wait for Contacts page to load
        await page.waitForSelector('input[type="text"][placeholder*="Search"], input[type="text"][name*="search"], input[type="text"][id*="search"], table.contacts-table, div.contacts-list', { timeout: 10000 }).catch(() => {
          console.log('⚠️ Step 2: Contacts page elements not found, but continuing...');
        });
        console.log('✅ Step 2: Navigated to Contacts page');
      }
    } catch (e) {
      console.warn('⚠️ Step 2: Could not navigate to Contacts tab:', e.message);
    }
    
    screenshots.push(await commonSteps.takeScreenshot(page, 'step-2-login-success.png', screenshotsDir));
    console.log('✅ Step 2 completed: Logged into CRM');
  } else {
    // Already logged in - ensure we're on CRM dashboard, not availability page
    const currentUrl = page.url();
    console.log(`🔐 Step 2: Current URL (already logged in): ${currentUrl}`);
    if (currentUrl.includes('bookcbtnow.com') || currentUrl.includes('gateway.aspx') || currentUrl.includes('func_id=')) {
      console.log('🔐 Step 2: Page is on availability URL - navigating to CRM dashboard...');
      await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await page.waitForSelector('h3.list-menu-item-heading:has-text("Contacts")', { timeout: 10000 });
      console.log('✅ Step 2: Confirmed on CRM dashboard after navigation');
    } else if (currentUrl.includes('/Account/Login')) {
      console.log('🔐 Step 2: Page is on login page - navigating to CRM dashboard...');
      await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await page.waitForSelector('h3.list-menu-item-heading:has-text("Contacts")', { timeout: 10000 });
      console.log('✅ Step 2: Confirmed on CRM dashboard after navigation');
    } else {
      console.log('✅ Step 2: Already on CRM dashboard (not on availability URL)');
    }
    
    // Navigate to Contacts tab (even if already logged in)
    try {
      const contactsTab = page.locator('h3.list-menu-item-heading:has-text("Contacts")').first();
      if (await contactsTab.isVisible({ timeout: 5000 })) {
        console.log('🔐 Step 2: Clicking Contacts tab to navigate to Contacts page...');
        await contactsTab.click();
        await page.waitForTimeout(2000);
        // Wait for Contacts page to load
        await page.waitForSelector('input[type="text"][placeholder*="Search"], input[type="text"][name*="search"], input[type="text"][id*="search"], table.contacts-table, div.contacts-list', { timeout: 10000 }).catch(() => {
          console.log('⚠️ Step 2: Contacts page elements not found, but continuing...');
        });
        console.log('✅ Step 2: Navigated to Contacts page');
      }
    } catch (e) {
      console.warn('⚠️ Step 2: Could not navigate to Contacts tab:', e.message);
    }
    
    screenshots.push(await commonSteps.takeScreenshot(page, 'step-2-already-logged-in.png', screenshotsDir));
    console.log('✅ Step 2 completed: Already authenticated');
  }
  
  return { success: true };
}

