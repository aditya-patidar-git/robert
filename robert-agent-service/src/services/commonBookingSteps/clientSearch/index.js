import { takeScreenshot } from '../utils.js';
import { selectSmartSearch, executeSearch, findMatchingClientRow, clickClientRow } from './searchClient.js';
import { extractClientDetails } from './extractClientDetails.js';
import { verifyClientMatch } from './verifyClientMatch.js';
import { getVerificationPrompt } from '../../verificationService.js';
import { conversations } from '../../../shared/state.js';
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
 * @param {string} searchType - 'mobile' or 'email' - type of search to perform
 * @param {string} searchValue - Mobile number or email address to search for
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {string} [email] - Optional email address to use when Smart search is selected
 * @param {string} [clientPostcode] - Optional postcode for verification when multiple results appear
 * @param {string} [callSid] - Call SID for conversation state tracking
 * @returns {Promise<{found: boolean, clientDetails?: object, requiresVerification: boolean, verificationPrompt?: string, retryPrompt?: string, requiresPostcodeVerification?: boolean, error?: string}>}
 */
export async function findAndVerifyClient(page, searchType, searchValue, screenshotsDir, email = null, clientPostcode = null, callSid = null) {
  try {
    // Get conversation state for tracking
    const conversation = callSid ? conversations[callSid] : null;
    
    // Handle mobile search retry logic
    if (searchType === 'mobile') {
      // Validate UK mobile format
      if (!validateUKMobile(searchValue)) {
        return {
          found: false,
          requiresVerification: false,
          error: 'Invalid UK mobile number format. Please provide an 11-digit number starting with 07.'
        };
      }
      
      // Normalize mobile number
      const normalizedMobile = normalizeUKMobile(searchValue);
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
        
        // Check if mobile search is exhausted (3 attempts)
        if (isMobileSearchExhausted(conversation)) {
          return {
            found: false,
            requiresVerification: false,
            retryPrompt: getMobileSearchRetryPrompt(3), // Ask for email
            error: 'Mobile search exhausted after 3 attempts'
          };
        }
        
        // If not first attempt, return retry prompt
        if (attemptCount > 1) {
          return {
            found: false,
            requiresVerification: false,
            retryPrompt: getMobileSearchRetryPrompt(attemptCount),
            error: `Mobile search attempt ${attemptCount} failed`
          };
        }
      }
    }
    
    console.log('👤 [CLIENT SEARCH] Navigating to Contacts tab...');
    
    // Click CONTACTS tab
    const contactsTab = page.locator('h3.list-menu-item-heading:has-text("Contacts")');
    await contactsTab.click();
    
    // Wait for page to fully load
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
    await selectSmartSearch(iframe, page, screenshotsDir);
    
    // Determine final search value (Smart search always uses email)
    let finalSearchValue = searchValue;
    let finalSearchType = searchType;
    
    if (email) {
      finalSearchValue = email;
      finalSearchType = 'email';
      console.log(`🔍 [CLIENT SEARCH] Smart search selected - using email: ${email}`);
    } else if (searchType === 'mobile') {
      console.warn(`⚠️ [CLIENT SEARCH] Smart search selected but no email provided - using mobile number (this may not work correctly)`);
    }
    
    // Execute search
    await executeSearch(iframe, page, finalSearchValue, screenshotsDir);
    
    // Find matching client row
    const matchResult = await findMatchingClientRow(iframe, finalSearchType, finalSearchValue, email);
    
    if (!matchResult) {
      // No match found
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

