import * as stepHandlers from './steps/index.js';
import { formatUserFriendlyError, getErrorContext } from '../../utils/errorFormatter.js';
import * as commonSteps from '../commonBookingSteps/index.js';
import { trackCRMBooking, buildBookingData } from '../bookingTrackingClient.js';

/**
 * Workflow orchestrator for ITM booking
 * Coordinates all step handlers and manages workflow state
 */
export class WorkflowOrchestrator {
  constructor(crmCredentials, screenshotsDir) {
    this.crmCredentials = crmCredentials;
    this.screenshotsDir = screenshotsDir;
  }

  async executeBookingWorkflow(page, bookingArgs = {}, callContext = {}, cancelToken = null, executionKey = null, phaseUpdateCallback = null) {
    const screenshots = [];
    let sessionDetails = null;
    
    // Initialize confirmation email sent flag (used in both workflows)
    let confirmationEmailSent = false;
    // Initialize payment completed flag - only set to true after payment is processed
    let paymentCompleted = false;

    // Helper to check for cancellation and throw if cancelled
    const checkCancellation = () => {
      if (cancelToken && cancelToken.cancelled) {
        const reason = cancelToken.reason || 'Execution cancelled';
        console.log(`🛑 [ITM] Workflow cancelled: ${reason}`);
        throw new Error(`Workflow cancelled: ${reason}`);
      }
    };

    // Helper to update phase
    const updatePhase = (phase) => {
      if (phaseUpdateCallback) {
        phaseUpdateCallback(phase);
      }
    };

    try {
      console.log(`🚀 Starting ITM booking workflow...`);
      
      // CRITICAL: Check if we're resuming from a specific step (e.g., Step 7 after requiresPreferences)
      // This allows continuation calls to skip to the correct step instead of starting from Step 1
      const resumeFromStep = bookingArgs.resumeFromStep || callContext.resumeFromStep;
      const resumeContext = bookingArgs.resumeContext || callContext.resumeContext;
      let shouldResumeFromStep7 = false;
      
      if (resumeFromStep === 7 && resumeContext) {
        console.log(`🔄 RESUMING from Step 7 (selectBookingOptions) - will skip Steps 1-6`);
        console.log(`🔄 Resume context:`, resumeContext);
        
        // Validate that required preferences are now provided
        const requiredPreferences = resumeContext.requiredPreferences || ['bikeType'];
        const missingPreferences = requiredPreferences.filter(pref => {
          if (pref === 'bikeType') return !bookingArgs.bikeType;
          return false; // Add other preference types here if needed
        });
        
        if (missingPreferences.length > 0) {
          console.log(`⚠️ Resuming from Step 7 but preferences still missing: ${missingPreferences.join(', ')}`);
          return {
            success: false,
            requiresPreferences: true,
            missingPreferences: missingPreferences,
            message: `I still need your ${missingPreferences.join(' and ')} preference${missingPreferences.length > 1 ? 's' : ''} to continue.`,
            validOptions: { bikeType: ['125cc automatic', '50cc automatic', '125cc manual'] },
            sessionDetails: bookingArgs.sessionDetails || bookingArgs.agreedSlot || bookingArgs.selectedSlot,
            screenshots: [],
            resumeFromStep: 7,
            resumeContext: resumeContext
          };
        }
        
        // Ensure sessionDetails exists (needed for later steps)
        if (!sessionDetails) {
          sessionDetails = bookingArgs.sessionDetails || bookingArgs.agreedSlot || bookingArgs.selectedSlot;
          if (!sessionDetails) {
            throw new Error('Cannot resume from Step 7: sessionDetails not available');
          }
        }
        
        // Mark that we should skip to Step 7
        shouldResumeFromStep7 = true;
        console.log(`✅ All required preferences provided (bikeType: "${bookingArgs.bikeType}"), will resume at Step 7`);
      }
      
      // Only execute Steps 1-6 if NOT resuming from Step 7
      if (!shouldResumeFromStep7) {
        // STEP 1: Check availability and agree on slot with caller
        console.log('📅 Step 1: Checking availability for ITM sessions...');
        updatePhase('step1_availability');
        checkCancellation();
        
        const step1Result = await stepHandlers.step1Availability(page, bookingArgs, this.screenshotsDir, screenshots);
        
        if (step1Result.requiresSlotSelection) {
          return {
            success: false,
            requiresSlotSelection: true,
            message: step1Result.message,
            allSlots: step1Result.allSlots,
            monthYear: step1Result.monthYear,
            suggestedSlot: step1Result.suggestedSlot,
            screenshots: screenshots
          };
        }
        
        sessionDetails = step1Result.sessionDetails;
        
        // STEP 2: Login to CRM
        updatePhase('step2_login');
        checkCancellation();
        await stepHandlers.step2Login(page, this.crmCredentials, this.screenshotsDir, screenshots);
        
        // STEP 3: Validate workflowType is set
        updatePhase('step3_workflow_type');
        checkCancellation();
        const step3Result = stepHandlers.step3WorkflowType(bookingArgs, sessionDetails, screenshots);
        
        if (!step3Result.success) {
          return step3Result;
        }
        
        const workflowType = step3Result.workflowType;

        if (workflowType === 'existing') {
          // EXISTING CLIENT WORKFLOW
          // STEP 4-5: Search for existing client
          updatePhase('step4_5_find_client');
          checkCancellation();
          const step4_5Result = await stepHandlers.step4_5FindClient(page, bookingArgs, callContext, this.screenshotsDir, screenshots);
          
          if (!step4_5Result.success) {
            return step4_5Result;
          }
          
          // STEP 6: Navigate to Diaries and select session
          updatePhase('step6_select_session');
          checkCancellation();
          await stepHandlers.step6SelectSession(page, sessionDetails, this.screenshotsDir, screenshots);

          // STEP 7: Select booking options (for EXISTING CLIENT workflow)
          updatePhase('step7_booking_options');
          checkCancellation();
          const step7Result = await stepHandlers.step7BookingOptions(page, bookingArgs, sessionDetails, this.screenshotsDir, screenshots, 'existing');
          
          if (!step7Result.success) {
            return step7Result;
          }

          // STEP 8: Lookup contact (for EXISTING CLIENT workflow)
          updatePhase('step7_5_lookup_contact');
          checkCancellation();
          await stepHandlers.step7_5LookupContact(page, bookingArgs, callContext, this.screenshotsDir, screenshots);

          // STEP 8: Contact details - fill MISSING fields only
          updatePhase('step8_contact_details');
          checkCancellation();
          await stepHandlers.step8ContactDetails(page, bookingArgs, callContext, this.screenshotsDir, screenshots, 'existing');

          // STEP 9: Payment
          updatePhase('step9_payment');
          checkCancellation();
          const step9Result = await stepHandlers.step9Payment(page, bookingArgs, this.screenshotsDir, screenshots);
          paymentCompleted = step9Result.paymentCompleted || false;
        } else {
          // NEW CLIENT WORKFLOW
          // STEP 4: Navigate to Diaries and select session
          updatePhase('step4_select_session');
          checkCancellation();
          await stepHandlers.step4SelectSession(page, sessionDetails, this.screenshotsDir, screenshots);

          // STEP 5: Select booking options (for NEW CLIENT workflow only)
          updatePhase('step5_booking_options');
          checkCancellation();
          const step5Result = await stepHandlers.step5BookingOptions(page, bookingArgs, sessionDetails, this.screenshotsDir, screenshots);
          
          if (!step5Result.success) {
            return step5Result;
          }

          // STEP 6: Click "New contact" button
          updatePhase('step6_new_contact');
          checkCancellation();
          await stepHandlers.step6NewContact(page, this.screenshotsDir, screenshots);

          // STEP 7: Fill ALL contact details from scratch
          updatePhase('step7_fill_contact_details');
          checkCancellation();
          await stepHandlers.step8ContactDetails(page, bookingArgs, callContext, this.screenshotsDir, screenshots, 'new');

          // STEP 8: Payment
          updatePhase('step8_payment');
          checkCancellation();
          const step8Result = await stepHandlers.step9Payment(page, bookingArgs, this.screenshotsDir, screenshots);
          paymentCompleted = step8Result.paymentCompleted || false;
        }
      } else {
        // CRITICAL: If resuming from Step 7, skip all workflow branching and go directly to Step 7
        console.log('⏭️ Steps 2-6: Skipped (resuming from Step 7 - booking form should already be open)');
        // Ensure we're on the booking form page - wait a moment for page stability
        await page.waitForTimeout(3000);
        // Try to detect if booking form is already open
        const bookingFormExists = await page.locator('#eventNewBooking2_iframe, #priceDetailsContainer, .jqx_form').count() > 0;
        if (bookingFormExists) {
          console.log('✅ Booking form detected - ready to proceed with Step 7');
        } else {
          console.log('⚠️ Booking form not detected - may need to navigate to it');
        }
        console.log('🔄 Resuming directly to Step 7 (selectBookingOptions) - skipping all workflow type branching');
        
        // STEP 7: Select booking options (RESUME FLOW)
        updatePhase('step7_booking_options');
        checkCancellation();
        const step7ResumeResult = await stepHandlers.step7BookingOptions(page, bookingArgs, sessionDetails, this.screenshotsDir, screenshots, resumeContext.workflowType || 'existing');
        
        if (!step7ResumeResult.success) {
          return step7ResumeResult;
        }
        
        // Continue with Steps 8-9 for resume flow (same as existing client workflow)
        // STEP 8: Contact details - fill MISSING fields only
        updatePhase('step8_contact_details');
        checkCancellation();
        await stepHandlers.step8ContactDetails(page, bookingArgs, callContext, this.screenshotsDir, screenshots, resumeContext.workflowType || 'existing');

        // STEP 9: Payment
        updatePhase('step9_payment');
        checkCancellation();
        const step9ResumeResult = await stepHandlers.step9Payment(page, bookingArgs, this.screenshotsDir, screenshots);
        paymentCompleted = step9ResumeResult.paymentCompleted || false;
      }

      console.log('🎉 Service: All steps completed successfully!');
      
      // Track the booking in the backend database
      try {
        const workflowType = bookingArgs.workflowType || 
                            (bookingArgs.existingClient ? 'existing' : 'new');
        
        const bookingData = buildBookingData({
          bookingArgs,
          callContext,
          sessionDetails,
          paymentCompleted,
          workflowType,
          serviceType: 'ITM'
        });
        
        const trackingResult = await trackCRMBooking(bookingData);
        if (trackingResult.success) {
          console.log(`✅ [ITM] Booking tracked in database: ${trackingResult.bookingId}`);
        } else {
          console.warn(`⚠️ [ITM] Booking tracking failed (non-critical): ${trackingResult.error}`);
        }
      } catch (trackingError) {
        // Don't fail the workflow if tracking fails
        console.warn(`⚠️ [ITM] Booking tracking error (non-critical):`, trackingError.message);
      }
      
      return {
        success: true,
        sessionDetails,
        screenshots,
        clientEmail: bookingArgs.customerEmail,
        confirmationEmailSent: confirmationEmailSent || false,
        paymentCompleted: paymentCompleted || false // CRITICAL: Only set after payment is processed
      };

    } catch (error) {
      // Check if this is a cancellation (should be handled gracefully, not as an error)
      if (error.message && error.message.includes('Workflow cancelled')) {
        console.log(`🛑 [ITM] Workflow was cancelled: ${error.message}`);
        // Return a cancellation response instead of an error
        return {
          success: false,
          cancelled: true,
          message: 'Booking workflow was cancelled and replaced by a new request with complete information.',
          sessionDetails: sessionDetails,
          screenshots: screenshots
        };
      }
      
      console.error('❌ ITM booking demo failed at step:', error.message);
      console.error('❌ Service: Error stack:', error.stack);
      screenshots.push(await commonSteps.takeScreenshot(page, 'error-state.png', this.screenshotsDir));
      
      // Return error gracefully with user-friendly message
      const clientEmail = bookingArgs?.customerEmail;
      const errorContext = getErrorContext(error, 'create_booking');
      const userFriendlyError = formatUserFriendlyError(error, errorContext);
      
      return {
        success: false,
        error: userFriendlyError,
        technicalError: error.message, // Keep technical error for logging
        sessionDetails: sessionDetails,
        screenshots: screenshots,
        clientEmail: clientEmail
      };
    }
  }
}

