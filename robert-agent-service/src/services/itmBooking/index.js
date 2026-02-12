import fs from 'fs';
import { WorkflowOrchestrator } from './workflowOrchestrator.js';
import { ensureDirectories } from '../commonBookingSteps/utils.js';

/**
 * ITM Booking Service
 * Main service class for ITM (Introduction to Motorcycling) bookings
 * Maintains backward compatibility with original itmBookingService API
 */
class ITMBookingService {
  constructor() {
    this.crmCredentials = {
      loginUrl: 'https://takeabyte.co.uk/InContact/Account/Login',
      loginName: process.env.CRM_LOGIN || 'universalmct',
      username: process.env.CRM_USERNAME || 'auagent',
      password: process.env.CRM_PASSWORD,
      availabilityUrl: 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=C9170432CA66685F'
    };
    this.screenshotsDir = './screenshots/itm-booking';
    
    // Ensure directories exist
    ensureDirectories([this.screenshotsDir]);
    
    // Initialize workflow orchestrator
    this.workflowOrchestrator = new WorkflowOrchestrator(this.crmCredentials, this.screenshotsDir);
  }

  async executeBookingWorkflow(page, bookingArgs = {}, callContext = {}, cancelToken = null, executionKey = null, phaseUpdateCallback = null) {
    return await this.workflowOrchestrator.executeBookingWorkflow(
      page,
      bookingArgs,
      callContext,
      cancelToken,
      executionKey,
      phaseUpdateCallback
    );
  }

