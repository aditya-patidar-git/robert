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
 * Select booking options for CBT Executive course
 * Extracted from cbtExecutiveBookingService.js for reusability
 */
export default async function selectBookingOptions(page, bookingArgs = {}, screenshotsDir) {
  try {
    console.log('⚙️ [STEP 8] Selecting CBT Executive booking options...');
    
    // Step 1: Validate provided preferences (if any)
    const validCbtTypes = ['standard', 'renewal'];
    const validBikeTypes = ['125cc automatic', '50cc automatic', '125cc manual', '500cc restricted', '600cc'];
    const invalidPreferences = [];
    
    if (bookingArgs.cbtType) {
      const normalizedCbtType = bookingArgs.cbtType.trim().toLowerCase();
      const isValid = validCbtTypes.some(valid => valid.toLowerCase() === normalizedCbtType);
      if (!isValid) {
        invalidPreferences.push({
          preference: 'cbtType',
          providedValue: bookingArgs.cbtType,
          validOptions: validCbtTypes
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
      let message = `I'm sorry, but "${invalidPref.providedValue}" is not a valid ${invalidPref.preference === 'cbtType' ? 'CBT type' : 'bike type'} for the CBT Executive course. `;
      if (invalidPref.preference === 'cbtType') {
        message += `Please choose one of: "${validCbtTypes.join('", "')}".`;
      } else {
        message += `Please choose one of: "${validBikeTypes.join('", "')}".`;
      }
      
      return {
        requiresPreferences: true,
        invalidPreferences: invalidPreferences.map(p => p.preference),
        message: message,
        validOptions: {
          cbtType: validCbtTypes,
          bikeType: validBikeTypes
        }
      };
    }
    
    // Step 2: Check for missing required preferences
    const missingPreferences = [];
    if (!bookingArgs.cbtType) {
      missingPreferences.push('cbtType');
    }
    if (!bookingArgs.bikeType) {
      missingPreferences.push('bikeType');
    }
    
    if (missingPreferences.length > 0) {
      let message = 'I need some additional information to proceed with your CBT Executive booking. ';
      
      if (missingPreferences.includes('cbtType')) {
        message += 'Is this a CBT Standard or CBT Renewal? ';
      }
      if (missingPreferences.includes('bikeType')) {
        message += 'Which bike type would you prefer for CBT Executive?';
      }
      
      return {
        requiresPreferences: true,
        missingPreferences: missingPreferences,
        message: message.trim(),
        validOptions: {
          cbtType: validCbtTypes,
          bikeType: validBikeTypes
        }
      };
    }
    
    // Prepare booking form context
    const { targetPage, searchContext, bookingIframe } = await prepareBookingFormContext(page, screenshotsDir);
    
    // Find all booking option groups
    const { allGroups, groupCount } = await findBookingOptionGroups(searchContext);
    
    const cbtType = bookingArgs.cbtType;
    const bikeType = bookingArgs.bikeType;
    
    let cbtTypeSelected = false;
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
      
      // Handle "CBT course type" group
      if (normalizedHeading.includes('cbt course type')) {
        console.log(`✅ [STEP 8] Found "CBT course type" group, selecting ${cbtType}...`);
        
        const cbtTypePattern = cbtType.toLowerCase() === 'renewal' 
          ? /cbt\s+renewal/i 
          : /cbt\s+standard/i;
        
        cbtTypeSelected = await selectOptionByPattern(groupOptions, cbtTypePattern, page);
        
        if (!cbtTypeSelected) {
          console.log(`⚠️ [STEP 8] Could not find ${cbtType} option, trying radio button fallback...`);
          if (cbtType.toLowerCase() === 'renewal') {
            const renewalRadio = searchContext.locator('[role="radio"]:has-text("CBT Renewal"), input[type="radio"][value*="Renewal"]').first();
            if (await renewalRadio.count() > 0) {
              await renewalRadio.check();
              cbtTypeSelected = true;
            }
          } else {
            const standardRadio = searchContext.locator('[role="radio"]:has-text("CBT Standard"), input[type="radio"][value*="Standard"]').first();
            if (await standardRadio.count() > 0) {
              await standardRadio.check();
              cbtTypeSelected = true;
            }
          }
        }
        continue;
      }
      
      // Skip "Full Licence courses" group
      if (normalizedHeading.includes('full licence')) {
        console.log(`⏭️ [STEP 8] Skipping "Full Licence courses" group (not relevant for CBT Executive)`);
        continue;
      }
      
      // Handle bike type group
      if (!normalizedHeading || normalizedHeading === '' || normalizedHeading.includes('bike') || normalizedHeading.includes('motorcycle')) {
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
        
        if (!bikeTypeSelected) {
          console.log(`⚠️ [STEP 8] No matching bike type found in this group`);
        }
        continue;
      }
    }
    
    // Verify both options were selected
    if (!cbtTypeSelected) {
      console.log(`⚠️ [STEP 8] WARNING: CBT type was not selected`);
    }
    if (!bikeTypeSelected) {
      console.log(`⚠️ [STEP 8] WARNING: Bike type was not selected`);
      bikeTypeSelected = await selectFirstAvailableOption(
        allGroups,
        groupCount,
        searchContext,
        ['cbt course type', 'full licence']
      );
    }
    
    await page.waitForTimeout(1000);
    
    // Click NEXT button
    await clickNextButton(searchContext, page, bookingIframe);
    
    console.log('✅ [STEP 8] CBT Executive booking options selected and Next button clicked');
    
    return {
      success: true,
      message: 'Booking options selected successfully'
    };
    
  } catch (error) {
    console.error('Error in selectBookingOptions:', error);
    await commonSteps.takeScreenshot(page, 'booking-options-error.png', screenshotsDir);
    throw new Error(`Failed to select CBT Executive booking options: ${error.message}`);
  }
}
