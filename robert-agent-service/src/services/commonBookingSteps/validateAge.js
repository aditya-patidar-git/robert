import { takeScreenshot, CRM_STABILITY_DELAY_MS } from './utils.js';

/**
 * Validate client age against course-specific minimum age requirements
 * @param {Page} page - Playwright page object
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {string} courseType - Course type: 'tfl' (16+), 'full-licence-a1' (17+), 'full-licence-a2' (19+), 'full-licence-a' (24+)
 * @param {number} minAge - Optional minimum age override (if not provided, uses courseType defaults)
 */
export async function validateAge(page, screenshotsDir, courseType = 'tfl', minAge = null) {
  try {
    console.log(`🔍 [AGE VALIDATION] Validating age for course type: ${courseType}...`);
    
    // Determine minimum age based on course type if not provided
    if (minAge === null) {
      switch (courseType) {
        case 'tfl':
        case 'tfl-one-to-one':
        case 'tfl-beyond-cbt':
          minAge = 16;
          break;
        case 'full-licence-a1':
          minAge = 17;
          break;
        case 'full-licence-a2':
          minAge = 19;
          break;
        case 'full-licence-a':
        case 'full-licence-das':
          minAge = 24;
          break;
        default:
          minAge = 16; // Default minimum age
      }
    }
    
    console.log(`📊 [AGE VALIDATION] Minimum age required: ${minAge}`);
    
    await page.waitForTimeout(CRM_STABILITY_DELAY_MS);

    // Determine if we need to work with iframe or main page
    const eventBookingIframeExists = await page.locator('#eventNewBooking2_iframe').count() > 0;
    let searchContext = page;
    
    if (eventBookingIframeExists) {
      console.log('🔍 [AGE VALIDATION] Working with eventNewBooking2_iframe...');
      searchContext = page.frameLocator('#eventNewBooking2_iframe');
    } else {
      console.log('🔍 [AGE VALIDATION] Working with main page...');
    }
    
    // Find age field - try multiple selectors
    let ageElement = null;
    
    const ageSelectors = [
      '#cnt_age input[role="spinbutton"]',
      '#cnt_age .dx-texteditor-input',
      '#cnt_age',
      'input[id*="age"]',
      'input[name*="age"]',
      'label:has-text("Age") + input',
      '[data-field="age"]',
      '.age-field input',
      '.age input'
    ];
    
    for (const selector of ageSelectors) {
      try {
        const element = searchContext.locator(selector).first();
        if (await element.count() > 0) {
          const isVisible = await element.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ [AGE VALIDATION] Found age field using selector: "${selector}"`);
            ageElement = element;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!ageElement) {
      throw new Error('Could not find age field on page');
    }
    
    // Extract age value
    let ageText = '';
    try {
      ageText = await ageElement.inputValue();
    } catch (e) {
      try {
        ageText = await ageElement.textContent();
      } catch (e2) {
        throw new Error('Could not read age value from age field');
      }
    }
    
    const age = parseInt(ageText.trim());
    
    if (isNaN(age)) {
      throw new Error(`Invalid age value: "${ageText}"`);
    }
    
    console.log(`📊 [AGE VALIDATION] Client age: ${age} years`);
    
    // Validate age against minimum
    if (age < minAge) {
      const errorMessage = `Client is under ${minAge} years of age (currently ${age}) - not eligible for ${courseType} course`;
      console.error(`❌ [AGE VALIDATION] ${errorMessage}`);
      await takeScreenshot(page, 'age-validation-failed.png', screenshotsDir);
      throw new Error(errorMessage);
    }
    
    console.log(`✅ [AGE VALIDATION] Age validation passed: ${age} >= ${minAge}`);
    await takeScreenshot(page, 'age-validation-passed.png', screenshotsDir);
    
    return { age, minAge, passed: true };
    
  } catch (error) {
    console.error('❌ [AGE VALIDATION] Error validating age:', error);
    await takeScreenshot(page, 'age-validation-error.png', screenshotsDir);
    throw error; // Re-throw to stop workflow
  }
}

