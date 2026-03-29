import * as commonSteps from '../index.js';
import {
  prepareBookingFormContext,
  findBookingOptionGroups,
  getGroupHeading,
  selectOptionByPattern,
  clickNextButton,
} from './bookingOptionsUtils.js';

/**
 * The CRM booking options page for Full Licence Assessment has TWO separate groups:
 *
 * Group 1 — "Full Licence courses": A1 (125cc) / A2 (500cc) / DAS (600cc plus)
 * Group 2 — "Booking options":     125cc Automatic (Scooter) / 50 cc Automatic /
 *                                  125cc Manual (Geared) / 500cc Restricted Bike / 600 cc / etc.
 *
 * The agent offers 5 verbal choices and passes one as `bikeType`. This map resolves
 * each choice to the correct pattern for BOTH groups.
 */
const BIKE_TYPE_MAP = {
  '125cc automatic': {
    group1: /A1.*125cc/i,
    group2: /125cc.*automatic.*scooter|125cc.*automatic/i,
    label: 'A1 / 125cc Automatic (Scooter)'
  },
  '50cc automatic': {
    group1: /A1.*125cc/i,
    group2: /50\s*cc.*automatic/i,
    label: 'A1 / 50cc Automatic'
  },
  '125cc manual': {
    group1: /A1.*125cc/i,
    group2: /125cc.*manual.*geared|125cc.*manual/i,
    label: 'A1 / 125cc Manual (Geared)'
  },
  '500cc restricted': {
    group1: /A2.*500cc/i,
    group2: /500cc.*restricted/i,
    label: 'A2 / 500cc Restricted Bike'
  },
  '600cc': {
    group1: /DAS.*600cc/i,
    group2: /^\s*600\s*cc\s*$/i,
    label: 'DAS / 600cc'
  }
};

// Normalise LLM phrase variations to a canonical bikeType key
const BIKE_TYPE_ALIASES = {
  '125cc automatic (scooter)': '125cc automatic',
  '125cc scooter':             '125cc automatic',
  'scooter':                   '125cc automatic',
  '50cc':                      '50cc automatic',
  '50 cc automatic':           '50cc automatic',
  '50 cc':                     '50cc automatic',
  '125cc manual (geared)':     '125cc manual',
  '125cc geared':              '125cc manual',
  'geared':                    '125cc manual',
  '500cc':                     '500cc restricted',
  '500 cc':                    '500cc restricted',
  '500cc restricted bike':     '500cc restricted',
  '500cc restricted':          '500cc restricted',
  '600 cc':                    '600cc',
  'das':                       '600cc',
  'a/das':                     '600cc',
  'a/das automatic':           '600cc',
  'a/das manual':              '600cc'
};

function resolveBikeType(raw) {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (BIKE_TYPE_MAP[lower]) return lower;
  return BIKE_TYPE_ALIASES[lower] || null;
}

/**
 * Select booking options for Full Licence Assessment course.
 * Makes two CRM selections per booking: one in the "Full Licence courses" group
 * (licence category) and one in the "Booking options" group (specific bike).
 */
