import { takeScreenshot } from './utils.js';

/**
 * Step 12: Fill card details (card number, expiry date, security code, card holder name)
 * @param {Page} page - Playwright page object
 * @param {string} screenshotsDir - Directory to save screenshots
 */
export async function fillCardDetails(page, screenshotsDir) {
  try {
    console.log('💳 [STEP 12] Filling card details...');
    
    // Wait for card fields to appear
    console.log('⏳ [STEP 12] Waiting for card fields to appear...');
    await page.waitForTimeout(1000);
    
    // Determine if we need to work with iframe or main page (same pattern as payment method dropdown)
    const eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
    let searchContext;
    
    if (eventBookingIframeExists) {
      console.log('🔍 [STEP 12] Working with eventNewBooking2_iframe for card details...');
      searchContext = page.frameLocator('#eventNewBooking2_iframe');
    } else {
      console.log('🔍 [STEP 12] Working with main page for card details...');
      searchContext = page;
    }
    
    // Define card fields with their selectors and env variable names
    const cardFields = [
      {
        name: 'Card Number',
        selector: '#fin_card_no',
        envVar: 'CARD_NUMBER',
        clearFirst: false
      },
      {
        name: 'Expiry Date',
        selector: '#fin_card_expiry_date',
        envVar: 'CARD_EXPIRY_DATE',
        clearFirst: false
      },
      {
        name: 'Security Code (CV2)',
        selector: '#fin_card_security_code',
        envVar: 'CARD_SECURITY_CODE',
        clearFirst: false
      },
      {
        name: 'Card Holder Name',
        selector: '#fin_card_holders_name',
        envVar: 'CARD_HOLDERS_NAME',
        clearFirst: true // Overwrite existing value
      }
    ];
    
    let filledCount = 0;
    let skippedCount = 0;
    
    // Fill each field
    for (const field of cardFields) {
      try {
        // Check if environment variable exists
        const fieldValue = process.env[field.envVar];
        if (!fieldValue) {
          console.log(`⚠️ [STEP 12] Environment variable ${field.envVar} not found, skipping ${field.name}`);
          skippedCount++;
          continue;
        }
        
        console.log(`💳 [STEP 12] Filling ${field.name}...`);
        
        // Find the field container
        const fieldContainer = searchContext.locator(field.selector).first();
        
        // Wait for field to be visible
        await fieldContainer.waitFor({ state: 'visible', timeout: 10000 });
        
        // Find the input element inside the container
        const inputField = fieldContainer.locator('.dx-texteditor-input').first();
        
        // Clear existing value if needed (especially for card holder name)
        if (field.clearFirst) {
          await inputField.click();
          await page.waitForTimeout(200);
          await inputField.fill(''); // Clear existing value
          await page.waitForTimeout(200);
        }
        
        // Fill the field with value from environment variable
        await inputField.fill(fieldValue);
        await page.waitForTimeout(500); // Wait for validation/formatting
        
        // Verify the value was filled
        const filledValue = await inputField.inputValue();
        if (filledValue === fieldValue || filledValue.includes(fieldValue)) {
          console.log(`✅ [STEP 12] ${field.name} filled successfully`);
          filledCount++;
        } else {
          console.log(`⚠️ [STEP 12] ${field.name} fill verification failed. Expected: "${fieldValue}", Got: "${filledValue}"`);
        }
        
      } catch (error) {
        console.log(`⚠️ [STEP 12] Error filling ${field.name}: ${error.message}`);
        skippedCount++;
        // Continue with next field
      }
    }
    
    // Take screenshot after filling all card details
    await takeScreenshot(page, 'card-details-filled.png', screenshotsDir);
    
    if (filledCount > 0) {
      console.log(`✅ [STEP 12] Card details filled: ${filledCount} field(s) filled, ${skippedCount} field(s) skipped`);
    } else {
      console.log(`⚠️ [STEP 12] No card details were filled. All fields were skipped.`);
    }
    
  } catch (error) {
    console.error('Error in fillCardDetails:', error);
    await takeScreenshot(page, 'card-details-error.png', screenshotsDir);
    // Don't throw error - allow workflow to continue even if card details filling fails
    console.log('⚠️ [STEP 12] Card details filling failed, but continuing workflow...');
  }
}

