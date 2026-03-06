import { takeScreenshot } from '../utils.js';
import { selectSmartSearch, executeSearch, findMatchingClientRow, clickClientRow } from './searchClient.js';
import { extractClientDetails } from './extractClientDetails.js';
import { verifyClientMatch } from './verifyClientMatch.js';
import { getVerificationPrompt } from '../../verificationService.js';
import { conversations } from '../../../shared/state.js';
import { buildNameSearchStrings, NAME_SEARCH_RETRY_PROMPT } from './nameSearch.js';
import { 
  validateUKMobile, 
  normalizeUKMobile, 
  getMobileSearchRetryPrompt, 
  trackMobileSearchAttempt, 
  isMobileSearchExhausted,
  getMobileSearchAttemptCount
} from '../../mobileSearchService.js';

/**
 * Find and verify existing client in CRM
 * Handles mobile search with 3-attempt retry logic and client verification
 * 
 * @param {Page} page - Playwright page object
 * @param {string} searchType - 'mobile' | 'email' | 'name' - type of search to perform
 * @param {string} searchValue - Mobile number or email address to search for
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {string} [email] - Optional email address to use when Smart search is selected
 * @param {string} [clientPostcode] - Optional postcode for verification when multiple results appear
 * @param {string} [callSid] - Call SID for conversation state tracking
 * @param {Function|null} [progressCallback] - Optional callback({ message }) for path-based voice updates
 * @returns {Promise<{found: boolean, clientDetails?: object, requiresVerification: boolean, verificationPrompt?: string, retryPrompt?: string, nextSearchType?: string, requiresPostcodeVerification?: boolean, error?: string}>}
 */
