import * as commonSteps from '../commonBookingSteps/index.js';

/**
 * Select booking options (ITM-specific)
 * Handles bike type selection and other booking preferences
 * Used by both Step 5 (new client) and Step 7 (existing client)
 */
export async function selectBookingOptions(page, bookingArgs = {}, screenshotsDir) {
  // Define valid bike types at function level so they're accessible in catch block
  const validBikeTypes = ['125cc automatic', '50cc automatic', '125cc manual'];
  
  try {
    console.log('⚙️ [STEP 8] Selecting ITM booking options...');
    console.log(`📋 [STEP 8] Received bookingArgs:`, {
      bikeType: bookingArgs.bikeType || '(not provided)',
      hasBikeType: !!bookingArgs.bikeType,
      allKeys: Object.keys(bookingArgs)
    });
    
    // CRITICAL FIX: Navigate to booking options page FIRST
    // Then check preferences AFTER navigation to ensure agent is on correct page when asking
    console.log(`✅ [STEP 8] Navigating to booking options page first...`);
    
    // WAIT FOR PRICE PAGE TO LOAD - 5 seconds (increased for iframe/popup loading)
    console.log('⏳ [STEP 8] Waiting for price page to load...');
    await page.waitForTimeout(5000);
    
    // Check for popup windows first
    const pages = page.context().pages();
    let targetPage = page;
    if (pages.length > 1) {
      console.log(`🔍 [STEP 8] Found ${pages.length} pages, checking for booking popup...`);
      for (let i = 0; i < pages.length; i++) {
        const pageTitle = await pages[i].title();
        const pageUrl = pages[i].url();
        console.log(`   Page ${i + 1}: Title="${pageTitle}", URL="${pageUrl.substring(0, 100)}..."`);
        if (pageTitle.includes('booking') || pageTitle.includes('Booking') || 
            pageUrl.includes('booking') || pageUrl.includes('Booking')) {
          targetPage = pages[i];
          console.log(`✅ [STEP 8] Using popup window for booking form`);
          break;
        }
      }
    }
    
    // Define popup selectors at function level so they're accessible everywhere
    const popupSelectors = [
      '.dx-popup-wrapper:has-text("Price")',
      '.dx-popup-wrapper:has-text("Booking")',
      '.dx-popup-wrapper:has-text("1. Price")',
      '.dx-popup-wrapper:has-text("Booking options")',
      '.dx-popup-wrapper:has(#priceDetailsContainer)',
      '.dx-popup-wrapper:has(.jqx_form)',
      '.dx-popup-wrapper .dx-wizard',
      '.dx-popup-wrapper .dx-wizard-step',
      '.dx-popup.dx-popup-fullscreen',
      '.dx-popup-wrapper[role="dialog"]',
      '.dx-popup-wrapper:visible',
      '.dx-popup-content:has-text("Price")',
      '.dx-popup-content:has-text("Booking options")',
      '.dx-popup-content:has(#priceDetailsContainer)',
      '.dx-popup-content:has(.jqx_form)'
    ];
    
    // Determine if booking form is in an iframe, popup, or on main page
    let searchContext = targetPage;
    let bookingIframe = null;
    let popupContainer = null;
    let bookingFormContainer = null;
    
    // PRIORITY 0: Search for booking form containers FIRST (#priceDetailsContainer or .jqx_form)
    // This is the most reliable way to find the booking form regardless of where it is
    console.log('🔍 [STEP 8] PRIORITY 0: Searching for booking form containers (#priceDetailsContainer or .jqx_form)...');
    
    const bookingFormSelectors = [
      '#priceDetailsContainer',
      '.jqx_form',
      '#priceDetailsContainer .jqx_form',
      '.jqx_form:has(#priceDetailsContainer)'
    ];
    
    // Check main page first
    for (const selector of bookingFormSelectors) {
      const container = targetPage.locator(selector).first();
      if (await container.count() > 0) {
        const isVisible = await container.isVisible().catch(() => false);
        if (isVisible) {
          console.log(`✅ [STEP 8] Found booking form container on main page: "${selector}"`);
          bookingFormContainer = container;
          searchContext = bookingFormContainer;
          break;
        }
      }
    }
    
    // Check within diaries iframe (nested popup scenario)
    if (!bookingFormContainer) {
      console.log('🔍 [STEP 8] Checking for booking form within diaries iframe...');
      const diariesIframeExists = await targetPage.locator('#newDiaryDefault_iframe').count() > 0;
      if (diariesIframeExists) {
        const diariesIframe = targetPage.frameLocator('#newDiaryDefault_iframe');
        
        // Check for booking form directly in iframe
        for (const selector of bookingFormSelectors) {
          const container = diariesIframe.locator(selector).first();
          if (await container.count() > 0) {
            const isVisible = await container.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`✅ [STEP 8] Found booking form container in diaries iframe: "${selector}"`);
              bookingFormContainer = container;
              searchContext = bookingFormContainer;
              break;
            }
          }
        }
        
        // Check for popup within diaries iframe
        if (!bookingFormContainer) {
          console.log('🔍 [STEP 8] Checking for popup within diaries iframe...');
          const iframePopupSelectors = [
            '.dx-popup-wrapper:has(#priceDetailsContainer)',
            '.dx-popup-wrapper:has(.jqx_form)',
            '.dx-popup-wrapper:visible',
            '[role="dialog"]:has(#priceDetailsContainer)',
            '[role="dialog"]:has(.jqx_form)'
          ];
          
          for (const popupSelector of iframePopupSelectors) {
            const popup = diariesIframe.locator(popupSelector).first();
            if (await popup.count() > 0) {
              const isVisible = await popup.isVisible().catch(() => false);
              if (isVisible) {
                // Check if booking form is inside this popup
                const containerInPopup = popup.locator('#priceDetailsContainer, .jqx_form').first();
                if (await containerInPopup.count() > 0) {
                  console.log(`✅ [STEP 8] Found booking form in popup within diaries iframe: "${popupSelector}"`);
                  popupContainer = popup;
                  bookingFormContainer = containerInPopup;
                  searchContext = bookingFormContainer;
                  break;
                }
              }
            }
          }
        }
      }
    }
    
    // Check within eventNewBooking2_iframe (the actual booking form iframe)
    if (!bookingFormContainer) {
      console.log('🔍 [STEP 8] Checking for booking form within eventNewBooking2_iframe...');
      const eventBookingIframeExists = await targetPage.locator('#eventNewBooking2_iframe').count() > 0;
      if (eventBookingIframeExists) {
        const eventBookingIframe = targetPage.frameLocator('#eventNewBooking2_iframe');
        
        // Wait for iframe to load
        await targetPage.waitForTimeout(2000);
        await targetPage.evaluate((id) => {
          return new Promise((resolve) => {
            const iframe = document.querySelector(`#${id}`);
            if (iframe && iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
              resolve(true);
            } else {
              setTimeout(() => resolve(true), 1000);
            }
          });
        }, 'eventNewBooking2_iframe');
        
        // Check for booking form directly in iframe
        for (const selector of bookingFormSelectors) {
          const container = eventBookingIframe.locator(selector).first();
          if (await container.count() > 0) {
            const isVisible = await container.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`✅ [STEP 8] Found booking form container in eventNewBooking2_iframe: "${selector}"`);
              bookingFormContainer = container;
              searchContext = bookingFormContainer;
              break;
            }
          }
        }
        
        // If container not found, use iframe as context
        if (!bookingFormContainer) {
          console.log('✅ [STEP 8] Using eventNewBooking2_iframe as search context');
          bookingIframe = eventBookingIframe;
          searchContext = eventBookingIframe;
        }
      }
    }
    
    // PRIORITY 1: Check for DevExtreme popup/dialog (if container not found yet)
    if (!bookingFormContainer) {
      console.log('🔍 [STEP 8] PRIORITY 1: Checking for DevExtreme popup/dialog...');
      
      for (const popupSelector of popupSelectors) {
        const popup = targetPage.locator(popupSelector).first();
        if (await popup.count() > 0) {
          const isVisible = await popup.isVisible().catch(() => false);
          if (isVisible) {
            // Check if booking form is inside this popup
            const containerInPopup = popup.locator('#priceDetailsContainer, .jqx_form').first();
            if (await containerInPopup.count() > 0) {
              console.log(`✅ [STEP 8] Found booking form in DevExtreme popup: "${popupSelector}"`);
              popupContainer = popup;
              bookingFormContainer = containerInPopup;
              searchContext = bookingFormContainer;
              break;
            } else {
              console.log(`✅ [STEP 8] Found DevExtreme popup (no booking form container yet): "${popupSelector}"`);
              popupContainer = popup;
              searchContext = popupContainer;
            }
          }
        }
      }
    }
    
    // PRIORITY 2: Check for generic popups (not just DevExtreme)
    if (!bookingFormContainer && !popupContainer) {
      console.log('🔍 [STEP 8] PRIORITY 2: Checking for generic popups/dialogs...');
      const genericPopupSelectors = [
        '[role="dialog"]:has(#priceDetailsContainer)',
        '[role="dialog"]:has(.jqx_form)',
        '[role="dialog"]:visible',
        '.popup:has(#priceDetailsContainer)',
        '.popup:has(.jqx_form)',
        '.popup:visible',
        '.modal:has(#priceDetailsContainer)',
        '.modal:has(.jqx_form)',
        '.modal:visible',
        '.dialog:has(#priceDetailsContainer)',
        '.dialog:has(.jqx_form)',
        '.dialog:visible'
      ];
      
      for (const popupSelector of genericPopupSelectors) {
        const popup = targetPage.locator(popupSelector).first();
        if (await popup.count() > 0) {
          const isVisible = await popup.isVisible().catch(() => false);
          if (isVisible) {
            // Check if booking form is inside this popup
            const containerInPopup = popup.locator('#priceDetailsContainer, .jqx_form').first();
            if (await containerInPopup.count() > 0) {
              console.log(`✅ [STEP 8] Found booking form in generic popup: "${popupSelector}"`);
              popupContainer = popup;
              bookingFormContainer = containerInPopup;
              searchContext = bookingFormContainer;
              break;
            }
          }
        }
      }
    }
    
    // PRIORITY 3: Check for iframes that might contain the booking form
    // NOTE: Excluding 'newDiaryDefault_iframe' as it's the diaries iframe, not the booking form
    if (!bookingFormContainer && !popupContainer) {
      console.log('🔍 [STEP 8] PRIORITY 3: Checking for booking form iframe...');
      const possibleIframeIds = [
        'eventNewBooking2_iframe',  // This is the actual booking form iframe!
        'booking_iframe',
        'diaryNewCourseBooking_iframe',
        'courseBooking_iframe',
        'bookingWizard_iframe',
        'newBooking_iframe'
      ];
      
      for (const iframeId of possibleIframeIds) {
        const iframeExists = await targetPage.locator(`#${iframeId}`).count() > 0;
        if (iframeExists) {
          console.log(`✅ [STEP 8] Found iframe: #${iframeId}`);
          bookingIframe = targetPage.frameLocator(`#${iframeId}`);
          
          // Check if booking form is in this iframe
          for (const selector of bookingFormSelectors) {
            const container = bookingIframe.locator(selector).first();
            if (await container.count() > 0) {
              const isVisible = await container.isVisible().catch(() => false);
              if (isVisible) {
                console.log(`✅ [STEP 8] Found booking form container in iframe #${iframeId}: "${selector}"`);
                bookingFormContainer = container;
                searchContext = bookingFormContainer;
                break;
              }
            }
          }
          
          if (bookingFormContainer) {
            break;
          }
          
          // Wait for iframe to load
          await targetPage.waitForTimeout(2000);
          await targetPage.evaluate((id) => {
            return new Promise((resolve) => {
              const iframe = document.querySelector(`#${id}`);
              if (iframe && iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                resolve(true);
              } else {
                setTimeout(() => resolve(true), 1000);
              }
            });
          }, iframeId);
          
          // Use iframe as context if no container found yet
          if (!bookingFormContainer) {
            searchContext = bookingIframe;
          }
          break;
        }
      }
    }
    
    // PRIORITY 4: Fallback to main page if nothing found
    if (!bookingFormContainer && !popupContainer && !bookingIframe) {
      console.log('🔍 [STEP 8] PRIORITY 4: No container/popup/iframe found, using main page...');
      searchContext = targetPage;
    }
    
    // Debug: Log what we're searching in
    console.log('📊 [STEP 8] Context detection summary:');
    if (bookingFormContainer) {
      console.log('   ✅ Booking form container found - using as search context');
    } else if (popupContainer) {
      console.log('   ✅ Popup container found - using as search context');
    } else if (bookingIframe) {
      console.log('   ✅ Iframe found - using as search context');
    } else {
      console.log('   ⚠️ Using main page as search context');
    }
    
    // Try multiple selectors for "1. Price" header
    console.log('🔍 [STEP 8] Looking for "1. Price" header...');
    const priceHeaderSelectors = [
      'text=1. Price',
      'text="1. Price"',
      '*:has-text("1. Price")',
      'span:has-text("1. Price")',
      'div:has-text("1. Price")',
      '*:has-text("Price")',
      '.dx-wizard-step[aria-selected="true"]:has-text("Price")',
      '[role="tab"]:has-text("Price")'
    ];
    
    let priceHeader = null;
    for (const selector of priceHeaderSelectors) {
      try {
        priceHeader = searchContext.locator(selector).first();
        const count = await priceHeader.count();
        if (count > 0) {
          const isVisible = await priceHeader.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ [STEP 8] Found "1. Price" using selector: "${selector}"`);
            break;
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    // If still not found, try waiting with a more flexible approach
    if (!priceHeader || await priceHeader.count() === 0) {
      console.log('⚠️ [STEP 8] "1. Price" not found with standard selectors, trying alternative approach...');
      await targetPage.waitForTimeout(2000);
      
      // Try to find any element containing "Price" in the visible text
      const anyPriceElement = searchContext.locator('*:has-text("Price")').first();
      if (await anyPriceElement.count() > 0) {
        const text = await anyPriceElement.textContent();
        if (text && text.includes('Price')) {
          console.log(`✅ [STEP 8] Found element with "Price" text: "${text.substring(0, 50)}"`);
          priceHeader = anyPriceElement;
        }
      }
    }
    
    // If still not found, proceed anyway (page might be loaded but selector is different)
    if (!priceHeader || await priceHeader.count() === 0) {
      console.log('⚠️ [STEP 8] Could not find "1. Price" header, but proceeding to check for booking options...');
      await commonSteps.takeScreenshot(targetPage, 'price-page-loaded.png', screenshotsDir);
    } else {
      // Wait for price header to be visible
      await priceHeader.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
        console.log('⚠️ [STEP 8] Price header visibility check timed out, continuing...');
      });
      
      // Take screenshot of price page
      await commonSteps.takeScreenshot(targetPage, 'price-page-loaded.png', screenshotsDir);
    }
    
    // Scroll to booking options
    console.log('📜 [STEP 8] Scrolling to booking options...');
    const bookingOptionsSelectors = [
      'text=Booking options',
      'span:has-text("Booking options")',
      'div:has-text("Booking options")',
      '*:has-text("Booking options")'
    ];
    
    let bookingOptionsSection = null;
    for (const selector of bookingOptionsSelectors) {
      try {
        bookingOptionsSection = searchContext.locator(selector).first();
        if (await bookingOptionsSection.count() > 0) {
          const isVisible = await bookingOptionsSection.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ [STEP 8] Found "Booking options" using selector: "${selector}"`);
            break;
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (bookingOptionsSection && await bookingOptionsSection.count() > 0) {
      await bookingOptionsSection.scrollIntoViewIfNeeded();
    } else {
      console.log('⚠️ [STEP 8] Could not find "Booking options" section, scrolling to bottom...');
      await targetPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    }
    
    // WAIT FOR OPTIONS TO BE VISIBLE - 2 seconds
    console.log('⏳ [STEP 8] Waiting for booking options to be visible...');
    await page.waitForTimeout(2000);
    
    // CRITICAL FIX: NOW check preferences AFTER navigation to booking options page
    // This ensures the agent is on the correct page when asking for preferences
    console.log(`🔍 [STEP 8] Checking preferences now that we're on the booking options page...`);
    
    // Step 1: Validate provided preferences (if any)
    const invalidPreferences = [];
    
    if (bookingArgs.bikeType) {
      console.log(`🔍 [STEP 8] bikeType provided: "${bookingArgs.bikeType}", validating...`);
      const normalizedBikeType = bookingArgs.bikeType.trim().toLowerCase();
      const isValid = validBikeTypes.some(valid => valid.toLowerCase() === normalizedBikeType);
      if (!isValid) {
        console.log(`❌ [STEP 8] Invalid bikeType: "${bookingArgs.bikeType}"`);
        invalidPreferences.push({
          preference: 'bikeType',
          providedValue: bookingArgs.bikeType,
          validOptions: validBikeTypes
        });
      } else {
        console.log(`✅ [STEP 8] Valid bikeType: "${bookingArgs.bikeType}"`);
      }
    } else {
      console.log(`⚠️ [STEP 8] bikeType NOT provided in bookingArgs`);
    }
    
    if (invalidPreferences.length > 0) {
      const invalidPref = invalidPreferences[0];
      console.log(`🔄 [STEP 8] Returning requiresPreferences due to invalid preferences:`, invalidPreferences);
      return {
        success: false,
        requiresPreferences: true,
        invalidPreferences: invalidPreferences.map(p => p.preference),
        message: `I'm sorry, but "${invalidPref.providedValue}" is not a valid bike type for the ITM course. Please choose one of: "${validBikeTypes.join('", "')}".`,
        validOptions: validBikeTypes,
        onBookingOptionsPage: true,
        instruction: 'You are now on the booking options page. Ask the client about their bike type preference: "Would you like 125cc automatic (scooter), 50cc automatic, or 125cc manual (geared)?"'
      };
    }
    
    // Step 2: Check for missing required preferences
    console.log(`🔍 [STEP 8] Checking for missing required preferences...`);
    const missingPreferences = [];
    if (!bookingArgs.bikeType) {
      console.log(`⚠️ [STEP 8] bikeType is missing - adding to missingPreferences`);
      missingPreferences.push('bikeType');
    }
    
    if (missingPreferences.length > 0) {
      console.log(`🔄 [STEP 8] Returning requiresPreferences due to missing preferences:`, missingPreferences);
      return {
        success: false,
        requiresPreferences: true,
        missingPreferences: missingPreferences,
        message: `I need to know your bike type preference for the ITM course. Would you like to do the course on a "125cc automatic (scooter)", a "50cc automatic", or a "125cc manual (geared)"?`,
        validOptions: validBikeTypes,
        onBookingOptionsPage: true,
        instruction: 'You are now on the booking options page. Ask the client about their bike type preference: "Would you like 125cc automatic (scooter), 50cc automatic, or 125cc manual (geared)?"'
      };
    }
    
    console.log(`✅ [STEP 8] All preferences provided, proceeding with bike type selection...`);
    
    // NOTE: Scroll to booking options is already handled at line 467 above
    // Removed redundant scroll that was causing timeout errors
    
    // Find all booking option groups
    console.log('📋 [STEP 8] Finding all booking option groups...');
    const allGroups = searchContext.locator('.jqxInputBookingOptionsSelectGroupOuter');
    const groupCount = await allGroups.count();
    console.log(`📊 [STEP 8] Found ${groupCount} booking option group(s)`);
    
    if (groupCount === 0) {
      // If booking form isn't found, return requiresPreferences instead of throwing
      // This allows the voice agent to ask for preferences and retry
      console.warn('⚠️ [STEP 8] No booking option groups found - returning requiresPreferences');
      return {
        requiresPreferences: true,
        missingPreferences: ['bikeType'],
        message: `I need to know your bike type preference for the ITM course. Would you like to do the course on a "125cc automatic (scooter)", a "50cc automatic", or a "125cc manual (geared)"?`,
        validOptions: validBikeTypes
      };
    }
    
    // Process each group
    for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
      const group = allGroups.nth(groupIndex);
      
      // Get group heading to identify what question this group is asking
      const groupHeading = group.locator('h1.jqx_formBoilerPlateText.jqx_formHeading span').first();
      const headingText = await groupHeading.textContent().catch(() => '');
      const normalizedHeading = headingText ? headingText.trim() : '';
      
      console.log(`📋 [STEP 8] Processing group ${groupIndex + 1}/${groupCount}: "${normalizedHeading || '(no heading)'}"`);
      
      // Skip groups that are not relevant for ITM
      if (normalizedHeading.toLowerCase().includes('cbt course type')) {
        console.log(`⏭️ [STEP 8] Skipping "CBT course type" group (not relevant for ITM)`);
        continue;
      }
      
      if (normalizedHeading.toLowerCase().includes('full licence')) {
        console.log(`⏭️ [STEP 8] Skipping "Full Licence courses" group (not relevant for ITM)`);
        continue;
      }
      
      // Handle bike type group (group_id="0" or no specific heading)
      // This is the main group we need to handle for ITM
      const groupOptions = group.locator('.jqxInputBookingOptionsSelectRow.jqxInputBookingOptions_rowSelectable');
      const optionCount = await groupOptions.count();
      console.log(`   Found ${optionCount} options in this group`);
      
      if (optionCount === 0) {
        console.log(`⚠️ [STEP 8] No options found in group "${normalizedHeading}", skipping...`);
        continue;
      }
      
      // For bike type group, select the appropriate bike type
      if (!normalizedHeading || normalizedHeading === '' || normalizedHeading.toLowerCase().includes('bike') || normalizedHeading.toLowerCase().includes('motorcycle')) {
        console.log('🚲 [STEP 8] This appears to be the bike type group, selecting bike type...');
        
        const bikeType = bookingArgs.bikeType || '125cc automatic';
        const bikeTypeMap = {
          // Updated patterns to handle spacing variations: "50cc" vs "50 cc", "125cc" vs "125 cc"
          '125cc automatic': /125\s*cc\s+automatic.*scooter/i,
          '50cc automatic': /50\s*cc\s+automatic/i,
          '125cc manual': /125\s*cc\s+manual.*geared/i
        };
        
        const bikePattern = bikeTypeMap[bikeType] || bikeTypeMap['125cc automatic'];
        console.log(`✅ [STEP 8] Selecting bike type: ${bikeType}`);
        console.log(`🔍 [STEP 8] Using flexible regex pattern: ${bikePattern}`);
        
        let matchingOption = null;
        let matchingRowIndex = -1;
        
        // Find matching bike type option in this group
        console.log(`🔍 [STEP 8] Searching through ${optionCount} options for bike type: "${bikeType}"`);
        
        for (let i = 0; i < optionCount; i++) {
          const optionRow = groupOptions.nth(i);
          const optionNameSpan = optionRow.locator('.optionName span');
          
          if (await optionNameSpan.count() > 0) {
            const optionText = await optionNameSpan.textContent();
            const normalizedText = optionText ? optionText.trim().toLowerCase() : '';
            
            // Log first few options for debugging
            if (i < 5) {
              console.log(`   Option ${i + 1}: "${optionText}"`);
            }
            
            if (normalizedText && bikePattern.test(normalizedText)) {
              console.log(`✅ [STEP 8] Found matching bike type option at index ${i}: "${optionText}"`);
              matchingOption = optionRow;
              matchingRowIndex = i;
              break;
            }
          } else {
            // Try alternative selector if .optionName span doesn't exist
            const alternativeText = await optionRow.textContent().catch(() => '');
            if (alternativeText) {
              const normalizedAlt = alternativeText.trim().toLowerCase();
              if (bikePattern.test(normalizedAlt)) {
                console.log(`✅ [STEP 8] Found matching bike type using alternative selector at index ${i}: "${alternativeText}"`);
                matchingOption = optionRow;
                matchingRowIndex = i;
                break;
              }
            }
          }
        }
        
        // If no match found, log all options for debugging
        if (!matchingOption) {
          console.log(`⚠️ [STEP 8] No matching bike type found. Listing all ${optionCount} options:`);
          for (let i = 0; i < Math.min(optionCount, 11); i++) {
            const optionRow = groupOptions.nth(i);
            const optionNameSpan = optionRow.locator('.optionName span');
            const optionText = await optionNameSpan.textContent().catch(() => {
              return optionRow.textContent().catch(() => 'N/A');
            });
            console.log(`   Option ${i + 1}: "${optionText}"`);
          }
        }
        
        if (matchingOption && matchingRowIndex >= 0) {
          const checkDiv = matchingOption.locator('.jqx_inputBookingOptionsSelect_check').first();
          if (await checkDiv.count() > 0) {
            await checkDiv.click();
            const selectedText = await matchingOption.locator('.optionName span').textContent();
            console.log(`✅ [STEP 8] Selected bike type: "${selectedText}"`);
            await page.waitForTimeout(500);
          } else {
            await matchingOption.click();
            const selectedText = await matchingOption.locator('.optionName span').textContent();
            console.log(`✅ [STEP 8] Clicked bike type row: "${selectedText}"`);
            await page.waitForTimeout(500);
          }
        } else {
          console.log(`⚠️ [STEP 8] No matching bike type found in this group, selecting first available option`);
          const firstOption = groupOptions.first();
          const checkDiv = firstOption.locator('.jqx_inputBookingOptionsSelect_check').first();
          if (await checkDiv.count() > 0) {
            await checkDiv.click();
            const selectedText = await firstOption.locator('.optionName span').textContent();
            console.log(`✅ [STEP 8] Selected first option as fallback: "${selectedText}"`);
          } else {
            await firstOption.click();
            const selectedText = await firstOption.locator('.optionName span').textContent();
            console.log(`✅ [STEP 8] Clicked first option row as fallback: "${selectedText}"`);
          }
          await page.waitForTimeout(500);
        }
      } else {
        // For other groups, check if selection is required
        // Get group attributes to check requirements
        const groupContainer = group.locator('.jqxInputBookingOptionsSelectGroup').first();
        const selectAtLeast = await groupContainer.getAttribute('data-select_at_least').catch(() => '0');
        const selectAtMost = await groupContainer.getAttribute('data-select_at_most').catch(() => '255');
        
        console.log(`   Group "${normalizedHeading}": select_at_least=${selectAtLeast}, select_at_most=${selectAtMost}`);
        
        // If selection is required (select_at_least > 0), select first option
        if (parseInt(selectAtLeast) > 0) {
          console.log(`⚠️ [STEP 8] Group "${normalizedHeading}" requires at least ${selectAtLeast} selection(s), selecting first option...`);
          const firstOption = groupOptions.first();
          const checkDiv = firstOption.locator('.jqx_inputBookingOptionsSelect_check').first();
          if (await checkDiv.count() > 0) {
            await checkDiv.click();
            const optionText = await firstOption.locator('.optionName span').textContent();
            console.log(`✅ [STEP 8] Selected first option in "${normalizedHeading}": "${optionText}"`);
            await page.waitForTimeout(500);
          } else {
            await firstOption.click();
            const optionText = await firstOption.locator('.optionName span').textContent();
            console.log(`✅ [STEP 8] Clicked first option in "${normalizedHeading}": "${optionText}"`);
            await page.waitForTimeout(500);
          }
        } else {
          console.log(`ℹ️ [STEP 8] Group "${normalizedHeading}" does not require selection (select_at_least=0), skipping...`);
        }
      }
    }
    
    console.log(`✅ [STEP 8] Processed all booking option groups`);
    
    // Wait for all selections to register
    await page.waitForTimeout(1000);
    
    // Take screenshot after all selections
    await commonSteps.takeScreenshot(targetPage, 'bike-option-selected.png', screenshotsDir);
    
    // Click NEXT button using the specific ID from HTML structure
    console.log('➡️ [STEP 8] Clicking NEXT...');
    let nextButton = searchContext.locator('#diaryNewCourseBookingWiz_nextBtn').first();
    
    // FALLBACK: Try alternative contexts if button not found
    if (await nextButton.count() === 0) {
      console.log('⚠️ [STEP 8] Next button not found in current context, trying fallback contexts...');
      
      // Strategy 1: Try within eventNewBooking2_iframe if we're using container context
      if (bookingFormContainer && !bookingIframe) {
        console.log('🔍 [STEP 8] Trying eventNewBooking2_iframe context for Next button...');
        const eventBookingIframeExists = await targetPage.locator('#eventNewBooking2_iframe').count() > 0;
        if (eventBookingIframeExists) {
          const eventBookingIframe = targetPage.frameLocator('#eventNewBooking2_iframe');
          const iframeNextButton = eventBookingIframe.locator('#diaryNewCourseBookingWiz_nextBtn').first();
          if (await iframeNextButton.count() > 0) {
            console.log('✅ [STEP 8] Found Next button in eventNewBooking2_iframe!');
            nextButton = iframeNextButton;
          }
        }
      }
      
      // Strategy 2: Try main page
      if ((await nextButton.count() === 0) && (popupContainer || bookingIframe || bookingFormContainer)) {
        const mainPageNextButton = targetPage.locator('#diaryNewCourseBookingWiz_nextBtn').first();
        if (await mainPageNextButton.count() > 0) {
          console.log('✅ [STEP 8] Found Next button on main page!');
          nextButton = mainPageNextButton;
        }
      }
      
      // Strategy 3: Try popup if not found (now popupSelectors is accessible)
      if ((await nextButton.count() === 0) && !popupContainer) {
        for (const popupSelector of popupSelectors) {
          const popup = targetPage.locator(popupSelector).first();
          if (await popup.count() > 0) {
            const isVisible = await popup.isVisible().catch(() => false);
            if (isVisible) {
              const popupNextButton = popup.locator('#diaryNewCourseBookingWiz_nextBtn').first();
              if (await popupNextButton.count() > 0) {
                console.log(`✅ [STEP 8] Found Next button in popup: "${popupSelector}"`);
                nextButton = popupNextButton;
                break;
              }
            }
          }
        }
      }
    }
    
    if (await nextButton.count() === 0) {
      // Fallback: try other selectors in current context
      const nextButtonFallback = searchContext.locator('button:has-text("Next"), button:has-text("NEXT"), [aria-label="Next"]').first();
      if (await nextButtonFallback.count() > 0) {
        await nextButtonFallback.click();
      } else {
        // Try main page with fallback selectors
        const mainPageFallback = targetPage.locator('button:has-text("Next"), button:has-text("NEXT"), [aria-label="Next"]').first();
        if (await mainPageFallback.count() > 0) {
          console.log('✅ [STEP 8] Found Next button on main page with fallback selector!');
          await mainPageFallback.click();
        } else {
          throw new Error('Next button not found on booking options page');
        }
      }
    } else {
      await nextButton.waitFor({ state: 'visible', timeout: 5000 });
      await nextButton.click();
    }
    
    // WAIT FOR NEXT PAGE TO LOAD - Handle iframe navigation properly
    console.log('⏳ [STEP 8] Waiting for next page to load...');
    await page.waitForTimeout(3000);
    
    // If we're working in an iframe, wait for iframe content to update instead of main page
    if (bookingIframe || bookingFormContainer) {
      console.log('🔍 [STEP 8] Waiting for iframe content to update after navigation...');
      try {
        const eventBookingIframeExists = await targetPage.locator('#eventNewBooking2_iframe').count() > 0;
        if (eventBookingIframeExists) {
          const eventBookingIframe = targetPage.frameLocator('#eventNewBooking2_iframe');
          // Wait for iframe to be ready and check for new page content (contact lookup page)
          await page.waitForTimeout(2000);
          // Try to find indicators of the next page (contact lookup or add new contact)
          const contactLookupIndicators = eventBookingIframe.locator('text=lookup, text=contact, text=add new contact, button:has-text("lookup"), button:has-text("contact")').first();
          await contactLookupIndicators.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
            console.log('⚠️ [STEP 8] Contact lookup page indicators not found, but continuing...');
          });
          console.log('✅ [STEP 8] Iframe content updated - next page loaded');
        }
      } catch (e) {
        console.log(`⚠️ [STEP 8] Iframe wait check failed: ${e.message}, continuing...`);
      }
    } else {
      // Main page context - use normal wait
      await page.waitForLoadState('networkidle').catch(() => {
        console.log('⚠️ [STEP 8] Network idle wait failed, continuing...');
      });
    }
    
    console.log('✅ [STEP 8] Booking options selected and Next button clicked');
    
    // Return success - no preferences needed, booking options were selected
    return {
      success: true,
      message: 'Booking options selected successfully'
    };
    
  } catch (error) {
    console.error('❌ [STEP 8] Error in selectBookingOptions:', error);
    console.error('❌ [STEP 8] Error message:', error.message);
    console.error('❌ [STEP 8] Error stack:', error.stack);
    await commonSteps.takeScreenshot(page, 'booking-options-error.png', screenshotsDir).catch(() => {});
    
    // If the error is related to form/page not found or timeout, return requiresPreferences instead of throwing
    // This allows the voice agent to ask for preferences and retry
    const errorMessage = error.message.toLowerCase();
    const isFormNotFound = errorMessage.includes('no booking option groups') ||
                          errorMessage.includes('booking form') ||
                          errorMessage.includes('price page') ||
                          errorMessage.includes('not found') ||
                          errorMessage.includes('could not find') ||
                          errorMessage.includes('timeout') ||
                          errorMessage.includes('element is not visible') ||
                          errorMessage.includes('waiting for') ||
                          errorMessage.includes('target page') ||
                          errorMessage.includes('context or browser has been closed');
    
    if (isFormNotFound) {
      console.warn('⚠️ [STEP 8] Booking form/page not found or timeout - returning requiresPreferences');
      console.warn('⚠️ [STEP 8] This allows the voice agent to ask for bikeType preference and retry');
      return {
        requiresPreferences: true,
        missingPreferences: ['bikeType'],
        message: `I need to know your bike type preference for the ITM course. Would you like to do the course on a "125cc automatic (scooter)", a "50cc automatic", or a "125cc manual (geared)"?`,
        validOptions: validBikeTypes
      };
    }
    
    // For other errors, still throw to maintain existing behavior
    console.error('❌ [STEP 8] Error does not match form-not-found pattern, throwing error');
    throw new Error(`Failed to select booking options: ${error.message}`);
  }
}

