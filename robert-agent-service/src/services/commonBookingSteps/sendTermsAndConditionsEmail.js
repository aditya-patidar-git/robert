import { takeScreenshot } from './utils.js';

/**
 * Send Terms & Conditions email after booking confirmation email
 * @param {Page} page - Playwright page object
 * @param {string} screenshotsDir - Directory to save screenshots
 */
export async function sendTermsAndConditionsEmail(page, screenshotsDir) {
  try {
    console.log('📧 [T&C] Sending Terms & Conditions email...');
    
    // Wait for page to be ready
    await page.waitForTimeout(2000);
    
    // Determine if we need to work with iframe or main page
    const eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
    
    // Find and click "Back" button
    console.log('🔍 [T&C] Looking for Back button...');
    let backButton = null;
    
    const backSelectors = [
      'button:has-text("Back")',
      'button:has-text("BACK")',
      '[role="button"]:has-text(/^back$/i)',
      '.dx-button:has-text(/^back$/i)',
      'a:has-text("Back")',
      'input[type="button"][value*="Back" i]',
      'input[type="submit"][value*="Back" i]'
    ];
    
    // Try main page first
    for (const selector of backSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.count() > 0) {
          const isVisible = await button.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ [T&C] Found Back button using selector: "${selector}"`);
            backButton = button;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // Try iframe if not found on main page
    if (!backButton && eventBookingIframeExists) {
      const iframe = page.frameLocator('#eventNewBooking2_iframe');
      for (const selector of backSelectors) {
        try {
          const button = iframe.locator(selector).first();
          if (await button.count() > 0) {
            const isVisible = await button.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`✅ [T&C] Found Back button in iframe using selector: "${selector}"`);
              backButton = button;
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    if (!backButton) {
      throw new Error('Could not find Back button');
    }
    
    // Click Back button
    console.log('🖱️ [T&C] Clicking Back button...');
    await backButton.click();
    await page.waitForTimeout(2000);
    
    await takeScreenshot(page, 'back-clicked.png', screenshotsDir);
    
    // Find and click "Send a confirmation" button
    console.log('🔍 [T&C] Looking for "Send a confirmation" button...');
    let sendConfirmationButton = null;
    
    const sendConfirmationSelectors = [
      'button:has-text("SEND A CONFIRMATION")',
      'button:has-text("Send a confirmation")',
      'button:has-text("Send A Confirmation")',
      '[role="button"]:has-text(/send.*confirmation/i)',
      '.dx-button:has-text(/send.*confirmation/i)',
      'a:has-text("SEND A CONFIRMATION")',
      'a:has-text("Send a confirmation")'
    ];
    
    // Try main page first
    for (const selector of sendConfirmationSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.count() > 0) {
          const isVisible = await button.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ [T&C] Found Send a confirmation button using selector: "${selector}"`);
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
      for (const selector of sendConfirmationSelectors) {
        try {
          const button = iframe.locator(selector).first();
          if (await button.count() > 0) {
            const isVisible = await button.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`✅ [T&C] Found Send a confirmation button in iframe using selector: "${selector}"`);
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
      throw new Error('Could not find "Send a confirmation" button');
    }
    
    // Click the button
    console.log('🖱️ [T&C] Clicking "Send a confirmation" button...');
    await sendConfirmationButton.click();
    await page.waitForTimeout(2000);
    
    // Wait for "Pick an item of stationary" page
    console.log('⏳ [T&C] Waiting for stationary selection page...');
    await page.waitForTimeout(2000);
    
    await takeScreenshot(page, 'stationary-page-loaded-tc.png', screenshotsDir);
    
    // Find "Terms & Conditions" template
    const templateName = 'Terms & Conditions';
    console.log(`🔍 [T&C] Looking for template: "${templateName}"`);
    
    let templateElement = null;
    
    // Try text-based selectors
    const templateSelectors = [
      `text="${templateName}"`,
      `text=/.*Terms.*Conditions.*/i`,
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
            console.log(`✅ [T&C] Found template using selector: "${selector}"`);
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
              console.log(`✅ [T&C] Found template in iframe using selector: "${selector}"`);
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
    console.log(`🖱️ [T&C] Clicking template: "${templateName}"...`);
    await templateElement.click();
    await page.waitForTimeout(2000);
    
    await takeScreenshot(page, 'template-selected-tc.png', screenshotsDir);
    
    // Find and click Preview button
    console.log('🔍 [T&C] Looking for Preview button...');
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
            console.log(`✅ [T&C] Found Preview button using selector: "${selector}"`);
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
              console.log(`✅ [T&C] Found Preview button in iframe using selector: "${selector}"`);
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
    console.log('🖱️ [T&C] Clicking Preview button...');
    await previewButton.click();
    await page.waitForTimeout(1000);
    
    await takeScreenshot(page, 'preview-shown-tc.png', screenshotsDir);
    
    // Find and click Send button
    console.log('🔍 [T&C] Looking for Send button...');
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
            console.log(`✅ [T&C] Found Send button using selector: "${selector}"`);
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
              console.log(`✅ [T&C] Found Send button in iframe using selector: "${selector}"`);
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
    console.log('🖱️ [T&C] Clicking Send button...');
    await sendButton.click();
    await page.waitForTimeout(2000);
    
    // Wait for "Email has been sent" confirmation
    console.log('⏳ [T&C] Waiting for email sent confirmation...');
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
            console.log(`✅ [T&C] Email sent confirmation found using selector: "${selector}"`);
            confirmationFound = true;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!confirmationFound) {
      console.log('⚠️ [T&C] Email sent confirmation not immediately visible, but continuing...');
    }
    
    await takeScreenshot(page, 'email-sent-confirmation-tc.png', screenshotsDir);
    console.log('✅ [T&C] Terms & Conditions email sent successfully');
    
  } catch (error) {
    console.error('❌ [T&C] Error sending Terms & Conditions email:', error);
    await takeScreenshot(page, 'terms-email-error.png', screenshotsDir);
    throw new Error(`Failed to send Terms & Conditions email: ${error.message}`);
  }
}

