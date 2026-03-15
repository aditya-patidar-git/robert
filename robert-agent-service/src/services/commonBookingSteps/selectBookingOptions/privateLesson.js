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
 * Select booking options for Private Lesson course
 * Extracted from privateLessonBookingService.js for reusability
 */
export default async function selectBookingOptions(page, bookingArgs = {}, screenshotsDir) {
  try {
    console.log('⚙️ [STEP 8] Selecting Private Lesson booking options...');
    
    // Step 1: Validate provided preferences (if any)
    const validBikeTypes = ['125cc automatic', '50cc automatic', '125cc manual', '500cc restricted', '600cc'];
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
      return {
        requiresPreferences: true,
        invalidPreferences: invalidPreferences.map(p => p.preference),
        message: `I'm sorry, but "${invalidPref.providedValue}" is not a valid bike type for the Private Lesson course. Please choose one of: "${validBikeTypes.join('", "')}".`,
        validOptions: {
          bikeType: validBikeTypes
        }
      };
    }
    
    // Step 2: Check for missing required preferences
    const missingPreferences = [];
    if (!bookingArgs.bikeType) {
      missingPreferences.push('bikeType');
    }
    
    if (missingPreferences.length > 0) {
      return {
        requiresPreferences: true,
        missingPreferences: missingPreferences,
        message: 'I need to know your bike type preference for the Private Lesson course. Which bike type would you prefer?',
        validOptions: {
          bikeType: validBikeTypes
        }
      };
    }
    
    // Prepare booking form context
    const { targetPage, searchContext, bookingIframe } = await prepareBookingFormContext(page, screenshotsDir);
    
    // Find all booking option groups
    const { allGroups, groupCount } = await findBookingOptionGroups(searchContext);
    
    const bikeType = bookingArgs.bikeType;
    let bikeTypeSelected = false;
    
    // Process each group to find and select bike type
    for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
      const group = allGroups.nth(groupIndex);
      const normalizedHeading = await getGroupHeading(group);
      
      console.log(`📋 [STEP 8] Processing group ${groupIndex + 1}/${groupCount}: "${normalizedHeading || '(no heading)'}"`);
      
      // Skip CBT course type and Full Licence groups (not relevant for Private Lesson)
      if (normalizedHeading.includes('cbt course type') || normalizedHeading.includes('full licence')) {
        console.log(`⏭️ [STEP 8] Skipping "${normalizedHeading}" group (not relevant for Private Lesson)`);
        continue;
      }
      
      const groupOptions = group.locator('.jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable');
      const optionCount = await groupOptions.count();
      
      if (optionCount === 0) {
        console.log(`⚠️ [STEP 8] No options found in group "${normalizedHeading}", skipping...`);
        continue;
      }
      
      // This should be the bike type group
      console.log('🚲 [STEP 8] This appears to be the bike type group, selecting bike type...');
      
      const bikeTypeMap = {
        '125cc automatic': /125\s*cc\s+automatic.*scooter/i,
        '50cc automatic': /50\s*cc\s+automatic/i,
        '125cc manual': /125\s*cc\s+manual.*geared/i,
        '500cc restricted': /500\s*cc\s+restricted/i,
        '600cc': /600\s*cc/i
      };
      
      const bikePattern = bikeTypeMap[bikeType] || bikeTypeMap['125cc automatic'];
      console.log(`✅ [STEP 8] Selecting bike type: ${bikeType}`);
      
      bikeTypeSelected = await selectOptionByPattern(groupOptions, bikePattern, page);
      
      if (bikeTypeSelected) {
        break; // Found and selected, no need to check other groups
      }
    }
    
    // Verify bike type was selected
    if (!bikeTypeSelected) {
      console.log(`⚠️ [STEP 8] WARNING: Bike type was not selected, trying fallback...`);
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
    
    console.log('✅ [STEP 8] Private Lesson booking options selected and Next button clicked');
    
    return {
      success: true,
      message: 'Booking options selected successfully'
    };
    
  } catch (error) {
    console.error('Error in selectBookingOptions:', error);
    await commonSteps.takeScreenshot(page, 'booking-options-error.png', screenshotsDir);
    throw new Error(`Failed to select Private Lesson booking options: ${error.message}`);
  }
}
