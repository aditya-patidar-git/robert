import * as commonSteps from '../index.js';
import {
  prepareBookingFormContext,
  findBookingOptionGroups,
  getGroupHeading,
  selectOptionByPattern,
  clickNextButton,
  selectFirstAvailableOption
} from './bookingOptionsUtils.js';

/**
 * Select booking options for Full Licence Assessment course
 * Extracted from fullLicenceAssessmentBookingService.js for reusability
 */
export default async function selectBookingOptions(page, bookingArgs = {}, screenshotsDir) {
  try {
    console.log('⚙️ [STEP 7/5] Selecting Full Licence Assessment booking options...');
    
    // Validate provided licence category and transmission
    const validLicenceCategories = ['A1', 'A2', 'A', 'DAS'];
    const validTransmissions = ['automatic', 'manual'];
    const invalidPreferences = [];
    
    if (bookingArgs.licenceCategory) {
      const normalizedCategory = bookingArgs.licenceCategory.trim().toUpperCase();
      const isValid = validLicenceCategories.some(valid => valid.toUpperCase() === normalizedCategory);
      if (!isValid) {
        invalidPreferences.push({
          preference: 'licenceCategory',
          providedValue: bookingArgs.licenceCategory,
          validOptions: validLicenceCategories
        });
      }
    }
    
    if (bookingArgs.transmission || bookingArgs.bikeType) {
      const transmission = (bookingArgs.transmission || bookingArgs.bikeType).trim().toLowerCase();
      const isValid = validTransmissions.some(valid => valid.toLowerCase() === transmission);
      if (!isValid) {
        invalidPreferences.push({
          preference: 'transmission',
          providedValue: bookingArgs.transmission || bookingArgs.bikeType,
          validOptions: validTransmissions
        });
      }
    }
    
    if (invalidPreferences.length > 0) {
      const invalidPref = invalidPreferences[0];
      let message = `I'm sorry, but "${invalidPref.providedValue}" is not a valid ${invalidPref.preference === 'licenceCategory' ? 'licence category' : 'transmission type'} for the Full Licence Assessment. `;
      if (invalidPref.preference === 'licenceCategory') {
        message += `Please choose one of: "${validLicenceCategories.join('", "')}".`;
      } else {
        message += `Please choose one of: "${validTransmissions.join('", "')}".`;
      }
      
      return {
        requiresPreferences: true,
        invalidPreferences: invalidPreferences.map(p => p.preference),
        message: message,
        validOptions: {
          licenceCategory: validLicenceCategories,
          transmission: validTransmissions
        }
      };
    }
    
    // Check for missing required preferences
    const missingPreferences = [];
    if (!bookingArgs.licenceCategory) {
      missingPreferences.push('licenceCategory');
    }
    if (!bookingArgs.transmission && !bookingArgs.bikeType) {
      missingPreferences.push('transmission');
    }
    
    if (missingPreferences.length > 0) {
      let message = 'I need some additional information to proceed with your Full Licence Assessment booking. ';
      
      if (missingPreferences.includes('licenceCategory')) {
        message += 'What licence category are you assessing for: A1, A2, or A/DAS? ';
      }
      if (missingPreferences.includes('transmission')) {
        message += 'Do you prefer automatic or manual transmission?';
      }
      
      return {
        requiresPreferences: true,
        missingPreferences: missingPreferences,
        message: message.trim(),
        validOptions: {
          licenceCategory: validLicenceCategories,
          transmission: validTransmissions
        }
      };
    }
    
    // Prepare booking form context
    const { targetPage, searchContext, bookingIframe } = await prepareBookingFormContext(page, screenshotsDir);
    
    // Find all booking option groups
    const { allGroups, groupCount } = await findBookingOptionGroups(searchContext);
    
    const licenceCategory = bookingArgs.licenceCategory.trim().toUpperCase();
    const transmission = (bookingArgs.transmission || bookingArgs.bikeType || '').trim().toLowerCase();
    
    // Build expected option text pattern
    let expectedOptionPattern = null;
    if (licenceCategory === 'A1') {
      expectedOptionPattern = transmission === 'automatic' ? /A1.*125cc.*automatic/i : /A1.*125cc.*manual/i;
    } else if (licenceCategory === 'A2') {
      expectedOptionPattern = transmission === 'automatic' ? /A2.*automatic/i : /A2.*manual/i;
    } else if (licenceCategory === 'A' || licenceCategory === 'DAS') {
      expectedOptionPattern = transmission === 'automatic' ? /A\/DAS.*automatic/i : /A\/DAS.*manual/i;
    }
    
    console.log(`✅ [STEP 7/5] Selecting option for ${licenceCategory} ${transmission}`);
    
    let optionSelected = false;
    
    // Process each group to find and select the matching option
    for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
      const group = allGroups.nth(groupIndex);
      const normalizedHeading = await getGroupHeading(group);
      
      console.log(`📋 [STEP 7/5] Processing group ${groupIndex + 1}/${groupCount}: "${normalizedHeading || '(no heading)'}"`);
      
      // Skip CBT course type group (not relevant for Full Licence Assessment)
      if (normalizedHeading.includes('cbt course type')) {
        console.log(`⏭️ [STEP 7/5] Skipping "${normalizedHeading}" group (not relevant for Full Licence Assessment)`);
        continue;
      }
      
      const groupOptions = group.locator('.jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable');
      const optionCount = await groupOptions.count();
      
      if (optionCount === 0) {
        console.log(`⚠️ [STEP 7/5] No options found in group "${normalizedHeading}", skipping...`);
        continue;
      }
      
      // This should be the Full Licence courses group
      if (expectedOptionPattern) {
        optionSelected = await selectOptionByPattern(groupOptions, expectedOptionPattern, page);
        
        if (optionSelected) {
          break; // Found and selected, no need to check other groups
        }
      }
    }
    
    // Fallback: try selecting first available option if pattern matching failed
    if (!optionSelected) {
      console.log(`⚠️ [STEP 7/5] WARNING: No matching option found, trying fallback...`);
      optionSelected = await selectFirstAvailableOption(
        allGroups,
        groupCount,
        searchContext,
        ['cbt course type']
      );
    }
    
    await page.waitForTimeout(commonSteps.CRM_STABILITY_DELAY_MS);
    
    // Click NEXT button
    await clickNextButton(searchContext, page, bookingIframe);
    
    console.log('✅ [STEP 7/5] Full Licence Assessment booking options selected and Next button clicked');
    
    return {
      success: true,
      message: 'Booking options selected successfully'
    };
    
  } catch (error) {
    console.error('Error in selectBookingOptions:', error);
    await commonSteps.takeScreenshot(page, 'booking-options-error.png', screenshotsDir);
    throw new Error(`Failed to select Full Licence Assessment booking options: ${error.message}`);
  }
}
