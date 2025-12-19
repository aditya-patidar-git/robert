import * as commonSteps from '../../commonBookingSteps/index.js';

/**
 * Step 4-5: Search for existing client (mobile first, then email fallback)
 * For existing client workflow only
 */
export async function step4_5FindClient(page, bookingArgs, callContext, screenshotsDir, screenshots) {
  console.log('👤 Step 4-5: Finding existing client...');
  
  // Check if client is already verified - skip search if so
  if (callContext.clientVerified && callContext.clientDetails) {
    console.log('✅ Step 4-5: Client already verified, skipping search and proceeding to booking');
    return { success: true, clientVerified: true };
  }
  
  // Check if we have customer info to search
  if (!bookingArgs.customerMobile && !bookingArgs.customerPhone && !bookingArgs.customerEmail) {
    // Return graceful error asking agent to collect customer info
    console.log('⚠️ Step 4-5: Customer info missing - asking agent to collect');
    return {
      success: false,
      requiresCustomerInfo: true,
      message: 'To search for your existing profile, I need either your mobile number or email address. Could you please provide one of these?',
      workflowType: 'existing'
    };
  }
  
  // Determine search type and value - mobile number takes priority
  let searchType = 'email';
  let searchValue = bookingArgs.customerEmail;
  
  if (bookingArgs.customerMobile || bookingArgs.customerPhone) {
    searchType = 'mobile';
    searchValue = bookingArgs.customerMobile || bookingArgs.customerPhone;
  } else if (bookingArgs.customerEmail) {
    searchType = 'email';
    searchValue = bookingArgs.customerEmail;
  }
  
  // Search for client - pass callSid for state tracking
  const callSid = callContext.callSid || 'unknown';
  const searchResult = await commonSteps.findAndVerifyClient(page, searchType, searchValue, screenshotsDir, bookingArgs.customerEmail, null, callSid);
  screenshots.push(await commonSteps.takeScreenshot(page, 'step-4-5-client-found.png', screenshotsDir));
  
  // Handle retry prompts for mobile search
  if (searchResult.retryPrompt) {
    return {
      success: false,
      requiresCustomerInfo: true,
      retryPrompt: searchResult.retryPrompt,
      message: searchResult.retryPrompt,
      workflowType: 'existing'
    };
  }
  
  if (!searchResult.found) {
    // If mobile search failed and we haven't tried email yet, try email
    if (searchType === 'mobile' && bookingArgs.customerEmail) {
      console.log('⚠️ Mobile search failed, trying email search...');
      const emailSearchResult = await commonSteps.findAndVerifyClient(page, 'email', bookingArgs.customerEmail, screenshotsDir, bookingArgs.customerEmail, null, callSid);
      if (emailSearchResult.found) {
        if (emailSearchResult.clientDetails) {
          callContext.clientDetails = emailSearchResult.clientDetails;
          bookingArgs.clientDetails = emailSearchResult.clientDetails;
        }
        console.log('✅ Step 4-5: Client found via email');
        
        // Return with verification prompt
        if (emailSearchResult.requiresVerification) {
          return {
            success: false,
            requiresVerification: true,
            verificationPrompt: emailSearchResult.verificationPrompt,
            clientDetails: emailSearchResult.clientDetails || callContext.clientDetails,
            message: emailSearchResult.verificationPrompt || 'Client found but requires verbal verification before proceeding with booking'
          };
        }
      } else {
        throw new Error('Could not find client with mobile number or email address');
      }
    } else {
      throw new Error(searchResult.error || 'Could not find client in CRM');
    }
  } else {
    if (searchResult.clientDetails) {
      callContext.clientDetails = searchResult.clientDetails;
      bookingArgs.clientDetails = searchResult.clientDetails;
    }
    console.log('✅ Step 4-5: Client found');
  }
  
  // IMPORTANT: Do not proceed to booking until verbal verification is complete
  // The agent must call the clientVerification tool first
  if (searchResult.requiresVerification || (searchResult.found && !callContext.clientVerified)) {
    return {
      success: false,
      requiresVerification: true,
      verificationPrompt: searchResult.verificationPrompt,
      clientDetails: searchResult.clientDetails || callContext.clientDetails,
      message: searchResult.verificationPrompt || 'Client found but requires verbal verification before proceeding with booking'
    };
  }
  
  return { success: true, clientFound: true };
}

