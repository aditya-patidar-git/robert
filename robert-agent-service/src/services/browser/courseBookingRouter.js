import fs from 'fs';
import { formatUserFriendlyError, getErrorContext } from '../../utils/errorFormatter.js';
import { takeScreenshot } from '../commonBookingSteps/utils.js';

/**
 * Course booking router
 * Routes booking requests to course-specific services
 */
export class CourseBookingRouter {
  constructor(browserManager, updateExecutionPhase, activeExecutions) {
    this.browserManager = browserManager;
    this.updateExecutionPhase = updateExecutionPhase;
    this.activeExecutions = activeExecutions;
  }

  async executeCourseBooking(page, args, callContext, auditId, progressCallback = null, cancelToken = null, executionKey = null) {
    try {
      // Map course type to service module
      const courseServiceMap = {
        'ITM': () => import('../itmBooking/index.js'),
        'Introduction to Motorcycling': () => import('../itmBooking/index.js'),
        'CBT': () => import('../cbtBookingService.js'),
        'Compulsory Basic Training': () => import('../cbtBookingService.js'),
        'CBT Executive': () => import('../cbtExecutiveBookingService.js'),
        'CBT Executive 1-2-1': () => import('../cbtExecutiveBookingService.js'),
        'Private Lesson': () => import('../privateLessonBookingService.js'),
        'Gear Conversion': () => import('../gearConversionBookingService.js'),
        'TfL 1-2-1': () => import('../tflOneToOneBookingService.js'),
        'TfL 1-2-1 Motorcycle Skills': () => import('../tflOneToOneBookingService.js'),
        'TfL Beyond CBT': () => import('../tflBeyondCbtBookingService.js'),
        'TfL - Beyond CBT - Skills for Delivery Riders': () => import('../tflBeyondCbtBookingService.js'),
        'Full Licence Assessment': () => import('../fullLicenceAssessmentBookingService.js'),
        'Full Motorcycle Licence Assessment': () => import('../fullLicenceAssessmentBookingService.js')
      };

      const courseType = args.courseType;
      const serviceLoader = courseServiceMap[courseType];

      if (!serviceLoader) {
        return {
          success: false,
          error: `I'm sorry, but "${courseType}" is not a recognized course type. Please specify a valid course type.`,
          dryRun: true,
          requiresConfirmation: false,
          auditId,
          screenshots: [],
          courseType: args.courseType
        };
      }

      console.log(`📚 Loading booking service for course type: ${courseType}`);
      
      // CRITICAL: Reuse authenticated page OR create new page from context
      // Both will have session cookies because cookies are stored in browser context
      const authenticatedPage = this.browserManager.getAuthenticatedPage();
      if (authenticatedPage && !authenticatedPage.isClosed()) {
        console.log('✅ Reusing authenticated page for booking (cookies persist in context)');
        page = authenticatedPage;
        
        // Navigate if needed - cookies in context will persist
        const currentUrl = page.url();
        if (!currentUrl.includes('takeabyte.co.uk/InContact')) {
          await page.goto('https://takeabyte.co.uk/InContact', { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
          });
          await page.waitForTimeout(2000);
          
          // Check if redirected to login (session expired indicator)
          const newUrl = page.url();
          if (newUrl.includes('/Account/Login')) {
            console.warn('⚠️ Session expired - redirected to login, will re-login');
            await page.close();
            this.browserManager.clearAuthenticatedPage();
            this.browserManager.clearBrowserContext();
            // Re-get context (will trigger re-login)
            const context = await this.browserManager.getContext();
            page = await context.newPage();
            await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'domcontentloaded' });
          }
        }
      } else {
        // Create new page from context - it automatically inherits cookies from context
        console.log('📄 Creating new page from authenticated context (cookies inherited)');
        await page.goto('https://takeabyte.co.uk/InContact', { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        await page.waitForTimeout(2000);
        
        // Check if redirected to login (session expired indicator)
        const currentUrl = page.url();
        if (currentUrl.includes('/Account/Login')) {
          console.warn('⚠️ Session expired - new page redirected to login, will re-login');
          await page.close();
          this.browserManager.clearBrowserContext();
          this.browserManager.clearAuthenticatedPage();
          // Re-get context (will trigger re-login)
          const context = await this.browserManager.getContext();
          page = await context.newPage();
          await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'domcontentloaded' });
        } else {
          // Session is valid - store as authenticated page for future reuse
          if (!this.browserManager.getAuthenticatedPage()) {
            this.browserManager.setAuthenticatedPage(page);
          }
        }
      }
      