export default async function selectBookingOptions(page, bookingArgs = {}, screenshotsDir) {
  try {
    console.log('⚙️ [STEP 7/5] Selecting Full Licence Assessment booking options...');

    // Resolve bikeType from the parameter (accepts both canonical and alias values)
    const resolvedKey = resolveBikeType(bookingArgs.bikeType);

    if (!resolvedKey) {
      const validKeys = Object.keys(BIKE_TYPE_MAP);
      const message =
        bookingArgs.bikeType
          ? `"${bookingArgs.bikeType}" is not a recognised Full Licence Assessment bike option. `
          : 'I need to know which bike you\'d like for your Full Licence Assessment. ';

      return {
        requiresPreferences: true,
        missingPreferences: ['bikeType'],
        message: message +
          'Please choose one of: "125cc automatic (scooter)", "50cc automatic", ' +
          '"125cc manual (geared)", "500cc restricted bike", or "600cc".',
        validOptions: { bikeType: validKeys }
      };
    }

    const { group1, group2, label } = BIKE_TYPE_MAP[resolvedKey];
    console.log(`✅ [STEP 7/5] Resolved bikeType "${bookingArgs.bikeType}" → ${label}`);

    // Prepare booking form context
    const { targetPage, searchContext, bookingIframe } = await prepareBookingFormContext(page, screenshotsDir);

    // Find all booking option groups
    const { allGroups, groupCount } = await findBookingOptionGroups(searchContext);

    let group1Selected = false;
    let group2Selected = false;

    for (let i = 0; i < groupCount; i++) {
      const group = allGroups.nth(i);
      const heading = await getGroupHeading(group);
      const headingLower = (heading || '').toLowerCase();

      console.log(`📋 [STEP 7/5] Group ${i + 1}/${groupCount}: "${heading || '(no heading)'}"`);

      // Skip CBT-only groups
      if (headingLower.includes('cbt course type')) {
        console.log('⏭️ [STEP 7/5] Skipping CBT course type group');
        continue;
      }

      const groupOptions = group.locator('.jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable');
      const optionCount = await groupOptions.count();
      if (optionCount === 0) continue;

      // Group 1: "Full Licence courses" — select licence category (A1 / A2 / DAS)
      if (!group1Selected && headingLower.includes('full licence')) {
        console.log(`🎯 [STEP 7/5] Selecting licence category in "${heading}" using pattern ${group1}`);
        group1Selected = await selectOptionByPattern(groupOptions, group1, page);
        if (group1Selected) {
          console.log(`✅ [STEP 7/5] Licence category selected in "${heading}"`);
        } else {
          console.warn(`⚠️ [STEP 7/5] Pattern ${group1} did not match in "${heading}"`);
        }
        continue;
      }

      // Group 2: "Booking options" — select specific bike type
      if (!group2Selected && headingLower.includes('booking option')) {
        console.log(`🎯 [STEP 7/5] Selecting bike type in "${heading}" using pattern ${group2}`);
        group2Selected = await selectOptionByPattern(groupOptions, group2, page);
        if (group2Selected) {
          console.log(`✅ [STEP 7/5] Bike type selected in "${heading}"`);
        } else {
          console.warn(`⚠️ [STEP 7/5] Pattern ${group2} did not match in "${heading}"`);
        }
        continue;
      }
    }

    if (!group1Selected) {
      console.warn(`⚠️ [STEP 7/5] Could not select licence category group (group1). Attempting fallback scan...`);
      // Fallback: scan all groups for the group1 pattern
      for (let i = 0; i < groupCount; i++) {
        const group = allGroups.nth(i);
        const heading = (await getGroupHeading(group) || '').toLowerCase();
        if (heading.includes('cbt course type')) continue;
        const groupOptions = group.locator('.jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable');
        if (await groupOptions.count() === 0) continue;
        group1Selected = await selectOptionByPattern(groupOptions, group1, page);
        if (group1Selected) { console.log(`✅ [STEP 7/5] Licence category selected via fallback in group "${heading}"`); break; }
      }
    }

    if (!group2Selected) {
      console.warn(`⚠️ [STEP 7/5] Could not select bike type group (group2). Attempting fallback scan...`);
      for (let i = 0; i < groupCount; i++) {
        const group = allGroups.nth(i);
        const heading = (await getGroupHeading(group) || '').toLowerCase();
        if (heading.includes('cbt course type')) continue;
        const groupOptions = group.locator('.jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable');
        if (await groupOptions.count() === 0) continue;
        group2Selected = await selectOptionByPattern(groupOptions, group2, page);
        if (group2Selected) { console.log(`✅ [STEP 7/5] Bike type selected via fallback in group "${heading}"`); break; }
      }
    }

    if (!group1Selected || !group2Selected) {
      console.warn(`⚠️ [STEP 7/5] Selection incomplete — group1: ${group1Selected}, group2: ${group2Selected}. Proceeding anyway.`);
    }

    await page.waitForTimeout(commonSteps.CRM_STABILITY_DELAY_MS);

    // Click NEXT button
    await clickNextButton(searchContext, page, bookingIframe);

    console.log(`✅ [STEP 7/5] Full Licence Assessment options selected (${label}) and Next clicked`);

    return {
      success: true,
      bikeType: resolvedKey,
      label,
      message: 'Booking options selected successfully'
    };

  } catch (error) {
    console.error('Error in selectBookingOptions (Full Licence Assessment):', error);
    await commonSteps.takeScreenshot(page, 'booking-options-error.png', screenshotsDir);
    throw new Error(`Failed to select Full Licence Assessment booking options: ${error.message}`);
  }
}
