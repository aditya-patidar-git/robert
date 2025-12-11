import { takeScreenshot } from './utils.js';

/**
 * Update customer record fields
 * @param {Page} page - Playwright page object
 * @param {FrameLocator} iframe - Frame locator for the contact details iframe
 * @param {Object} args - Update arguments
 * @param {string} args.email - New email address (optional)
 * @param {string} args.phone - New phone number (optional)
 * @param {string} args.mobile - New mobile number (optional)
 * @param {string} args.address - New address (optional)
 * @param {string} args.postcode - New postcode (optional)
 * @param {string} args.firstName - New first name (optional)
 * @param {string} args.surname - New surname (optional)
 * @param {string} screenshotsDir - Directory to save screenshots
 * @returns {Promise<{success: boolean, result?: object, error?: string}>}
 */
export async function updateCustomer(page, iframe, args, screenshotsDir) {
  try {
    console.log('✏️ [UPDATE CUSTOMER] Starting customer update workflow...');
    console.log(`   Fields to update: ${Object.keys(args).filter(k => args[k]).join(', ')}`);
    
    // We should already be on the customer details page (from findAndVerifyClient)
    // Verify we're on the customer details page
    const firstNameField = iframe.locator('input[id*="cnt_first_names"], input[name*="first_names"], label:has-text("First Names") + input').first();
    const isOnCustomerPage = await firstNameField.count() > 0;
    
    if (!isOnCustomerPage) {
      throw new Error('Not on customer details page. Please find customer first.');
    }
    
    await takeScreenshot(page, 'update-customer-start.png', screenshotsDir);
    
    // Step 1: Extract current values for comparison
    console.log('📋 [UPDATE CUSTOMER] Step 1: Extracting current values...');
    const currentValues = {};
    
    // Extract current first name
    if (args.firstName) {
      const currentFirstName = await firstNameField.inputValue().catch(() => '');
      currentValues.firstName = currentFirstName;
      console.log(`   Current First Name: ${currentFirstName}`);
    }
    
    // Extract current surname
    if (args.surname) {
      const surnameField = iframe.locator('input[id*="cnt_surname"], input[name*="surname"], label:has-text("Surname") + input').first();
      const currentSurname = await surnameField.inputValue().catch(() => '');
      currentValues.surname = currentSurname;
      console.log(`   Current Surname: ${currentSurname}`);
    }
    
    // Extract current email
    if (args.email) {
      const emailField = iframe.locator('input[id*="email"], input[name*="email"], input[type="email"], label:has-text("Contact e-mail") + input').first();
      const currentEmail = await emailField.inputValue().catch(() => '');
      currentValues.email = currentEmail;
      console.log(`   Current Email: ${currentEmail}`);
    }
    
    // Extract current mobile
    if (args.mobile || args.phone) {
      const mobileField = iframe.locator('input[id*="mobile_number"], input[id*="mobile"], input[name*="mobile_number"], input[name*="mobile"], label:has-text("Contact mobile number") + input').first();
      const currentMobile = await mobileField.inputValue().catch(() => '');
      currentValues.mobile = currentMobile;
      console.log(`   Current Mobile: ${currentMobile}`);
    }
    
    // Extract current postcode
    if (args.postcode) {
      const postcodeField = iframe.locator('input[id*="post_code"], input[id*="postcode"], input[name*="post_code"], input[name*="postcode"], label:has-text("Post code") + input').first();
      const currentPostcode = await postcodeField.inputValue().catch(() => '');
      currentValues.postcode = currentPostcode;
      console.log(`   Current Postcode: ${currentPostcode}`);
    }
    
    // Step 2: Update fields
    console.log('✏️ [UPDATE CUSTOMER] Step 2: Updating fields...');
    
    // Update first name
    if (args.firstName) {
      console.log(`   Updating First Name: ${currentValues.firstName} → ${args.firstName}`);
      await firstNameField.click();
      await page.waitForTimeout(200);
      await firstNameField.fill(''); // Clear first
      await page.waitForTimeout(200);
      await firstNameField.fill(args.firstName);
      await page.waitForTimeout(500);
    }
    
    // Update surname
    if (args.surname) {
      console.log(`   Updating Surname: ${currentValues.surname} → ${args.surname}`);
      const surnameField = iframe.locator('input[id*="cnt_surname"], input[name*="surname"], label:has-text("Surname") + input').first();
      await surnameField.click();
      await page.waitForTimeout(200);
      await surnameField.fill('');
      await page.waitForTimeout(200);
      await surnameField.fill(args.surname);
      await page.waitForTimeout(500);
    }
    
    // Update email
    if (args.email) {
      console.log(`   Updating Email: ${currentValues.email} → ${args.email}`);
      const emailField = iframe.locator('input[id*="email"], input[name*="email"], input[type="email"], label:has-text("Contact e-mail") + input').first();
      await emailField.click();
      await page.waitForTimeout(200);
      await emailField.fill('');
      await page.waitForTimeout(200);
      await emailField.fill(args.email);
      await page.waitForTimeout(500);
    }
    
    // Update mobile/phone
    if (args.mobile || args.phone) {
      const newMobile = args.mobile || args.phone;
      console.log(`   Updating Mobile: ${currentValues.mobile} → ${newMobile}`);
      const mobileField = iframe.locator('input[id*="mobile_number"], input[id*="mobile"], input[name*="mobile_number"], input[name*="mobile"], label:has-text("Contact mobile number") + input').first();
      await mobileField.click();
      await page.waitForTimeout(200);
      await mobileField.fill('');
      await page.waitForTimeout(200);
      await mobileField.fill(newMobile);
      await page.waitForTimeout(500);
    }
    
    // Update postcode
    if (args.postcode) {
      console.log(`   Updating Postcode: ${currentValues.postcode} → ${args.postcode}`);
      const postcodeField = iframe.locator('input[id*="post_code"], input[id*="postcode"], input[name*="post_code"], input[name*="postcode"], label:has-text("Post code") + input').first();
      await postcodeField.click();
      await page.waitForTimeout(200);
      await postcodeField.fill('');
      await page.waitForTimeout(200);
      await postcodeField.fill(args.postcode);
      await page.waitForTimeout(500);
    }
    
    // Update address (if provided)
    if (args.address) {
      console.log(`   Updating Address: ${args.address}`);
      const addressField = iframe.locator('input[id*="address"], textarea[id*="address"], input[name*="address"], textarea[name*="address"]').first();
      if (await addressField.count() > 0) {
        await addressField.click();
        await page.waitForTimeout(200);
        await addressField.fill('');
        await page.waitForTimeout(200);
        await addressField.fill(args.address);
        await page.waitForTimeout(500);
      }
    }
    
    await takeScreenshot(page, 'update-customer-fields-filled.png', screenshotsDir);
    
    // Step 3: Save changes
    console.log('💾 [UPDATE CUSTOMER] Step 3: Saving changes...');
    
    // Look for save button
    const saveButton = iframe.locator('button:has-text("Save"), button:has-text("Update"), button[id*="save"], button[id*="update"]').first();
    
    if (await saveButton.count() > 0) {
      await saveButton.click();
      await page.waitForTimeout(3000);
      console.log('✅ [UPDATE CUSTOMER] Save button clicked');
    } else {
      // Try clicking outside to trigger auto-save or look for other save mechanisms
      await iframe.locator('body').click({ position: { x: 100, y: 100 } });
      await page.waitForTimeout(2000);
      console.log('⚠️ [UPDATE CUSTOMER] No explicit save button found, trying auto-save');
    }
    
    await takeScreenshot(page, 'update-customer-saved.png', screenshotsDir);
    
    // Step 4: Verify success
    console.log('🔍 [UPDATE CUSTOMER] Step 4: Verifying update success...');
    
    await page.waitForTimeout(2000);
    
    const updatedValues = {};
    const verificationResults = {};
    
    // Verify first name
    if (args.firstName) {
      const currentFirstName = await firstNameField.inputValue().catch(() => '');
      updatedValues.firstName = currentFirstName;
      verificationResults.firstName = currentFirstName === args.firstName;
      console.log(`   First Name verification: ${verificationResults.firstName ? '✅' : '❌'} (Expected: ${args.firstName}, Got: ${currentFirstName})`);
    }
    
    // Verify surname
    if (args.surname) {
      const surnameField = iframe.locator('input[id*="cnt_surname"], input[name*="surname"], label:has-text("Surname") + input').first();
      const currentSurname = await surnameField.inputValue().catch(() => '');
      updatedValues.surname = currentSurname;
      verificationResults.surname = currentSurname === args.surname;
      console.log(`   Surname verification: ${verificationResults.surname ? '✅' : '❌'} (Expected: ${args.surname}, Got: ${currentSurname})`);
    }
    
    // Verify email
    if (args.email) {
      const emailField = iframe.locator('input[id*="email"], input[name*="email"], input[type="email"], label:has-text("Contact e-mail") + input').first();
      const currentEmail = await emailField.inputValue().catch(() => '');
      updatedValues.email = currentEmail;
      verificationResults.email = currentEmail === args.email;
      console.log(`   Email verification: ${verificationResults.email ? '✅' : '❌'} (Expected: ${args.email}, Got: ${currentEmail})`);
    }
    
    // Verify mobile
    if (args.mobile || args.phone) {
      const newMobile = args.mobile || args.phone;
      const mobileField = iframe.locator('input[id*="mobile_number"], input[id*="mobile"], input[name*="mobile_number"], input[name*="mobile"], label:has-text("Contact mobile number") + input').first();
      const currentMobile = await mobileField.inputValue().catch(() => '');
      updatedValues.mobile = currentMobile;
      verificationResults.mobile = currentMobile === newMobile;
      console.log(`   Mobile verification: ${verificationResults.mobile ? '✅' : '❌'} (Expected: ${newMobile}, Got: ${currentMobile})`);
    }
    
    // Verify postcode
    if (args.postcode) {
      const postcodeField = iframe.locator('input[id*="post_code"], input[id*="postcode"], input[name*="post_code"], input[name*="postcode"], label:has-text("Post code") + input').first();
      const currentPostcode = await postcodeField.inputValue().catch(() => '');
      updatedValues.postcode = currentPostcode;
      verificationResults.postcode = currentPostcode === args.postcode;
      console.log(`   Postcode verification: ${verificationResults.postcode ? '✅' : '❌'} (Expected: ${args.postcode}, Got: ${currentPostcode})`);
    }
    
    // Check if all updates were successful
    const allSuccessful = Object.values(verificationResults).every(result => result === true);
    
    if (allSuccessful || Object.keys(verificationResults).length === 0) {
      console.log('✅ [UPDATE CUSTOMER] Customer update verified successfully');
      return {
        success: true,
        result: {
          updatedFields: Object.keys(args).filter(k => args[k]),
          oldValues: currentValues,
          newValues: updatedValues
        }
      };
    } else {
      const failedFields = Object.keys(verificationResults).filter(k => !verificationResults[k]);
      throw new Error(`Update verification failed for fields: ${failedFields.join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ [UPDATE CUSTOMER] Error updating customer:', error);
    await takeScreenshot(page, 'update-customer-error.png', screenshotsDir);
    return {
      success: false,
      error: error.message
    };
  }
}