      // Trust that cookies in context work - no need to verify login status
      // Session expiration is detected by login redirect above
      
      // Define login indicators for checking authentication status
      const loginIndicators = [
        'text=/Dashboard|Contacts|Diaries/i',
        'h3.list-menu-item-heading:has-text("Contacts")',
        'h3.list-menu-item-heading:has-text("Dashboard")'
      ];
      
      let isAlreadyLoggedIn = false;
      
      for (const selector of loginIndicators) {
        try {
          isAlreadyLoggedIn = await page.locator(selector).first().isVisible({ timeout: 5000 }).catch(() => false);
          if (isAlreadyLoggedIn) {
            console.log(`✅ Found login indicator: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue to next indicator
        }
      }
      
      if (!isAlreadyLoggedIn) {
        // This should not happen if getContext() worked correctly
        console.warn('⚠️ Page appears not logged in, but context should be authenticated. Reloading page and waiting longer...');
        
        // Reload the page to ensure cookies are loaded
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
        
        // Check again with longer timeout
        for (const selector of loginIndicators) {
          try {
            isAlreadyLoggedIn = await page.locator(selector).first().isVisible({ timeout: 10000 }).catch(() => false);
            if (isAlreadyLoggedIn) {
              console.log(`✅ Found login indicator after reload: ${selector}`);
              break;
            }
          } catch (e) {
            // Continue to next indicator
          }
        }
        
        if (!isAlreadyLoggedIn) {
          // Last resort: check if we're redirected to login page
          const isOnLoginPage = await page.locator('#Loginname').isVisible({ timeout: 3000 }).catch(() => false);
          if (isOnLoginPage) {
            throw new Error('Context should be authenticated but page redirected to login. This indicates the session expired or cookies were not saved properly.');
          }
          throw new Error('Context should be authenticated but page is not logged in. This indicates an issue with getContext().');
        }
      } else {
        console.log('✅ Page confirmed logged in via authenticated context');
      }
      
      // Load course-specific service
      const serviceModule = await serviceLoader();
      const bookingService = serviceModule.default;

      // Determine workflowType intelligently
      let workflowType = args.workflowType;
      if (!workflowType) {
        // For ITM, don't auto-determine - let the booking service handle it after availability check
        // According to documentation: Step 1 (availability) comes before Step 3 (workflowType)
        if (courseType === 'ITM' || courseType === 'Introduction to Motorcycling') {
          // Don't set workflowType - let ITM booking service handle it in Step 3 after Step 1
          workflowType = undefined;
          console.log('📋 WorkflowType will be determined by ITM booking service after availability check (Step 1 → Step 3)');
        } else {
          // For other courses, auto-determine as before
          if (args.customerMobile || args.customerPhone || args.customerEmail) {
            workflowType = 'existing';
            console.log('📋 WorkflowType determined: existing (customer info available)');
          } else {
            workflowType = 'new';
            console.log('📋 WorkflowType determined: new (no customer info available)');
          }
        }
      } else {
        console.log(`📋 WorkflowType explicitly set: ${workflowType}`);
      }

      // CRITICAL: Check if we're resuming from a previous requiresPreferences response
      // If the previous call returned requiresPreferences with resumeFromStep, preserve it
      const { conversations } = await import('../../shared/state.js');
      const conversation = conversations[callContext.callSid] || {};
      const previousResult = conversation.lastBookingResult || {};
      const resumeFromStep = previousResult.resumeFromStep;
      const resumeContext = previousResult.resumeContext;
      
      // Log resume detection for debugging
      if (resumeFromStep && resumeContext) {
        console.log(`🔄 [${auditId}] Detected resume from Step ${resumeFromStep} - will skip Steps 1-6`);
        console.log(`🔄 [${auditId}] Resume context:`, resumeContext);
      }
      
      // Prepare booking arguments
      const bookingArgs = {
        customerEmail: args.customerEmail,
        customerPhone: args.customerPhone,
        customerMobile: args.customerMobile || args.customerPhone, // Support both field names
        preferredDate: args.preferredDate,
        preferredTime: args.preferredTime,
        location: args.location,
        instructor: args.instructor, // Add instructor preference
        bikeType: args.bikeType,
        cbtType: args.cbtType, // For CBT: 'standard' or 'renewal'
        duration: args.duration, // For Gear Conversion: '2', '3', or '4'
        workflowType: workflowType,
        // CRITICAL: Include agreedSlot and selectedSlot if provided
        // This allows the booking service to skip availability check when slot is already agreed
        agreedSlot: args.agreedSlot,
        selectedSlot: args.selectedSlot,
        // CRITICAL: Include resume information if we're continuing from requiresPreferences
        resumeFromStep: resumeFromStep,
        resumeContext: resumeContext
      };
      
      // Retrieve availability data from conversation if available
      // Check if we have availability data and need to re-match with preferences
      if (conversation.lastAvailabilityCheck) {
        const availabilityData = conversation.lastAvailabilityCheck;
        
        // Handle new format (with allSlots and selectedSlot)
        if (availabilityData.allSlots && availabilityData.selectedSlot) {
          // Re-match with current preferences if they differ from what was used before
          const commonSteps = await import('../commonBookingSteps/index.js');
          const preferences = {
            preferredDate: args.preferredDate,
            preferredTime: args.preferredTime,
            location: args.location
          };
          
          // Check if preferences have changed
          const hasPreferences = preferences.preferredDate || preferences.preferredTime || preferences.location;
          if (hasPreferences) {
            // Re-select best matching slot with current preferences
            const selectedSlot = commonSteps.selectBestMatchingSlot(availabilityData.allSlots, preferences);
            bookingArgs.sessionDetails = selectedSlot;
            console.log('📅 Re-matched availability with current preferences');
          } else {
            // Use previously selected slot
            bookingArgs.sessionDetails = availabilityData.selectedSlot;
            console.log('📅 Using previously selected slot from availability check');
          }
        } else {
          // Handle old format (single sessionDetails object) - backward compatibility
          bookingArgs.sessionDetails = availabilityData.sessionDetails || availabilityData;
          console.log('📅 Using availability data from previous check (conversation state - old format)');
        }
      } else {
        // FALLBACK: Try to load from file cache (for development/debugging)
        const availabilityCachePath = './availability-cache.json';
        if (fs.existsSync(availabilityCachePath)) {
          try {
            const cacheData = JSON.parse(fs.readFileSync(availabilityCachePath, 'utf8'));
            // Check if cache is recent (within last 1 hour) and matches course type
            const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime();
            const oneHour = 60 * 60 * 1000;
            
            if (cacheAge < oneHour && (cacheData.sessionDetails || cacheData.selectedSlot)) {
              // Optionally check if course type matches (for multi-course scenarios)
              if (!cacheData.courseType || cacheData.courseType === args.courseType || 
                  args.courseType === 'Introduction to Motorcycling' && cacheData.courseType === 'ITM') {
                
                // Handle new format with preference matching
                if (cacheData.allSlots && cacheData.selectedSlot) {
                  const commonSteps = await import('../commonBookingSteps/index.js');
                  const preferences = {
                    preferredDate: args.preferredDate,
                    preferredTime: args.preferredTime,
                    location: args.location
                  };
                  
                  const hasPreferences = preferences.preferredDate || preferences.preferredTime || preferences.location;
                  if (hasPreferences) {
                    bookingArgs.sessionDetails = commonSteps.selectBestMatchingSlot(cacheData.allSlots, preferences);
                    console.log(`📅 Re-matched cached availability with preferences (${Math.round(cacheAge / 1000 / 60)} minutes old)`);
                  } else {
                    bookingArgs.sessionDetails = cacheData.selectedSlot;
                    console.log(`📅 Using cached selected slot (${Math.round(cacheAge / 1000 / 60)} minutes old)`);
                  }
                } else {
                  // Old format
                  bookingArgs.sessionDetails = cacheData.sessionDetails;
                  console.log(`📅 Using availability data from file cache (${Math.round(cacheAge / 1000 / 60)} minutes old)`);
                }
                
                console.log(`📅 Cache course type: ${cacheData.courseType}, Requested: ${args.courseType}`);
              } else {
                console.warn(`⚠️ [${auditId}] Cache exists but course type mismatch: cache=${cacheData.courseType}, requested=${args.courseType}`);
              }
            } else {
              console.warn(`⚠️ [${auditId}] Cache exists but is too old (${Math.round(cacheAge / 1000 / 60)} minutes)`);
            }
          } catch (error) {
            console.warn(`⚠️ [${auditId}] Could not read availability cache:`, error.message);
          }
        }
        
        if (!bookingArgs.sessionDetails) {
          console.warn(`⚠️ [${auditId}] No availability data found in conversation state or file cache`);
        }
      }
      
      // Ensure callContext has clientDetails if available from previous search
      if (args.clientDetails) {
        callContext.clientDetails = args.clientDetails;
      }

      // Ensure callSid is in callContext for state tracking
      const callSid = callContext.callSid || 'unknown';
      if (!callContext.callSid) {
        callContext.callSid = callSid;
      }

      // Check if client verification is required (for existing clients)
      if (bookingArgs.workflowType === 'existing' && callContext.clientDetails && !callContext.clientVerified) {
        return {
          success: false,
          requiresVerification: true,
          clientDetails: callContext.clientDetails,
          message: 'Client found but requires verbal verification before proceeding with booking. Please use the client_verification tool first.',
          dryRun: true,
          requiresConfirmation: false,
          auditId,
          screenshots: [],
          courseType: args.courseType
        };
      }

      // Perform policy check before booking (per prompt_2.txt requirement)
      try {
        const { performPolicyCheck } = await import('../policyCheckService.js');
        const fileSearchTool = await import('../../tools/fileSearch.js').then(m => m.default);
        const policyCheckResult = await performPolicyCheck(fileSearchTool, args.courseType, callContext);
        
        if (policyCheckResult.success && policyCheckResult.policyResults) {
          callContext.policyCheck = policyCheckResult.policyResults;
          console.log(`📋 [${auditId}] Policy check completed for ${args.courseType}`);
        } else {
          console.warn(`⚠️ [${auditId}] Policy check failed or incomplete:`, policyCheckResult.error);
        }
      } catch (policyError) {
        console.warn(`⚠️ [${auditId}] Policy check error (non-critical):`, policyError.message);
        // Don't fail booking if policy check fails
      }

      if (progressCallback) {
        progressCallback({ milestone: 'form_filling_started', message: 'Filling in booking details...', progress: 50 });
      }
      
      // Execute workflow - all services now use executeBookingWorkflow
      // Pass cancelToken and executionKey for phase tracking and cancellation support
      const result = await bookingService.executeBookingWorkflow(page, bookingArgs, callContext, cancelToken, executionKey, (phase) => {
        // Phase update callback - update execution lock phase
        if (executionKey) {
          this.updateExecutionPhase(executionKey, phase);
        }
      });
      
      // Log the result to debug workflow return values
      console.log(`📋 [${auditId}] ITM booking workflow result:`, {
        success: result.success,
        cancelled: result.cancelled || false,
        requiresWorkflowType: result.requiresWorkflowType,
        requiresVerification: result.requiresVerification,
        requiresPreferences: result.requiresPreferences,
        requiresCustomerInfo: result.requiresCustomerInfo,
        retryPrompt: result.retryPrompt ? 'present' : 'absent',
        error: result.error ? result.error.substring(0, 100) : 'none',
        message: result.message ? result.message.substring(0, 100) : 'none'
      });
      
      // If workflow was cancelled, return early with cancellation status
      // This allows the second call (with agreedSlot) to proceed
      // CRITICAL: Make it clear this is NOT booking completion - just a workflow replacement
      if (result.cancelled) {
        console.log(`🛑 [${auditId}] Workflow was cancelled - this is expected when replaced by a call with agreedSlot`);
        return {
          success: false,
          cancelled: true,
          message: result.message || 'The previous booking request was replaced by a new request with complete information. The booking is NOT complete - please wait for the new request to finish.',
          dryRun: true,
          requiresConfirmation: false,
          auditId,
          screenshots: result.screenshots || [],
          courseType: args.courseType,
          // CRITICAL: Add explicit flag to prevent agent from declaring booking complete
          isCancellation: true,
          bookingNotComplete: true
        };
      }
      
      if (progressCallback) {
        // CRITICAL: Only declare "Booking confirmed" if:
        // 1. result.success is true AND
        // 2. Payment is completed (paymentCompleted: true OR confirmationEmailSent: true) AND
        // 3. No structured response flags are present (not waiting for anything) AND
        // 4. Not a cancellation
        const paymentIsComplete = result.paymentCompleted === true || result.confirmationEmailSent === true;
        const isActuallyComplete = result.success && 
                                   paymentIsComplete && // CRITICAL: Payment must be completed
                                   !result.requiresVerification &&
                                   !result.requiresPreferences &&
                                   !result.requiresWorkflowType &&
                                   !result.requiresBookingContinuation &&
                                   !result.requiresCustomerInfo &&
                                   !result.requiresSlotSelection &&
                                   !result.cancelled &&
                                   !result.isCancellation;
        
        if (isActuallyComplete) {
          // CRITICAL: Only send "Booking confirmed" when payment is actually completed
          progressCallback({ milestone: 'confirmation_completed', message: 'Booking confirmed', progress: 100 });
        } else if (result.success && !paymentIsComplete) {
          // Success but payment not completed yet - explicitly say NOT confirmed
          progressCallback({ milestone: 'payment_pending', message: 'Processing payment - booking not yet confirmed', progress: 80 });
        } else if (result.success) {
          // Success but still waiting for something - explicitly say NOT confirmed
          progressCallback({ milestone: 'form_filling_completed', message: 'Details entered - booking not yet confirmed', progress: 70 });
        } else {
          // Not successful - explicitly say NOT confirmed
          progressCallback({ milestone: 'form_filling_completed', message: 'Details entered - booking not yet confirmed', progress: 70 });
        }
      }

      // If result indicates verification is required, return it with verification prompt
      if (result.requiresVerification) {
        return {
          success: false,
          requiresVerification: true,
          verificationPrompt: result.verificationPrompt,
          clientDetails: result.clientDetails || callContext.clientDetails,
          message: result.verificationPrompt || result.message || 'Client found but requires verbal verification before proceeding with booking.',
          dryRun: true,
          requiresConfirmation: false,
          auditId,
          screenshots: result.screenshots || [],
          courseType: args.courseType
        };
      }

      // If result indicates preferences are required, return it with preference prompt
      // IMPORTANT: Clear execution lock when returning requiresPreferences so retry with preferences can proceed immediately
      if (result.requiresPreferences) {
        // Clear execution lock to allow immediate retry with preferences
        // The page stays open (authenticated page), so the retry can continue from where it left off
        if (executionKey) {
          const execution = this.activeExecutions.get(executionKey);
          if (execution) {
            console.log(`🔄 [${auditId}] Clearing execution lock for requiresPreferences - allowing immediate retry with preferences`);
            this.activeExecutions.delete(executionKey);
          }
        }
        
        // CRITICAL: Store resume information in conversation state for next continuation call
        if (result.resumeFromStep && result.resumeContext) {
          const { conversations } = await import('../../shared/state.js');
          if (!conversations[callContext.callSid]) {
            conversations[callContext.callSid] = {};
          }
          conversations[callContext.callSid].lastBookingResult = {
            resumeFromStep: result.resumeFromStep,
            resumeContext: result.resumeContext,
            requiresPreferences: true,
            missingPreferences: result.missingPreferences || []
          };
          console.log(`💾 [${auditId}] Stored resume information in conversation state (resumeFromStep: ${result.resumeFromStep})`);
        }
        
        return {
          success: false,
          requiresPreferences: true,
          missingPreferences: result.missingPreferences || [],
          message: result.message || 'I need some additional information to proceed with your booking.',
          validOptions: result.validOptions || {},
          dryRun: true,
          requiresConfirmation: false,
          auditId,
          screenshots: result.screenshots || [],
          courseType: args.courseType,
          sessionDetails: result.sessionDetails,
          // CRITICAL: Include resume information in return value
          resumeFromStep: result.resumeFromStep,
          resumeContext: result.resumeContext
        };
      }

      // If result indicates retry prompt (mobile search), return it
      if (result.retryPrompt) {
        return {
          success: false,
          requiresCustomerInfo: true,
          retryPrompt: result.retryPrompt,
          message: result.retryPrompt,
          dryRun: true,
          requiresConfirmation: false,
          auditId,
          screenshots: result.screenshots || [],
          courseType: args.courseType
        };
      }

      // If result indicates workflowType is required (ITM bookings), return it
      // Check this BEFORE the generic error handler to ensure it's not lost
      if (result && (result.requiresWorkflowType === true || result.requiresWorkflowType === 'true')) {
        // Clear execution lock to allow immediate retry with workflowType
        // The page stays open (authenticated page), so the retry can continue from where it left off
        if (executionKey) {
          const execution = this.activeExecutions.get(executionKey);
          if (execution) {
            console.log(`🔄 [${auditId}] Clearing execution lock for requiresWorkflowType - allowing immediate retry with workflowType`);
            this.activeExecutions.delete(executionKey);
          }
        }
        
        console.log(`✅ [${auditId}] Detected requiresWorkflowType: true, returning structured response`);
        return {
          success: false,
          requiresWorkflowType: true,
          message: result.message || 'I need to know if you have done training with us before. Have you done training with Universal Motorcycle Training before?',
          sessionDetails: result.sessionDetails,
          dryRun: true,
          requiresConfirmation: false,
          auditId,
          screenshots: result.screenshots || [],
          courseType: args.courseType
        };
      }

      // If result indicates failure, return it gracefully
      // BUT only if it's not a structured response that should be handled above
      if (!result.success && !result.requiresWorkflowType && !result.requiresVerification && !result.requiresPreferences && !result.retryPrompt) {
        // Log the actual error for debugging
        console.error(`❌ [${auditId}] Course booking failed:`, result.error);
        if (result.technicalError) {
          console.error(`❌ [${auditId}] Technical error:`, result.technicalError);
        }
        if (result.error && result.error.stack) {
          console.error(`❌ [${auditId}] Error stack:`, result.error.stack);
        }
        
        return {
          success: false,
          error: result.error || 'An unexpected error occurred during booking',
          technicalError: result.technicalError || result.error,
          dryRun: result.dryRun !== undefined ? result.dryRun : true,
          requiresConfirmation: false,
          auditId,
          screenshots: result.screenshots || [],
          courseType: args.courseType
        };
      }

      // CRITICAL: Clear resume information if booking completed successfully
      if (result.success && !result.requiresPreferences && !result.requiresVerification && !result.requiresWorkflowType) {
        const { conversations } = await import('../../shared/state.js');
        if (conversations[callContext.callSid] && conversations[callContext.callSid].lastBookingResult) {
          console.log(`🧹 [${auditId}] Clearing resume information - booking completed successfully`);
          delete conversations[callContext.callSid].lastBookingResult;
        }
      }

      // Send email confirmation if booking was successful and customer email is available
      if (result.success && args.customerEmail) {
        try {
          const emailService = (await import('../emailService.js')).default;
          const { getTemplate } = await import('../emailTemplates.js');
          
          // Extract booking details from result if available
          const bookingDetails = result.sessionDetails || result.result || {};
          const templateData = {
            customerName: args.customerName || bookingDetails.customerName || 'Customer',
            bookingReference: bookingDetails.bookingReference || args.bookingReference || 'N/A',
            courseType: args.courseType || bookingDetails.courseType || 'N/A',
            date: args.bookingDate || bookingDetails.date || 'N/A',
            time: args.bookingTime || bookingDetails.time || 'N/A',
            centre: args.centre || bookingDetails.centre || 'N/A',
            address: bookingDetails.address,
            policyNote: callContext.policyCheck?.policyNote
          };

          // Send booking confirmation email (non-blocking)
          emailService.sendTemplateEmail(
            'booking_confirmation',
            templateData,
            args.customerEmail
          ).then(emailResult => {
            if (emailResult.success) {
              console.log(`✅ [${auditId}] Booking confirmation email sent to ${args.customerEmail}`);
            } else {
              console.warn(`⚠️ [${auditId}] Failed to send booking confirmation email: ${emailResult.error}`);
            }
          }).catch(emailError => {
            console.warn(`⚠️ [${auditId}] Error sending booking confirmation email (non-critical):`, emailError.message);
          });
        } catch (emailServiceError) {
          // Don't fail booking if email service fails
          console.warn(`⚠️ [${auditId}] Could not send booking confirmation email (non-critical):`, emailServiceError.message);
        }
      }

      return {
        success: result.success,
        result: result.result || result,
        dryRun: false,
        requiresConfirmation: false,
        auditId,
        screenshots: result.screenshots || [],
        courseType: args.courseType
      };

    } catch (error) {
      console.error('❌ Course booking execution failed:', error);
      await takeScreenshot(page, `${auditId}_course_booking_error.png`, './screenshots');
      
      // Return error gracefully with user-friendly message
      const errorContext = getErrorContext(error, 'create_booking');
      const userFriendlyError = formatUserFriendlyError(error, errorContext);
      
      return {
        success: false,
        error: userFriendlyError,
        technicalError: error.message, // Keep technical error for logging
        dryRun: true,
        requiresConfirmation: false,
        auditId,
        screenshots: [],
        courseType: args.courseType
      };
    }
  }
}

