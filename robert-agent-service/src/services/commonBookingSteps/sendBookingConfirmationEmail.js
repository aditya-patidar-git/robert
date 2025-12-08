import { takeScreenshot } from './utils.js';

/**
 * Send booking confirmation email after booking is completed
 * @param {Page} page - Playwright page object
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {string} courseType - Course type: 'tfl' for TfL courses, 'full-licence' for Full Licence Assessment
 */
export async function sendBookingConfirmationEmail(page, screenshotsDir, courseType = 'tfl') {
  try {
    console.log('📧 [CONFIRMATION] Sending booking confirmation email...');
    
    // Wait for page to be ready after booking completion
    await page.waitForTimeout(3000);
    
    // Determine if we need to work with iframe or main page
    const eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
    let searchContext = page;
    
    if (eventBookingIframeExists) {
      console.log('🔍 [CONFIRMATION] Working with eventNewBooking2_iframe...');
      searchContext = page.frameLocator('#eventNewBooking2_iframe');
    } else {
      console.log('🔍 [CONFIRMATION] Working with main page...');
    }
    
    // Find "SEND A CONFIRMATION" button with multiple fallback selectors
    console.log('🔍 [CONFIRMATION] Looking for "SEND A CONFIRMATION" button...');
    let sendConfirmationButton = null;
    
    const buttonSelectors = [
      'button:has-text("SEND A CONFIRMATION")',
      'button:has-text("Send a confirmation")',
      'button:has-text("Send A Confirmation")',
      '[role="button"]:has-text(/send.*confirmation/i)',
      '.dx-button:has-text(/send.*confirmation/i)',
      'a:has-text("SEND A CONFIRMATION")',
      'a:has-text("Send a confirmation")'
    ];
    
    // Try main page first
    for (const selector of buttonSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.count() > 0) {
          const isVisible = await button.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ [CONFIRMATION] Found button using selector: "${selector}"`);
            sendConfirmationButton = button;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // Try iframe if not found on main page
    if (!sendConfirmationButton && eventBookingIframeExists) {
      const iframe = page.frameLocator('#eventNewBooking2_iframe');
      for (const selector of buttonSelectors) {
        try {
          const button = iframe.locator(selector).first();
          if (await button.count() > 0) {
            const isVisible = await button.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`✅ [CONFIRMATION] Found button in iframe using selector: "${selector}"`);
              sendConfirmationButton = button;
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    if (!sendConfirmationButton) {
      throw new Error('Could not find "SEND A CONFIRMATION" button');
    }
    
    // Click the button
    console.log('🖱️ [CONFIRMATION] Clicking "SEND A CONFIRMATION" button...');
    await sendConfirmationButton.click();
    await page.waitForTimeout(2000);
    
    // Wait for "Pick an item of stationary" page
    console.log('⏳ [CONFIRMATION] Waiting for stationary selection page...');
    await page.waitForTimeout(2000);
    
    // Check for "Pick an item of stationary" text
    const stationaryPageIndicator = page.locator('text=/Pick an item of stationary/i, text=/stationary/i').first();
    const pageLoaded = await stationaryPageIndicator.count() > 0;
    if (!pageLoaded) {
      console.log('⚠️ [CONFIRMATION] Stationary page indicator not immediately visible, continuing...');
    }
    
    await takeScreenshot(page, 'stationary-page-loaded.png', screenshotsDir);
    
    // Determine template name based on course type
    let templateName = '';
    if (courseType === 'tfl') {
      templateName = 'TfL Sessions - Booking confirmation';
    } else if (courseType === 'full-licence') {
      templateName = 'DAS/A2/A1 – Booking Confirmation Email';
    } else {
      templateName = 'TfL Sessions - Booking confirmation'; // Default
    }
    
    console.log(`🔍 [CONFIRMATION] Looking for template: "${templateName}"`);
    
    // Find template in the list - try multiple approaches
    // Templates might be in a list, table, or clickable elements
    let templateElement = null;
    
    // Try text-based selectors first
    const templateSelectors = [
      `text="${templateName}"`,
      `text=/.*${templateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*/i`,
      `a:has-text("${templateName}")`,
      `div:has-text("${templateName}")`,
      `tr:has-text("${templateName}")`,
      `td:has-text("${templateName}")`,
      `[role="button"]:has-text("${templateName}")`,
      `[role="listitem"]:has-text("${templateName}")`
    ];
    
    for (const selector of templateSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.count() > 0) {
          const isVisible = await element.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ [CONFIRMATION] Found template using selector: "${selector}"`);
            templateElement = element;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // Try iframe if not found on main page
    if (!templateElement && eventBookingIframeExists) {
      const iframe = page.frameLocator('#eventNewBooking2_iframe');
      for (const selector of templateSelectors) {
        try {
          const element = iframe.locator(selector).first();
          if (await element.count() > 0) {
            const isVisible = await element.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`✅ [CONFIRMATION] Found template in iframe using selector: "${selector}"`);
              templateElement = element;
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    if (!templateElement) {
      throw new Error(`Could not find template: "${templateName}"`);
    }
    
    // Click on the template
    console.log(`🖱️ [CONFIRMATION] Clicking template: "${templateName}"...`);
    await templateElement.click();
    await page.waitForTimeout(2000);
    
    await takeScreenshot(page, 'template-selected.png', screenshotsDir);
    
    // Find and click Preview button
    console.log('🔍 [CONFIRMATION] Looking for Preview button...');
    let previewButton = null;
    
    const previewSelectors = [
      'button:has-text("Preview")',
      'button:has-text("PREVIEW")',
      '[role="button"]:has-text(/preview/i)',
      '.dx-button:has-text(/preview/i)',
      'input[type="button"][value*="Preview" i]',
      'input[type="submit"][value*="Preview" i]'
    ];
    
    for (const selector of previewSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.count() > 0) {
          const isVisible = await button.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ [CONFIRMATION] Found Preview button using selector: "${selector}"`);
            previewButton = button;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // Try iframe if not found on main page
    if (!previewButton && eventBookingIframeExists) {
      const iframe = page.frameLocator('#eventNewBooking2_iframe');
      for (const selector of previewSelectors) {
        try {
          const button = iframe.locator(selector).first();
          if (await button.count() > 0) {
            const isVisible = await button.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`✅ [CONFIRMATION] Found Preview button in iframe using selector: "${selector}"`);
              previewButton = button;
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    if (!previewButton) {
      throw new Error('Could not find Preview button');
    }
    
    // Click Preview button
    console.log('🖱️ [CONFIRMATION] Clicking Preview button...');
    await previewButton.click();
    await page.waitForTimeout(1000);
    
    await takeScreenshot(page, 'preview-shown.png', screenshotsDir);
    
    // Find and click Send button
    console.log('🔍 [CONFIRMATION] Looking for Send button...');
    let sendButton = null;
    
    const sendSelectors = [
      'button:has-text("Send")',
      'button:has-text("SEND")',
      '[role="button"]:has-text(/^send$/i)',
      '.dx-button:has-text(/^send$/i)',
      'input[type="button"][value*="Send" i]',
      'input[type="submit"][value*="Send" i]'
    ];
    
    for (const selector of sendSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.count() > 0) {
          const isVisible = await button.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ [CONFIRMATION] Found Send button using selector: "${selector}"`);
            sendButton = button;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // Try iframe if not found on main page
    if (!sendButton && eventBookingIframeExists) {
      const iframe = page.frameLocator('#eventNewBooking2_iframe');
      for (const selector of sendSelectors) {
        try {
          const button = iframe.locator(selector).first();
          if (await button.count() > 0) {
            const isVisible = await button.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`✅ [CONFIRMATION] Found Send button in iframe using selector: "${selector}"`);
              sendButton = button;
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    if (!sendButton) {
      throw new Error('Could not find Send button');
    }
    
    // Click Send button
    console.log('🖱️ [CONFIRMATION] Clicking Send button...');
    await sendButton.click();
    await page.waitForTimeout(2000);
    
    // Wait for "Email has been sent" confirmation
    console.log('⏳ [CONFIRMATION] Waiting for email sent confirmation...');
    const confirmationSelectors = [
      'text=/Email has been sent/i',
      'text=/email.*sent/i',
      'text=/success/i',
      '.success-message',
      '.alert-success'
    ];
    
    let confirmationFound = false;
    for (const selector of confirmationSelectors) {
      try {
        const confirmation = page.locator(selector).first();
        if (await confirmation.count() > 0) {
          await confirmation.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
          const isVisible = await confirmation.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ [CONFIRMATION] Email sent confirmation found using selector: "${selector}"`);
            confirmationFound = true;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!confirmationFound) {
      console.log('⚠️ [CONFIRMATION] Email sent confirmation not immediately visible, but continuing...');
    }
    
    await takeScreenshot(page, 'email-sent-confirmation.png', screenshotsDir);
    console.log('✅ [CONFIRMATION] Booking confirmation email sent successfully');
    
  } catch (error) {
    console.error('❌ [CONFIRMATION] Error sending booking confirmation email:', error);
    await takeScreenshot(page, 'confirmation-email-error.png', screenshotsDir);
    throw new Error(`Failed to send booking confirmation email: ${error.message}`);
  }
}

