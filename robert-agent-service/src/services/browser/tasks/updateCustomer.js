import * as commonSteps from '../../commonBookingSteps/index.js';
import { takeScreenshot } from '../../commonBookingSteps/utils.js';

/**
 * Update customer task handler
 * Wraps commonBookingSteps/updateCustomer with audit logging
 */
export async function updateCustomer(page, args, auditId, screenshotsDir) {
  try {
    console.log(`✅ [${auditId}] Updating customer...`);
    
    // Find customer
    if (!args.customerEmail && !args.customerMobile && !args.customerPhone) {
      throw new Error('Customer email or mobile number is required');
    }
    
    const searchType = args.customerMobile || args.customerPhone ? 'mobile' : 'email';
    const searchValue = args.customerMobile || args.customerPhone || args.customerEmail;
    
    const searchResult = await commonSteps.findAndVerifyClient(page, searchType, searchValue, screenshotsDir, args.customerEmail);
    
    if (!searchResult.found) {
      throw new Error('Customer not found');
    }
    
    const iframe = page.frameLocator('#contactLookup_iframe');
    
    // Execute update using commonBookingSteps
    const result = await commonSteps.updateCustomer(page, iframe, args, screenshotsDir);
    
    if (result.success) {
      await takeScreenshot(page, `${auditId}_update_customer_success.png`, screenshotsDir);
      return {
        success: true,
        result: result.result,
        screenshots: [`${auditId}_update_customer_success.png`]
      };
    } else {
      throw new Error(result.error || 'Update failed');
    }
    
  } catch (error) {
    console.error(`❌ [${auditId}] Update customer error:`, error);
    await takeScreenshot(page, `${auditId}_update_customer_error.png`, screenshotsDir);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Dry-run update customer
 */
export async function dryRunUpdateCustomer(page, args, auditId, screenshotsDir) {
  try {
    console.log(`🔍 [${auditId}] Dry run: Update customer`);
    
    // Step 1: Find customer
    if (!args.customerEmail && !args.customerMobile && !args.customerPhone) {
      return {
        success: false,
        error: 'Customer email or mobile number is required to find customer'
      };
    }
    
    // Find customer
    const searchType = args.customerMobile || args.customerPhone ? 'mobile' : 'email';
    const searchValue = args.customerMobile || args.customerPhone || args.customerEmail;
    
    const searchResult = await commonSteps.findAndVerifyClient(page, searchType, searchValue, screenshotsDir, args.customerEmail);
    
    if (!searchResult.found) {
      return {
        success: false,
        error: 'Customer not found. Please verify customer details.'
      };
    }
    
    // Extract current values from client details
    const iframe = page.frameLocator('#contactLookup_iframe');
    const currentValues = {};
    
    if (args.email) {
      const emailField = iframe.locator('input[id*="email"], input[name*="email"], input[type="email"]').first();
      if (await emailField.count() > 0) {
        currentValues.email = await emailField.inputValue().catch(() => '');
      }
    }
    
    if (args.mobile || args.phone) {
      const mobileField = iframe.locator('input[id*="mobile_number"], input[id*="mobile"], input[name*="mobile"]').first();
      if (await mobileField.count() > 0) {
        currentValues.mobile = await mobileField.inputValue().catch(() => '');
      }
    }
    
    if (args.postcode) {
      const postcodeField = iframe.locator('input[id*="post_code"], input[id*="postcode"], input[name*="postcode"]').first();
      if (await postcodeField.count() > 0) {
        currentValues.postcode = await postcodeField.inputValue().catch(() => '');
      }
    }
    
    // Build updates list
    const updates = [];
    if (args.email) updates.push(`Email: ${currentValues.email || 'N/A'} → ${args.email}`);
    if (args.mobile || args.phone) updates.push(`Mobile: ${currentValues.mobile || 'N/A'} → ${args.mobile || args.phone}`);
    if (args.postcode) updates.push(`Postcode: ${currentValues.postcode || 'N/A'} → ${args.postcode}`);
    if (args.firstName) updates.push(`First Name: → ${args.firstName}`);
    if (args.surname) updates.push(`Surname: → ${args.surname}`);
    if (args.address) updates.push(`Address: → ${args.address}`);
    
    await takeScreenshot(page, `${auditId}_update_customer_dryrun.png`, screenshotsDir);
    
    return {
      success: true,
      result: {
        action: 'update_customer',
        currentValues: currentValues,
        newValues: {
          email: args.email,
          mobile: args.mobile || args.phone,
          postcode: args.postcode,
          firstName: args.firstName,
          surname: args.surname,
          address: args.address
        },
        updates: updates
      },
      requiresConfirmation: true
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

