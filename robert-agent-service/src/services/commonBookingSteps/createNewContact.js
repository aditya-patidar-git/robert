import { takeScreenshot } from './utils.js';

/**
 * Step 6 (New client workflow): Click "New contact" button
 * @param {Page} page - Playwright page object
 * @param {string} screenshotsDir - Directory to save screenshots
 */
export async function createNewContact(page, screenshotsDir) {
  try {
    console.log('👤 [STEP 6] Clicking "New contact" button...');
    
    // CRITICAL FIX: Wait for iframe to appear after Step 5 (NEXT button click)
    // The iframe should already exist from Step 4, but may reload after Step 5
    // Use waitForSelector instead of fixed timeout for reliability
    console.log('⏳ [STEP 6] Waiting for contact choice page iframe to load...');
    
    try {
      // Wait for iframe to be attached to DOM (it should exist from Step 4)
      // After Step 5 clicks "NEXT", the iframe content reloads with contact choice page
      await page.waitForSelector('#eventNewBooking2_iframe', { 
        state: 'attached', 
        timeout: 15000  // Increased timeout for CBT Executive and other workflows
      });
      console.log('✅ [STEP 6] Contact choice page iframe found');
    } catch (iframeError) {
      // If iframe doesn't appear, provide helpful error message with context
      const currentUrl = page.url();
      console.error(`❌ [STEP 6] Iframe not found. Current URL: ${currentUrl}`);
      throw new Error(`eventNewBooking2_iframe not found after Step 5 - the contact choice page may not have loaded. This usually means Step 5 (selectBookingOptions) did not complete successfully or the page did not navigate correctly. Current URL: ${currentUrl}`);
    }
    
    // The contact choice page is inside eventNewBooking2_iframe
    console.log('🔍 [STEP 6] Verifying contact choice page iframe is accessible...');
    const eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
    
    if (!eventBookingIframeExists) {
      const currentUrl = page.url();
      throw new Error(`eventNewBooking2_iframe not found - contact choice page may not have loaded. Current URL: ${currentUrl}`);
    }
    
    const eventBookingIframe = page.frameLocator('#eventNewBooking2_iframe');
    
    // Wait for iframe content to be ready (content may still be loading)
    await page.waitForTimeout(2000);
    
    // Should see "Contact choice" or "3. Contact" page with two options
    console.log('🔍 [STEP 6] Looking for contact choice page indicators...');
    const contactChoiceIndicators = [
      '#btnBookNew',  // New contact button ID (most reliable)
      'text=Contact choice',
      'text=3. Contact',
      'text=Choose one of these options',
      '[aria-label="New contact..."]',  // Button aria-label
      'button:has-text("New contact...")'  // Button with ellipsis
    ];
    
    let contactPageFound = false;
    for (const indicator of contactChoiceIndicators) {
      const element = eventBookingIframe.locator(indicator).first();
      if (await element.count() > 0) {
        const isVisible = await element.isVisible().catch(() => false);
        if (isVisible) {
          console.log(`✅ [STEP 6] Found contact choice page indicator: "${indicator}"`);
          contactPageFound = true;
          break;
        }
      }
    }
    
    if (!contactPageFound) {
      console.log('⚠️ [STEP 6] Contact choice page indicators not found, but continuing...');
    }
    
    // Take screenshot of contact page
    await takeScreenshot(page, 'contact-choice-page-loaded.png', screenshotsDir);
    
    // Click "New contact" button
    // Priority order: ID > aria-label > text with ellipsis > text without ellipsis > class > role-based
    console.log('👆 [STEP 6] Clicking "New contact" button...');
    let newContactButton;
    let selectorUsed = '';
    
    // Primary: ID selector (most reliable)
    newContactButton = eventBookingIframe.locator('#btnBookNew').first();
    if (await newContactButton.count() > 0) {
      selectorUsed = '#btnBookNew';
    } else {
      // Fallback 1: aria-label selector
      newContactButton = eventBookingIframe.locator('[aria-label="New contact..."]').first();
      if (await newContactButton.count() > 0) {
        selectorUsed = '[aria-label="New contact..."]';
      } else {
        // Fallback 2: text selector with ellipsis
        newContactButton = eventBookingIframe.locator('button:has-text("New contact...")').first();
        if (await newContactButton.count() > 0) {
          selectorUsed = 'button:has-text("New contact...")';
        } else {
          // Fallback 3: text selector without ellipsis
          newContactButton = eventBookingIframe.locator('button:has-text("New contact")').first();
          if (await newContactButton.count() > 0) {
            selectorUsed = 'button:has-text("New contact")';
          } else {
            // Fallback 4: class selector
            newContactButton = eventBookingIframe.locator('.contactButton, .jqx_button.contactButton').first();
            if (await newContactButton.count() > 0) {
              selectorUsed = '.contactButton or .jqx_button.contactButton';
            } else {
              // Fallback 5: role-based selector
              newContactButton = eventBookingIframe.locator('button[role="button"]:has-text("New")').first();
              if (await newContactButton.count() > 0) {
                selectorUsed = 'button[role="button"]:has-text("New")';
              }
            }
          }
        }
      }
    }
    
    if (await newContactButton.count() === 0) {
      throw new Error('New contact button not found in contact choice page. Tried: ID (#btnBookNew), aria-label, text with ellipsis, text without ellipsis, class selector, and role-based selector.');
    }
    
    console.log(`✅ [STEP 6] Found "New contact" button using selector: ${selectorUsed}`);
    await newContactButton.waitFor({ state: 'visible', timeout: 5000 });
    await newContactButton.click();
    
    // Wait for "3. Contact" page to appear
    console.log('⏳ [STEP 6] Waiting for "3. Contact" page to load...');
    await page.waitForTimeout(3000);
    
    // Verify we're on the contact details page
    const contactPageHeader = eventBookingIframe.locator('text=/3. Contact/i, heading:has-text("Contact")').first();
    await contactPageHeader.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
      console.log('⚠️ [STEP 6] Contact page header not found, but continuing...');
    });
    
    // Take screenshot of contact details page
    await takeScreenshot(page, 'new-contact-page-loaded.png', screenshotsDir);
    
    console.log('✅ [STEP 6] Successfully navigated to "3. Contact" page');
    
  } catch (error) {
    console.error('❌ [STEP 6] Error creating new contact:', error);
    await takeScreenshot(page, 'new-contact-error.png', screenshotsDir);
    throw new Error(`Failed to create new contact: ${error.message}`);
  }
}

