import * as commonSteps from '../index.js';

/**
 * Shared utilities for booking option selection
 * Provides reusable functions to avoid code duplication
 */

/**
 * Find and prepare the booking form context (handles popups, iframes)
 * @param {Page} page - Playwright page object
 * @param {string} screenshotsDir - Screenshots directory
 * @returns {Promise<{targetPage: Page, searchContext: Locator, bookingIframe: FrameLocator|null}>}
 */
export async function prepareBookingFormContext(page, screenshotsDir) {
  let targetPage = page; // Initialize to current page as default

  // Wait for price page to load
  console.log('⏳ Waiting for price page to load...');
  await page.waitForTimeout(5000);

  // PERFORMANCE FIX E: Optimized page scanning
  // 1. Check if CURRENT page already has the booking indicators to avoid scanning others
  const currentUrl = page.url();
  const currentTitle = await page.title().catch(() => '');
  const isLikelyBooking = currentUrl.includes('booking') || currentUrl.includes('Booking') ||
    currentTitle.includes('booking') || currentTitle.includes('Booking');

  if (isLikelyBooking) {
    console.log(`✅ Current page is likely the booking form (${currentUrl})`);
  } else {
    // 2. Only scan other pages if current page doesn't look like a booking page
    const pages = page.context().pages();
    if (pages.length > 1) {
      console.log(`🔍 Checking ${pages.length} pages for booking popup (reverse order)...`);
      // Scan in reverse order as the newest popup is usually at the end
      for (let i = pages.length - 1; i >= 0; i--) {
        const p = pages[i];
        if (p === page) continue; // Already checked

        const pageTitle = await p.title().catch(() => '');
        const pageUrl = p.url();
        if (pageTitle.includes('booking') || pageTitle.includes('Booking') ||
          pageUrl.includes('booking') || pageUrl.includes('Booking')) {
          targetPage = p;
          console.log(`✅ Using discovered popup window for booking form: ${pageUrl}`);
          break;
        }
      }
    }
  }

  // Determine if booking form is in an iframe, popup, or on main page
  let searchContext = targetPage;
  let bookingIframe = null;

  // Check within eventNewBooking2_iframe (the actual booking form iframe)
  const eventBookingIframeExists = await targetPage.locator('#eventNewBooking2_iframe').count() > 0;
  if (eventBookingIframeExists) {
    bookingIframe = targetPage.frameLocator('#eventNewBooking2_iframe');
    searchContext = bookingIframe;

    // Wait for iframe to load
    await targetPage.waitForTimeout(2000);
  }

  // Wait for "1. Price" header
  console.log('🔍 Looking for "1. Price" header...');
  const priceHeader = searchContext.locator('text=1. Price, *:has-text("1. Price")').first();
  await priceHeader.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
    console.log('⚠️ Price header visibility check timed out, continuing...');
  });

  await commonSteps.takeScreenshot(targetPage, 'price-page-loaded.png', screenshotsDir);

  return { targetPage, searchContext, bookingIframe };
}

/**
 * Find all booking option groups on the page
 * @param {Locator} searchContext - Context to search in (page or iframe)
 * @returns {Promise<{allGroups: Locator, groupCount: number}>}
 */
export async function findBookingOptionGroups(searchContext) {
  console.log('📋 Finding all booking option groups...');
  const allGroups = searchContext.locator('.jqxInputBookingOptionsSelectGroupOuter');
  const groupCount = await allGroups.count();
  console.log(`📊 Found ${groupCount} booking option group(s)`);

  if (groupCount === 0) {
    throw new Error('No booking option groups found on price page');
  }

  return { allGroups, groupCount };
}

/**
 * Get group heading text
 * @param {Locator} group - Group locator
 * @returns {Promise<string>} Normalized heading text
 */
export async function getGroupHeading(group) {
  const groupHeading = group.locator('h1.jqx_formBoilerPlateText.jqx_formHeading span').first();
  const headingText = await groupHeading.textContent().catch(() => '');
  return headingText ? headingText.trim().toLowerCase() : '';
}

/**
 * Select an option in a group by matching pattern
 * @param {Locator} groupOptions - Options locator
 * @param {RegExp} pattern - Pattern to match against option text
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>} True if option was selected
 */
export async function selectOptionByPattern(groupOptions, pattern, page) {
  const optionCount = await groupOptions.count();

  for (let i = 0; i < optionCount; i++) {
    const optionRow = groupOptions.nth(i);
    const optionNameSpan = optionRow.locator('.optionName span');

    if (await optionNameSpan.count() > 0) {
      const optionText = await optionNameSpan.textContent();
      const normalizedText = optionText ? optionText.trim().toLowerCase() : '';

      if (normalizedText && pattern.test(normalizedText)) {
        console.log(`✅ Found matching option: "${optionText}"`);
        const checkDiv = optionRow.locator('.jqx_inputBookingOptionsSelect_check').first();
        if (await checkDiv.count() > 0) {
          await checkDiv.click();
        } else {
          await optionRow.click();
        }
        await page.waitForTimeout(500);
        return true;
      }
    }
  }

  return false;
}

/**
 * Click the Next button on booking options page
 * @param {Locator} searchContext - Context to search in
 * @param {Page} page - Playwright page object
 * @param {FrameLocator|null} bookingIframe - Booking iframe if present
 */
export async function clickNextButton(searchContext, page, bookingIframe) {
  console.log('➡️ Clicking NEXT...');
  let nextButton = searchContext.locator('#diaryNewCourseBookingWiz_nextBtn').first();

  if (await nextButton.count() === 0) {
    nextButton = searchContext.locator('button:has-text("Next"), button:has-text("NEXT"), [aria-label="Next"]').first();
  }

  if (await nextButton.count() === 0) {
    throw new Error('Next button not found on booking options page');
  }

  await nextButton.waitFor({ state: 'visible', timeout: 5000 });
  await nextButton.click();

  // Wait for next page to load
  console.log('⏳ Waiting for next page to load...');
  await page.waitForTimeout(3000);

  if (bookingIframe) {
    await page.waitForTimeout(2000);
    const contactLookupIndicators = bookingIframe.locator('text=lookup, text=contact, text=add new contact').first();
    await contactLookupIndicators.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
      console.log('⚠️ Contact lookup page indicators not found, but continuing...');
    });
  }
}

/**
 * Select first available option as fallback
 * @param {Locator} allGroups - All groups locator
 * @param {number} groupCount - Number of groups
 * @param {Locator} searchContext - Context to search in
 * @param {Array<string>} skipHeadings - Headings to skip
 * @returns {Promise<boolean>} True if option was selected
 */
export async function selectFirstAvailableOption(allGroups, groupCount, searchContext, skipHeadings = []) {
  for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
    const group = allGroups.nth(groupIndex);
    const normalizedHeading = await getGroupHeading(group);

    if (skipHeadings.some(heading => normalizedHeading.includes(heading))) {
      continue;
    }

    const groupOptions = group.locator('.jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable');
    if (await groupOptions.count() > 0) {
      const firstOption = groupOptions.first();
      const checkDiv = firstOption.locator('.jqx_inputBookingOptionsSelect_check').first();
      if (await checkDiv.count() > 0) {
        await checkDiv.click();
      } else {
        await firstOption.click();
      }
      console.log(`✅ Selected first available option as fallback`);
      return true;
    }
  }
  return false;
}
