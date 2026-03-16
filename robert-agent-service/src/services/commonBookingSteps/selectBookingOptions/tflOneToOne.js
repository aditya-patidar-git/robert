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
 * Select booking options for TfL 1-2-1 course
 * Extracted from tflOneToOneBookingService.js for reusability
 */
export default async function selectBookingOptions(page, bookingArgs = {}, screenshotsDir) {
  try {
    console.log('⚙️ [STEP 7/5] Selecting TfL 1-2-1 booking options...');
    
    // Validate provided bike type
    const validBikeTypes = ['125cc automatic', '50cc automatic', '125cc manual', 'own bike'];
    const invalidPreferences = [];
    
    if (bookingArgs.bikeType) {
      const normalizedBikeType = bookingArgs.bikeType.trim().toLowerCase();
      const isValid = validBikeTypes.some(valid => valid.toLowerCase() === normalizedBikeType);
      if (!isValid) {
        invalidPreferences.push({
          preference: 'bikeType',
          providedValue: bookingArgs.bikeType,
          validOptions: validBikeTypes
        });
      }
    }
    
    if (invalidPreferences.length > 0) {
      const invalidPref = invalidPreferences[0];
      let message = `I'm sorry, but "${invalidPref.providedValue}" is not a valid bike type for the TfL 1-2-1 course. `;
      message += `Please choose one of: "${validBikeTypes.join('", "')}".`;
      
      return {
        requiresPreferences: true,
        invalidPreferences: invalidPreferences.map(p => p.preference),
        message: message,
        validOptions: {
          bikeType: validBikeTypes
        }
      };
    }
    
    // Check for missing required preferences
    const missingPreferences = [];
    if (!bookingArgs.bikeType) {
      missingPreferences.push('bikeType');
    }
    
    if (missingPreferences.length > 0) {
      let message = 'I need some additional information to proceed with your TfL 1-2-1 booking. ';
      message += 'Which bike type would you prefer: "125cc automatic (scooter)", "50cc automatic", "125cc manual (geared)", or "Own bike"?';
      
      return {
        requiresPreferences: true,
        missingPreferences: missingPreferences,
        message: message.trim(),
        validOptions: {
          bikeType: validBikeTypes
        }
      };
    }
    
    // Prepare booking form context
    const { targetPage, searchContext, bookingIframe } = await prepareBookingFormContext(page, screenshotsDir);
    
    // Find all booking option groups
    const { allGroups, groupCount } = await findBookingOptionGroups(searchContext);
    
    const bikeType = bookingArgs.bikeType.trim().toLowerCase();
    let bikeTypeSelected = false;
    
    // Process each group to find and select bike type
    for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
      const group = allGroups.nth(groupIndex);
      const normalizedHeading = await getGroupHeading(group);
      
      console.log(`📋 [STEP 7/5] Processing group ${groupIndex + 1}/${groupCount}: "${normalizedHeading || '(no heading)'}"`);
      
      // Skip CBT course type and Full Licence groups (not relevant for TfL 1-2-1)
      if (normalizedHeading.includes('cbt course type') || normalizedHeading.includes('full licence')) {
        console.log(`⏭️ [STEP 7/5] Skipping "${normalizedHeading}" group (not relevant for TfL 1-2-1)`);
        continue;
      }
      
      const groupOptions = group.locator('.jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable');
      const optionCount = await groupOptions.count();
      
      if (optionCount === 0) {
        console.log(`⚠️ [STEP 7/5] No options found in group "${normalizedHeading}", skipping...`);
        continue;
      }
      
      // This should be the bike type group
      console.log('🚲 [STEP 7/5] This appears to be the bike type group, selecting bike type...');
      
      const bikeTypeMap = {
        '125cc automatic': /125\s*cc\s+automatic.*scooter/i,
        '50cc automatic': /50\s*cc\s+automatic/i,
        '125cc manual': /125\s*cc\s+manual.*geared/i,
        'own bike': /own\s+bike/i
      };
      
      const bikePattern = bikeTypeMap[bikeType] || bikeTypeMap['125cc automatic'];
      console.log(`✅ [STEP 7/5] Selecting bike type: ${bikeType}`);
      
      bikeTypeSelected = await selectOptionByPattern(groupOptions, bikePattern, page);
      
      if (bikeTypeSelected) {
        break; // Found and selected, no need to check other groups
      }
    }
    
    // Verify bike type was selected
    if (!bikeTypeSelected) {
      console.log(`⚠️ [STEP 7/5] WARNING: Bike type was not selected, trying fallback...`);
      bikeTypeSelected = await selectFirstAvailableOption(
        allGroups,
        groupCount,
        searchContext,
        ['cbt course type', 'full licence']
      );
    }
    
    await page.waitForTimeout(commonSteps.CRM_STABILITY_DELAY_MS);
    
    // Click NEXT button
    await clickNextButton(searchContext, page, bookingIframe);
    
    console.log('✅ [STEP 7/5] TfL 1-2-1 booking options selected and Next button clicked');
    
    return {
      success: true,
      message: 'Booking options selected successfully'
    };
    
  } catch (error) {
    console.error('Error in selectBookingOptions:', error);
    await commonSteps.takeScreenshot(page, 'booking-options-error.png', screenshotsDir);
    throw new Error(`Failed to select TfL 1-2-1 booking options: ${error.message}`);
  }
}
