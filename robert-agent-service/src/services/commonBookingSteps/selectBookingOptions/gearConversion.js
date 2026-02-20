import * as commonSteps from '../index.js';
import {
  prepareBookingFormContext,
  findBookingOptionGroups,
  getGroupHeading,
  selectOptionByPattern,
  clickNextButton
} from './bookingOptionsUtils.js';

/**
 * Select booking options for Gear Conversion course
 * Extracted from gearConversionBookingService.js for reusability
 */
export default async function selectBookingOptions(page, bookingArgs = {}, screenshotsDir) {
  try {
    console.log('⚙️ [STEP 8] Selecting Gear Conversion booking options...');

    // Step 1: Validate provided preferences (if any)
    const validDurations = ['2', '3', '4'];
    const validBikeTypes = ['125cc automatic', '50cc automatic', '125cc manual'];
    const invalidPreferences = [];

    if (bookingArgs.duration) {
      const normalizedDuration = String(bookingArgs.duration).trim();
      const isValid = validDurations.includes(normalizedDuration);
      if (!isValid) {
        invalidPreferences.push({
          preference: 'duration',
          providedValue: bookingArgs.duration,
          validOptions: validDurations
        });
      }
    }

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
      let message = `I'm sorry, but "${invalidPref.providedValue}" is not a valid ${invalidPref.preference === 'duration' ? 'duration' : 'bike type'} for the Gear Conversion course. `;
      if (invalidPref.preference === 'duration') {
        message += `Please choose one of: "${validDurations.join('", "')}" hours.`;
      } else {
        message += `Please choose one of: "${validBikeTypes.join('", "')}".`;
      }

      return {
        requiresPreferences: true,
        invalidPreferences: invalidPreferences.map(p => p.preference),
        message: message,
        validOptions: {
          duration: validDurations,
          bikeType: validBikeTypes
        }
      };
    }

    // Step 2: Check for missing required preferences
    const missingPreferences = [];

    // Default duration to '2' if not provided (per user request)
    if (!bookingArgs.duration) {
      bookingArgs.duration = '2';
      console.log('ℹ️ [STEP 8] No duration provided, defaulting to 2 hours');
    }

    if (!bookingArgs.bikeType) {
      missingPreferences.push('bikeType');
    }


    if (missingPreferences.length > 0) {
      let message = 'I need some additional information to proceed with your Gear Conversion booking. ';

      if (missingPreferences.includes('duration')) {
        message += 'How many hours of training would you like: 2 hours, 3 hours, or 4 hours? ';
      }
      if (missingPreferences.includes('bikeType')) {
        message += 'Which bike type would you prefer?';
      }

      return {
        requiresPreferences: true,
        missingPreferences: missingPreferences,
        message: message.trim(),
        validOptions: {
          duration: validDurations,
          bikeType: validBikeTypes
        }
      };
    }

    // Prepare booking form context
    const { targetPage, searchContext, bookingIframe } = await prepareBookingFormContext(page, screenshotsDir);

    // Find all booking option groups
    const { allGroups, groupCount } = await findBookingOptionGroups(searchContext);

    const duration = bookingArgs.duration;
    const bikeType = bookingArgs.bikeType;

    let durationSelected = false;
    let bikeTypeSelected = false;

    // Process each group to select required options
    for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
      const group = allGroups.nth(groupIndex);
      const normalizedHeading = await getGroupHeading(group);

      console.log(`📋 [STEP 8] Processing group ${groupIndex + 1}/${groupCount}: "${normalizedHeading || '(no heading)'}"`);

      const groupOptions = group.locator('.jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable');
      const optionCount = await groupOptions.count();

      if (optionCount === 0) {
        console.log(`⚠️ [STEP 8] No options found in group "${normalizedHeading}", skipping...`);
        continue;
      }

      // Handle duration group (hours selection)
      if (normalizedHeading.includes('hour') || normalizedHeading.includes('duration') || normalizedHeading.includes('time')) {
        console.log(`⏱️ [STEP 8] Found duration group, selecting ${duration} hours...`);

        const durationMap = {
          '2': /2\s*hours?/i,
          '3': /3\s*hours?/i,
          '4': /4\s*hours?/i
        };

        const durationPattern = durationMap[duration] || durationMap['2'];
        durationSelected = await selectOptionByPattern(groupOptions, durationPattern, page);
        continue;
      }

      // Handle bike type group
      if (!normalizedHeading || normalizedHeading === '' || normalizedHeading.includes('bike') || normalizedHeading.includes('motorcycle')) {
        console.log('🚲 [STEP 8] This appears to be the bike type group, selecting bike type...');

        const bikeTypeMap = {
          '125cc automatic': /125\s*cc\s+automatic.*scooter/i,
          '50cc automatic': /50\s*cc\s+automatic/i,
          '125cc manual': /125\s*cc\s+manual.*geared/i
        };

        const bikePattern = bikeTypeMap[bikeType] || bikeTypeMap['125cc automatic'];
        console.log(`✅ [STEP 8] Selecting bike type: ${bikeType}`);

        bikeTypeSelected = await selectOptionByPattern(groupOptions, bikePattern, page);

        if (!bikeTypeSelected) {
          console.log(`⚠️ [STEP 8] No matching bike type found in this group`);
        }
        continue;
      }
    }

    // Verify both options were selected
    if (!durationSelected) {
      console.log(`⚠️ [STEP 8] WARNING: Duration was not selected`);
    }
    if (!bikeTypeSelected) {
      console.log(`⚠️ [STEP 8] WARNING: Bike type was not selected`);
    }

    await page.waitForTimeout(1000);

    // Click NEXT button
    await clickNextButton(searchContext, page, bookingIframe);

    console.log('✅ [STEP 8] Gear Conversion booking options selected and Next button clicked');

    return {
      success: true,
      message: 'Booking options selected successfully'
    };

  } catch (error) {
    console.error('Error in selectBookingOptions:', error);
    await commonSteps.takeScreenshot(page, 'booking-options-error.png', screenshotsDir);
    throw new Error(`Failed to select Gear Conversion booking options: ${error.message}`);
  }
}