  // Keep executeITMBookingDemo for backward compatibility (if needed)
  async executeITMBookingDemo(page) {
    // This method is for testing/demo purposes
    // Uses test data from environment variables
    // Workflow is identical to production - only difference is data source (env vs voice)
    
    // Load test data from environment
    const testMobile = process.env.TEST_CLIENT_MOBILE;
    const testEmail = process.env.TEST_CLIENT_EMAIL || process.env.CLIENT_EMAIL_ADDRESS;
    const testFullName = process.env.TEST_CLIENT_FULL_NAME;
    const testPostcode = process.env.TEST_CLIENT_POSTCODE;
    const testTelephone = process.env.TEST_CLIENT_TELEPHONE;
    
    if (!testMobile && !testEmail) {
      throw new Error('TEST_CLIENT_MOBILE or TEST_CLIENT_EMAIL (or CLIENT_EMAIL_ADDRESS) environment variable must be set');
    }
    
    if (!testFullName || !testPostcode || !testTelephone) {
      throw new Error('TEST_CLIENT_FULL_NAME, TEST_CLIENT_POSTCODE, and TEST_CLIENT_TELEPHONE environment variables must be set for verification');
    }

    // Generate test callSid for state tracking
    const testCallSid = `test-${Date.now()}`;
    
    // Initialize conversation state (same as production)
    // Note: Test sessions (starting with 'test-') are excluded from automatic cleanup
    const { conversations } = await import('../../shared/state.js');
    const now = Date.now();
    conversations[testCallSid] = {
      transcript: [],
      language: 'en',
      startTime: now,
      lastActivityTime: now, // Set lastActivityTime to prevent immediate cleanup
      mobileSearchAttempts: {
        count: 0,
        lastAttempt: null,
        values: [],
        lastAttemptTime: null
      },
      verificationAttempts: {
        fullName: 0,
        postcode: 0,
        telephoneNumber: 0
      },
      clientDetails: null,
      clientVerified: false,
      clientVerifiedAt: null,
      verificationMethod: null,
      bookingConsent: {
        given: false,
        timestamp: null,
        dryRunDiff: null
      },
      policyCheck: {
        performed: false,
        timestamp: null,
        results: null
      }
    };

    // Create callContext with callSid for state tracking
    const callContext = {
      callSid: testCallSid
    };

    // Prepare booking arguments with test data
    const bookingArgs = {
      workflowType: 'existing',
      customerMobile: testMobile,
      customerEmail: testEmail,
      preferredDate: process.env.TEST_PREFERRED_DATE || '2026-03-29',
      preferredTime: process.env.TEST_PREFERRED_TIME || '17:00',
      location: process.env.TEST_LOCATION || 'Croydon, South London, CR0',
      // ITM-specific preferences
      bikeType: process.env.TEST_BIKE_TYPE || null,
      // Terms acceptance (convert string to boolean)
      termsAccepted: process.env.TEST_TERMS_ACCEPTED === 'true' || process.env.TEST_TERMS_ACCEPTED === '1' || false
    };

    console.log(`🧪 [TEST] Starting ITM booking demo with callSid: ${testCallSid}`);
    console.log(`🧪 [TEST] Using mobile: ${testMobile}, email: ${testEmail}`);

    let workflowResult;
    let maxIterations = 10; // Safety limit to prevent infinite loops
    let iteration = 0;

    // Execute workflow and handle all return states (same as agent would)
    while (iteration < maxIterations) {
      iteration++;
      console.log(`🧪 [TEST] Workflow iteration ${iteration}...`);

      // Call the booking workflow
      workflowResult = await this.executeBookingWorkflow(page, bookingArgs, callContext);

      // Handle retry prompt (mobile search failed)
      if (workflowResult.retryPrompt) {
        console.log(`🧪 [TEST] Received retry prompt: ${workflowResult.retryPrompt}`);
        const conversation = conversations[testCallSid];
        if (!conversation) {
          throw new Error(`Session ${testCallSid} was cleaned up during workflow`);
        }
        const attemptCount = conversation.mobileSearchAttempts?.count || 0;
        
        if (attemptCount >= 3) {
          // After 3 mobile attempts, switch to email search
          console.log(`🧪 [TEST] Mobile search exhausted after ${attemptCount} attempts, switching to email search`);
          bookingArgs.customerMobile = null; // Remove mobile to force email search
          continue; // Retry with email
        } else {
          // Simulate agent retrying with same mobile (for testing retry logic)
          // In real scenario, agent would ask user for mobile again
          console.log(`🧪 [TEST] Simulating mobile retry attempt ${attemptCount + 1}`);
          continue; // Retry with same mobile to test retry tracking
        }
      }

      // Handle verification requirement
      if (workflowResult.requiresVerification) {
        console.log(`🧪 [TEST] Client found, verification required`);
        console.log(`🧪 [TEST] Verification prompt: ${workflowResult.verificationPrompt}`);
        
        // Simulate agent calling client_verification tool with env data
        const clientVerificationTool = (await import('../../tools/clientVerification.js')).default;
        const verificationResult = await clientVerificationTool.execute({
          fullName: testFullName,
          postcode: testPostcode,
          telephoneNumber: testTelephone
        }, callContext);

        if (verificationResult.verified) {
          console.log(`✅ [TEST] Client verification successful`);
          // Mark as verified in callContext so workflow continues
          callContext.clientVerified = true;
          const conversation = conversations[testCallSid];
          if (conversation) {
            conversation.clientVerified = true;
          }
          // Continue workflow
          continue;
        } else {
          throw new Error(`Client verification failed: ${verificationResult.message || 'Unknown error'}`);
        }
      }

      // Handle customer info requirement
      if (workflowResult.requiresCustomerInfo) {
        console.log(`🧪 [TEST] Customer info required: ${workflowResult.message}`);
        // This shouldn't happen in test mode as we provide all data upfront
        throw new Error(`Customer info required but should be provided from env: ${workflowResult.message}`);
      }

      // Handle preferences requirement
      if (workflowResult.requiresPreferences) {
        console.log(`🧪 [TEST] Booking preferences required: ${workflowResult.message}`);
        console.log(`🧪 [TEST] Missing preferences: ${JSON.stringify(workflowResult.missingPreferences || [])}`);
        console.log(`🧪 [TEST] Valid options: ${JSON.stringify(workflowResult.validOptions || {})}`);
        
        // Read missing preferences from env and add to bookingArgs
        const missingPrefs = workflowResult.missingPreferences || [];
        const validOptions = workflowResult.validOptions || {};
        
        for (const pref of missingPrefs) {
          const envVarName = `TEST_${pref.toUpperCase()}`;
          const envValue = process.env[envVarName];
          
          if (envValue) {
            console.log(`🧪 [TEST] Found ${pref} in env: ${envValue}`);
            bookingArgs[pref] = envValue;
          } else {
            // Try to get default from validOptions
            let defaultValue = null;
            
            // Check if validOptions is an object with the preference as a key
            if (validOptions[pref] && Array.isArray(validOptions[pref]) && validOptions[pref].length > 0) {
              defaultValue = validOptions[pref][0]; // Use first valid option as default
            } 
            // Check if validOptions is directly an array (for single preference)
            else if (Array.isArray(validOptions) && validOptions.length > 0) {
              defaultValue = validOptions[0];
            }
            
            if (defaultValue) {
              console.log(`🧪 [TEST] Using default ${pref}: ${defaultValue} (from valid options)`);
              bookingArgs[pref] = defaultValue;
            } else {
              const optionsDisplay = validOptions[pref] ? JSON.stringify(validOptions[pref]) : JSON.stringify(validOptions);
              throw new Error(`Missing required preference "${pref}" - please set ${envVarName} in .env file. Valid options: ${optionsDisplay}`);
            }
          }
        }
        
        // Retry workflow with updated preferences
        console.log(`🧪 [TEST] Retrying workflow with updated preferences...`);
        continue;
      }

      // If workflow completed successfully or failed, break
      if (workflowResult.success !== undefined) {
        break;
      }

      // If we get here without a clear result, something unexpected happened
      console.warn(`⚠️ [TEST] Unexpected workflow result state, breaking loop`);
      break;
    }

    if (iteration >= maxIterations) {
      throw new Error('Workflow exceeded maximum iterations - possible infinite loop');
    }

    // Get final conversation state for reporting
    const conversation = conversations[testCallSid];
    if (!conversation) {
      console.warn(`⚠️ [TEST] Session ${testCallSid} was cleaned up before completion`);
      // Return default state if session was cleaned up
      return {
        success: workflowResult.success !== false,
        sessionDetails: workflowResult.sessionDetails,
        screenshots: workflowResult.screenshots || [],
        clientEmail: workflowResult.clientEmail || testEmail,
        testState: {
          mobileSearchAttempts: { count: 0 },
          verificationAttempts: { fullName: 0, postcode: 0, telephoneNumber: 0 },
          clientVerified: false,
          policyCheck: { performed: false }
        },
        workflowSteps: {
          mobileSearchAttempts: 0,
          verificationCompleted: false,
          policyCheckPerformed: false,
          confirmationEmailSent: workflowResult.confirmationEmailSent || false
        }
      };
    }
    
    const finalState = {
      mobileSearchAttempts: conversation.mobileSearchAttempts || { count: 0 },
      verificationAttempts: conversation.verificationAttempts || { fullName: 0, postcode: 0, telephoneNumber: 0 },
      clientVerified: conversation.clientVerified || false,
      policyCheck: conversation.policyCheck || { performed: false }
    };

    console.log(`✅ [TEST] ITM booking demo completed`);
    console.log(`🧪 [TEST] Final state:`, JSON.stringify(finalState, null, 2));

    // Clean up test conversation state (optional - keep for debugging)
    // delete conversations[testCallSid];

    return {
      success: workflowResult.success,
      sessionDetails: workflowResult.sessionDetails,
      screenshots: workflowResult.screenshots || [],
      clientEmail: workflowResult.clientEmail || testEmail,
      testState: finalState,
      workflowSteps: {
        mobileSearchAttempts: finalState.mobileSearchAttempts?.count || 0,
        verificationCompleted: finalState.clientVerified || false,
        policyCheckPerformed: finalState.policyCheck?.performed || false,
        confirmationEmailSent: workflowResult.confirmationEmailSent || false
      }
    };
  }
}

// Export singleton instance (maintains backward compatibility)
export default new ITMBookingService();