export async function findAndVerifyClient(page, searchType, searchValue, screenshotsDir, email = null, clientPostcode = null, callSid = null, progressCallback = null) {
  try {
    // Get conversation state for tracking
    const conversation = callSid ? conversations[callSid] : null;
    
    // Normalize mobile number early if needed (for use in search input)
    let normalizedMobile = null;
    
    // Handle mobile search retry logic
    if (searchType === 'mobile') {
      // Reject +44 format: require 07 + 11 digits (UK format) so we don't auto-convert
      const cleanedForFormat = (searchValue || '').replace(/[\s\-\(\)]/g, '');
      if (cleanedForFormat.startsWith('+44')) {
        return {
          found: false,
          requiresVerification: false,
          error: 'Please provide your mobile number in UK format: 07 followed by 9 digits (11 digits total). For example 07123456789.',
          retryPrompt: 'Please say your mobile number starting with 07, then the remaining 9 digits—for example 07 123 456 789.'
        };
      }
      // Validate UK mobile format (07 + 9 digits = 11 digits)
      if (!validateUKMobile(searchValue)) {
        return {
          found: false,
          requiresVerification: false,
          error: 'Invalid UK mobile number format. Please provide an 11-digit number starting with 07.'
        };
      }
      
      // Normalize mobile number (removes dashes, spaces, etc.)
      normalizedMobile = normalizeUKMobile(searchValue);
      if (!normalizedMobile) {
        return {
          found: false,
          requiresVerification: false,
          error: 'Could not normalize mobile number. Please provide a valid UK mobile number.'
        };
      }
      
      // Track attempt if conversation exists
      if (conversation) {
        trackMobileSearchAttempt(conversation, normalizedMobile);
        const attemptCount = getMobileSearchAttemptCount(conversation);
        
        // Only return without searching when mobile search exhausted (3 attempts)
        if (isMobileSearchExhausted(conversation)) {
          return {
            found: false,
            requiresVerification: false,
            retryPrompt: getMobileSearchRetryPrompt(3),
            error: 'Mobile search exhausted after 3 attempts'
          };
        }
      }
    }
    
    console.log(`[PROGRESS] [findAndVerifyClient] invoking progressCallback (hasCallback=${typeof progressCallback === 'function'}): "Opening the Contacts tab."`);
    progressCallback?.({ message: 'Opening the Contacts tab.' });
    console.log('👤 [CLIENT SEARCH] Navigating to Contacts tab...');
    
    // Click CONTACTS tab
    const contactsTab = page.locator('h3.list-menu-item-heading:has-text("Contacts")');
    await contactsTab.click();
    
    // Wait for page to fully load
    console.log(`[PROGRESS] [findAndVerifyClient] progressCallback: "Loading the contacts page."`);
    progressCallback?.({ message: 'Loading the contacts page.' });
    console.log('⏳ [CLIENT SEARCH] Waiting for Contacts page to fully load...');
    await page.waitForTimeout(8000);
    
    // Instead of networkidle (which may never occur due to continuous network activity),
    // wait for the iframe to be present and attached
    try {
      await page.locator('#contactLookup_iframe').waitFor({ 
        state: 'attached', 
        timeout: 30000 
      });
      console.log('✅ [CLIENT SEARCH] Contacts iframe attached');
    } catch (e) {
      console.log('⚠️ [CLIENT SEARCH] Iframe not found within timeout, but continuing...');
    }
    
    await takeScreenshot(page, 'contacts-page-loaded.png', screenshotsDir);
    
    console.log('🔍 [CLIENT SEARCH] Looking for Contacts iframe...');
    
    // Wait for the iframe to be present and loaded
    const iframe = page.frameLocator('#contactLookup_iframe');
    
    // Wait for the iframe to load completely
    console.log('⏳ [CLIENT SEARCH] Waiting for iframe to load completely...');
    await page.waitForTimeout(5000);
    
    await page.waitForFunction(() => {
      const iframe = document.querySelector('#contactLookup_iframe');
      return iframe && iframe.contentDocument && iframe.contentDocument.readyState === 'complete';
    }, { timeout: 15000 });
    
    console.log('✅ [CLIENT SEARCH] Iframe loaded, switching context...');
    
    // Select Smart search
    console.log(`[PROGRESS] [findAndVerifyClient] progressCallback: "Searching for your profile."`);
    progressCallback?.({ message: 'Searching for your profile.' });
    await selectSmartSearch(iframe, page, screenshotsDir);
    
    // Determine final search value and type
    let finalSearchValue = searchValue;
    let finalSearchType = searchType;
    let nameSearchFallback = null;

    if (searchType === 'name') {
      const { primary, fallback } = buildNameSearchStrings(searchValue);
      finalSearchValue = primary;
      nameSearchFallback = fallback;
      console.log(`🔍 [CLIENT SEARCH] Name search: primary="${primary}", fallback=${fallback || 'none'}`);
    } else if (email) {
      finalSearchValue = email;
      finalSearchType = 'email';
      console.log(`🔍 [CLIENT SEARCH] Smart search selected - using email: ${email}`);
    } else if (searchType === 'mobile') {
      // Use normalized mobile number (without dashes/spaces) for search input
      if (normalizedMobile) {
        finalSearchValue = normalizedMobile;
        console.log(`🔍 [CLIENT SEARCH] Using normalized mobile number for search: ${normalizedMobile} (original: ${searchValue})`);
      } else {
        console.warn(`⚠️ [CLIENT SEARCH] Smart search selected but no email provided - using mobile number (this may not work correctly)`);
      }
    }

    // Execute search
    console.log(`[PROGRESS] [findAndVerifyClient] progressCallback: "Waiting for results, please hold on."`);
    progressCallback?.({ message: 'Waiting for results, please hold on.' });
    await executeSearch(iframe, page, finalSearchValue, screenshotsDir);

    // Find matching client row
    let matchResult = await findMatchingClientRow(iframe, finalSearchType, finalSearchValue, email);

    if (!matchResult && searchType === 'name' && nameSearchFallback) {
      await executeSearch(iframe, page, nameSearchFallback, screenshotsDir);
      matchResult = await findMatchingClientRow(iframe, finalSearchType, nameSearchFallback, email);
    }

    if (!matchResult) {
      if (searchType === 'email') {
        return {
          found: false,
          requiresVerification: false,
          retryPrompt: NAME_SEARCH_RETRY_PROMPT,
          nextSearchType: 'name',
          error: 'Email search found no client - ask for full name'
        };
      }
      if (searchType === 'mobile' && conversation) {
        const attemptCount = getMobileSearchAttemptCount(conversation);
        if (attemptCount < 3) {
          return {
            found: false,
            requiresVerification: false,
            retryPrompt: getMobileSearchRetryPrompt(attemptCount),
            error: `Mobile search attempt ${attemptCount} failed - no client found`
          };
        }
      }
      return {
        found: false,
        requiresVerification: false,
        error: 'Could not find client in CRM'
      };
    }
    
    // Click on the matching row
    const clickSuccess = await clickClientRow(iframe, page, matchResult.rowIndex);
    
    if (!clickSuccess) {
      return {
        found: false,
        requiresVerification: false,
        error: 'Could not navigate to client details page'
      };
    }
    
    // ========== CRITICAL FIX: Switch to contactEdit_iframe after clicking ==========
    // After clicking a client row, the client details page loads in contactEdit_iframe,
    // NOT in contactLookup_iframe. We need to switch to the correct iframe.
    console.log('🔄 [CLIENT SEARCH] Switching to contactEdit_iframe for client details...');
    
    // Wait for contactEdit_iframe to appear and load
    await page.waitForTimeout(3000); // Give time for iframe to load
    
    // Check if contactEdit_iframe exists
    const contactEditIframeExists = await page.locator('#contactEdit_iframe').count();
    if (contactEditIframeExists === 0) {
      console.log('⚠️ [CLIENT SEARCH] contactEdit_iframe not found, waiting longer...');
      await page.waitForTimeout(2000);
    }
    
    // Switch to contactEdit_iframe for extracting client details
    const clientDetailsIframe = page.frameLocator('#contactEdit_iframe');
    
    // Wait for the client details page to load in the new iframe
    try {
      await clientDetailsIframe.locator('#fullSummaryTable').waitFor({ 
        state: 'visible', 
        timeout: 15000 
      });
      console.log('✅ [CLIENT SEARCH] Client details page loaded in contactEdit_iframe');
    } catch (e) {
      console.log('⚠️ [CLIENT SEARCH] fullSummaryTable not immediately visible, but continuing...');
      // Fallback: wait for any form labels
      try {
        await clientDetailsIframe.locator('.jqx_formSummaryTextLeft').first().waitFor({ 
          state: 'visible', 
          timeout: 10000 
        });
        console.log('✅ [CLIENT SEARCH] Client details page detected via form labels');
      } catch (e2) {
        console.log('⚠️ [CLIENT SEARCH] Client details page may not be fully loaded');
      }
    }
    // ========== END FIX ==========
    
    // ========== DEBUGGING: Check iframe state immediately after click ==========
    console.log('🔍 [DEBUG] Checking iframe state immediately after clicking client row...');
    try {
      // Check contactEdit_iframe (the one with client details)
      const contactEditExists = await page.locator('#contactEdit_iframe').count();
      console.log(`🔍 [DEBUG] #contactEdit_iframe exists: ${contactEditExists > 0}`);
      
      if (contactEditExists > 0) {
        const frameElement = await page.$('#contactEdit_iframe');
        if (frameElement) {
          const actualFrame = await frameElement.contentFrame();
          if (actualFrame) {
            const iframeUrl = actualFrame.url();
            console.log(`🔍 [DEBUG] contactEdit_iframe URL after click: ${iframeUrl}`);
            
            // Quick check for key elements
            const hasFullSummary = await actualFrame.locator('#fullSummaryTable').count();
            const hasFormLabels = await actualFrame.locator('.jqx_formSummaryTextLeft').count();
            console.log(`🔍 [DEBUG] contactEdit_iframe check - #fullSummaryTable: ${hasFullSummary}, .jqx_formSummaryTextLeft: ${hasFormLabels}`);
            
            if (hasFormLabels > 0) {
              // Get first few label texts immediately
              const immediateLabels = [];
              for (let i = 0; i < Math.min(3, hasFormLabels); i++) {
                try {
                  const text = await actualFrame.locator('.jqx_formSummaryTextLeft').nth(i).textContent();
                  immediateLabels.push(text?.trim() || '');
                } catch (e) {
                  immediateLabels.push('(error)');
                }
              }
              console.log(`🔍 [DEBUG] Immediate label texts in contactEdit_iframe: ${immediateLabels.join(', ')}`);
            }
          } else {
            console.log('⚠️ [DEBUG] Could not get contentFrame from contactEdit_iframe');
          }
        } else {
          console.log('⚠️ [DEBUG] Could not find contactEdit_iframe element');
        }
      }
      
      // Also check contactLookup_iframe for comparison
      const contactLookupExists = await page.locator('#contactLookup_iframe').count();
      console.log(`🔍 [DEBUG] #contactLookup_iframe still exists: ${contactLookupExists > 0}`);
    } catch (e) {
      console.log(`⚠️ [DEBUG] Error checking iframe after click: ${e.message}`);
    }
    // ========== END DEBUGGING ==========
    
    // Wait briefly for page transition, then let extractClientDetails handle element waiting
    // The extractClientDetails function already has logic to wait and check for elements
    console.log('⏳ [CLIENT SEARCH] Waiting for client details page to load...');
    await page.waitForTimeout(2000); // Brief wait for page transition
    
    progressCallback?.({ message: 'Loading your profile.' });
    await takeScreenshot(page, 'client-selected.png', screenshotsDir);
    
    // Extract client details from the page
    // IMPORTANT: Use clientDetailsIframe (contactEdit_iframe) instead of iframe (contactLookup_iframe)
    const clientDetails = await extractClientDetails(clientDetailsIframe, page, screenshotsDir);
    
    if (!clientDetails) {
      return {
        found: false,
        requiresVerification: false,
        error: 'Could not extract client details from CRM page'
      };
    }
    
    // Verify extracted details match search criteria
    const verificationResult = await verifyClientMatch(clientDetails, finalSearchType, finalSearchValue, clientPostcode);
    
    if (!verificationResult.matches) {
      if (verificationResult.error) {
        return {
          found: false,
          requiresVerification: false,
          requiresPostcodeVerification: !verificationResult.postcodeMatches && verificationResult.emailMatches,
          error: verificationResult.error
        };
      }
      
      return {
        found: false,
        requiresVerification: false,
        error: 'Selected client does not match search criteria'
      };
    }
    
    // Store client details in conversation state
    if (conversation) {
      conversation.clientDetails = clientDetails;
    }
    
    // Get verification prompt
    const verificationPrompt = getVerificationPrompt();
    
    console.log('✅ [CLIENT SEARCH] Client found and details extracted - requires verification');
    
    return {
      found: true,
      clientDetails,
      requiresVerification: true,
      verificationPrompt
    };
    
  } catch (error) {
    console.error('❌ [CLIENT SEARCH] Client search failed:', error);
    await takeScreenshot(page, 'client-search-error.png', screenshotsDir);
    return {
      found: false,
      requiresVerification: false,
      error: error.message
    };
  }
}

