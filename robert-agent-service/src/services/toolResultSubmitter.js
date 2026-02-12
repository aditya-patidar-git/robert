/**
 * Tool Result Submitter
 * Abstraction for submitting tool execution results
 * Supports both WebSocket (Media Streams) and HTTP (SIP) submission
 */

import promptService from './promptService.js';
import { conversations } from '../shared/state.js';
import { AFTER_LOGIN_MESSAGE, AFTER_CONFIRM_CANCEL_MESSAGE, AFTER_FORM_OPENED_MESSAGE, AFTER_FORM_SUBMITTED_MESSAGE, BEAR_WITH_ME } from '../config/cancellationPhrases.js';
import sessionStateManager from './browser/sessionStateManager.js';

/**
 * Base class for tool result submission
 */
class ToolResultSubmitter {
  /**
   * Submit tool execution result
   * @param {string} callId - Call ID
   * @param {string} toolCallId - Tool call ID
   * @param {object} result - Execution result
   * @param {object} options - Additional options
   * @returns {Promise<void>}
   */
  async submitResult(callId, toolCallId, result, options = {}) {
    throw new Error('submitResult must be implemented by subclass');
  }

  /**
   * Trigger response after tool completion
   * @param {string} callId - Call ID
   * @param {object} options - Additional options
   * @returns {Promise<void>}
   */
  async triggerResponse(callId, options = {}) {
    // Default: no-op, can be overridden
  }
}

/**
 * WebSocket result submitter for Media Streams
 */
export class WebSocketResultSubmitter extends ToolResultSubmitter {
  constructor(openaiWs, stateManager) {
    super();
    this.openaiWs = openaiWs;
    this.stateManager = stateManager;
  }

  /**
   * Get human-readable reason why response lock is unavailable
   * @param {object} stateManager - State manager instance
   * @returns {string} Reason string
   */
  _getLockUnavailableReason(stateManager) {
    if (!stateManager) {
      return 'no stateManager';
    }
    
    const reasons = [];
    if (stateManager.isResponding) {
      reasons.push('isResponding=true');
    }
    if (stateManager.activeResponseId !== null) {
      reasons.push(`activeResponseId=${stateManager.activeResponseId}`);
    }
    
    return reasons.length > 0 ? reasons.join(', ') : 'unknown';
  }

  /**
   * Submit result via WebSocket
   * @param {string} callId - Call ID
   * @param {string} toolCallId - Tool call ID
   * @param {object} result - Execution result
   * @param {object} options - Additional options
   */
  async submitResult(callId, toolCallId, result, options = {}) {
    // Get WebSocket from stored reference or state manager as fallback
    const openaiWs = this.openaiWs || this.stateManager?.openaiWs;
    
    if (!openaiWs || openaiWs.readyState !== 1) {
      const wsState = openaiWs ? openaiWs.readyState : 'null';
      const callClosed = this.stateManager?.isClosed ? ' (call closed)' : '';
      console.log(`ℹ️ [${callId}] Cannot submit result - WebSocket state: ${wsState}${callClosed}. This is expected if the call ended before tool completion.`);
      return;
    }

    if (this.stateManager && this.stateManager.isClosed) {
      console.log(`ℹ️ [${callId}] Cannot submit result - call is closed. This is expected if the call ended before tool completion.`);
      return;
    }

    const output = JSON.stringify(result);
    
    try {
      openaiWs.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: toolCallId,
          output: output
        }
      }));

      console.log(`✅ [${callId}] Tool result submitted via WebSocket for call_id: ${toolCallId}`);
    } catch (error) {
      console.error(`❌ [${callId}] Error submitting result via WebSocket:`, error);
      throw error;
    }
  }

  /**
   * Trigger response after tool completion
   * PHASE 1: Includes contextual instructions and proper response creation pattern
   * Includes retry logic to handle race conditions with response lock acquisition
   * @param {string} callId - Call ID
   * @param {object} options - Additional options
   */
  async triggerResponse(callId, options = {}) {
    // Get WebSocket from stored reference or state manager as fallback
    const openaiWs = this.openaiWs || this.stateManager?.openaiWs;
    
    if (!openaiWs || openaiWs.readyState !== 1) {
      console.warn(`⚠️ [${callId}] Cannot trigger response - WebSocket not ready (state: ${openaiWs?.readyState || 'null'})`);
      return;
    }

    if (this.stateManager && this.stateManager.isClosed) {
      console.log(`ℹ️ [${callId}] Cannot trigger response - call is closed`);
      return;
    }

    // Retry configuration
    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 150; // Wait 150ms between retries
    const MAX_WAIT_TIME_MS = 1000; // Maximum total wait time: 5 retries * 150ms = 750ms (within 1s limit)
    
    let retryCount = 0;
    let lockAcquired = false;
    
    // Retry loop to acquire lock
    while (retryCount < MAX_RETRIES && !lockAcquired) {
      if (this.stateManager && this.stateManager.tryAcquireResponseLock()) {
        lockAcquired = true;
        break;
      }
      
      // Log why lock acquisition failed
      const lockReason = this._getLockUnavailableReason(this.stateManager);
      
      if (retryCount === 0) {
        // First attempt failed - log with details
        console.warn(`⚠️ [${callId}] Response lock not available (attempt ${retryCount + 1}/${MAX_RETRIES}): ${lockReason}. Retrying...`);
      }
      
      retryCount++;
      
      // Wait before retrying (except on last attempt)
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
    
    // Check if we successfully acquired the lock
    if (!lockAcquired) {
      const finalLockReason = this._getLockUnavailableReason(this.stateManager);
      
      console.error(`❌ [${callId}] Failed to acquire response lock after ${MAX_RETRIES} attempts. Final state: ${finalLockReason}. Agent will wait for user input instead of automatically continuing.`);
      console.error(`   This may cause the agent to appear unresponsive. Tool: ${options?.toolName || 'unknown'}`);
      
      // CRITICAL RACE CONDITION FIX: Clear completion flag if lock acquisition failed
      // Prevents flag from being stuck if response creation fails
      if (this.stateManager) {
        this.stateManager.clearToolExecutionCompleting();
        console.log(`🔓 [${callId}] Cleared toolExecutionCompleting flag after lock acquisition failure`);
      }
      return;
    }
    
    // Lock acquired successfully - proceed with response creation
    try {
      const callSid = callId;
      let workflowPhase = await promptService.determineWorkflowPhase(this.stateManager, callSid);
      if ((options?.toolName && options.toolName.startsWith('cancellation_step_')) || conversations[callSid]?.workflowContext === 'cancellation') {
        workflowPhase = 'cancellation';
      }
      if ((options?.toolName && options.toolName.startsWith('booking_step_')) || conversations[callSid]?.workflowContext === 'booking') {
        workflowPhase = workflowPhase || 'booking_start';
      }
      
      // Get booking session info if available
      let courseType = null;
      let workflowType = null;
      let currentStep = null;
      
      if (callSid && conversations[callSid]?.bookingSession) {
        const bookingSession = conversations[callSid].bookingSession;
        courseType = bookingSession.courseType;
        workflowType = bookingSession.workflowType;
        currentStep = bookingSession.currentStep;
      }
      
      // Get contextual instructions for automatic continuation
      let responseInstructions = promptService.getContextualInstructions({
        isInitialGreeting: false,
        workflowPhase,
        courseType,
        workflowType,
        currentStep,
        activeTool: null // Tool just completed
      });
      
      // CRITICAL FIX: For client_verification specifically, handle both success and incomplete cases
      const toolName = options?.toolName;
      const toolResult = options?.toolResult;
      const isClientVerification = toolName === 'client_verification';
      if (isClientVerification) {
        if (toolResult && !toolResult.verified && toolResult.missingFields) {
          // Verification incomplete - agent must continue asking for ALL missing fields immediately
          const continueInstruction = toolResult.instruction || (() => {
            const fieldNames = {
              fullName: 'full name',
              postcode: 'postcode',
              telephoneNumber: 'telephone number'
            };
            const missingFieldNames = toolResult.missingFields?.map(f => fieldNames[f] || f).join(', ') || 'missing fields';
            
            return `CRITICAL: Client verification is INCOMPLETE. You have collected: ${toolResult.verifiedFields?.join(', ') || 'none'}. You MUST immediately ask for ALL missing fields: ${missingFieldNames}. Use the exact prompt: "${toolResult.message}". Then IMMEDIATELY call client_verification tool again with ALL missing fields filled in. The caller may provide all missing fields in one response, or may provide them partially - extract whatever they provide and call the tool again. Do NOT wait for the user to ask "are you still there" or any other prompt. Continue the verification flow immediately without pausing.`;
          })();
          
          responseInstructions = responseInstructions 
            ? `${continueInstruction}\n\n${responseInstructions}`
            : continueInstruction;
          console.log(`🎯 [${callId}] Client verification incomplete - instructing to ask for missing fields: ${toolResult.missingFields?.join(', ')}${toolResult.requiresImmediateContinuation ? ' (requires immediate continuation)' : ''}`);
        } else if (toolResult && toolResult.verified) {
          // Verification successful - agent must confirm and ask for explicit yes/no before proceeding
          const nextStepTool = toolResult.nextStepTool || 'booking_step_select_session';
          
          // Check if we're in a cancellation workflow
          const isCancellationWorkflow = (options?.toolName && options.toolName.startsWith('cancellation_step_')) || 
                                         conversations[callSid]?.workflowContext === 'cancellation' ||
                                         workflowPhase === 'cancellation';
          
          // Use appropriate fallback message based on workflow type
          const fallbackMessage = isCancellationWorkflow
            ? 'You are successfully verified. Would you like to proceed with cancelling your booking? Please say yes or no.'
            : 'You are successfully verified. Would you like to proceed with your booking? Please say yes or no.';
          
          if (toolResult.requiresExplicitConfirmation) {
            // New behavior: Ask for explicit confirmation before proceeding
            const confirmationInstruction = `CRITICAL: You MUST say EXACTLY: "${toolResult.message || fallbackMessage}" Then WAIT for the caller to respond with "yes" or "no". DO NOT proceed to the next step until the caller explicitly confirms with "yes". If the caller says "no", ask how you can help them instead. Only after the caller says "yes", proceed to call the next step tool: ${nextStepTool}.`;
            
            responseInstructions = responseInstructions 
              ? `${confirmationInstruction}\n\n${responseInstructions}`
              : confirmationInstruction;
            console.log(`🎯 [${callId}] Client verification successful - instructing explicit confirmation before proceeding: ${nextStepTool}`);
          } else {
            // Legacy behavior: Immediate continuation (for backward compatibility)
            const continuationMessage = isCancellationWorkflow
              ? 'Now let me continue with your cancellation.'
              : 'Now let me continue with your booking.';
            const immediateResponseInstruction = `CRITICAL: You MUST speak immediately without waiting. Start with EXACTLY: "You are successfully verified." Then IMMEDIATELY in the SAME response, continue with: "${continuationMessage}" Then IMMEDIATELY call the next step tool: ${nextStepTool} WITHOUT waiting for any user response or prompt. Do NOT pause after saying "You are successfully verified" - immediately continue and call the tool in the same response. Do NOT wait for prompts or user input. The verification is complete - proceed automatically to the next step.`;
            
            responseInstructions = responseInstructions 
              ? `${immediateResponseInstruction}\n\n${responseInstructions}`
              : immediateResponseInstruction;
            console.log(`🎯 [${callId}] Client verification successful - instructing immediate confirmation and next step: ${nextStepTool}${toolResult.requiresImmediateNextStep ? ' (requires immediate next step)' : ''}`);
          }
        }
      }

      const isFillContactDetailsMissing = toolName === 'booking_step_fill_contact_details' &&
        toolResult?.success === true &&
        Array.isArray(toolResult?.missingFields) &&
        toolResult.missingFields.length > 0;
      if (isFillContactDetailsMissing) {
        const msg = toolResult.message || `I need your ${(toolResult.missingFields || []).join(', ')}; could you please provide them?`;
        const instruction = toolResult.instruction || `Ask the caller for ALL missing details using: "${msg}". Collect them iteratively (one or more conversational turns). Do NOT call booking_step_fill_contact_details again until you have every value. Then call it ONCE with all parameters: customerEmail, customerMobile, postcode, houseNumber, licenceHeld, nationalInsurance, drivingLicenceNumber (as applicable).`;
        responseInstructions = responseInstructions
          ? `${instruction}\n\n${responseInstructions}`
          : instruction;
        console.log(`🎯 [${callId}] Fill contact details incomplete - instructing to collect all missing then call once: ${toolResult.missingFields?.join(', ')}`);
      }

      if (toolName === 'transfer_call' && toolResult?.allTransferNumbersFailed === true && toolResult?.messageForCaller) {
        const msg = toolResult.messageForCaller;
        const transferInstruction = `CRITICAL: The transfer could not be completed because all agents are busy. You MUST say exactly this to the caller: "${msg}" Then offer to help with anything else or end the call.`;
        responseInstructions = responseInstructions
          ? `${transferInstruction}\n\n${responseInstructions}`
          : transferInstruction;
        console.log(`🎯 [${callId}] Transfer all-occupied - instructing agent to say message to caller`);
      }

      let forceNextToolChoice = null;
      const isRequiresToolRedirect = !!toolResult?.requiresTool;
      if (isRequiresToolRedirect) {
        forceNextToolChoice = toolResult.requiresTool;
        const reqCourseType = courseType || sessionStateManager.getSession(callSid)?.courseType;
        if (!reqCourseType) {
          console.warn(`⚠️ [${callId}] courseType not available for ${toolResult.requiresTool} - will be determined from booking`);
        }
        responseInstructions = `CRITICAL: You called a step out of order. SPEAK a short phrase like "Let me do that now." then IN THIS SAME RESPONSE invoke the tool ${toolResult.requiresTool} with courseType "${reqCourseType}". Do NOT output JSON or parameters as text—say words, then call the tool.`;
        console.log(`🎯 [${callId}] Wrong step - forcing required tool: ${toolResult.requiresTool}`);
      }

      const isVerifyBookingIntentProceed = !forceNextToolChoice && toolName === 'cancellation_step_verify_booking_intent' &&
        toolResult?.success === true &&
        toolResult?.proceedToStep2 === true &&
        toolResult?.nextStep === 'cancellation_step_authenticate';
      if (isVerifyBookingIntentProceed) {
        // courseType is optional - will be determined from booking in Step 6
        // Use placeholder 'TBD' if not available yet
        const authCourseType = courseType || sessionStateManager.getSession(callSid)?.courseType || 'TBD';
        responseInstructions = `CRITICAL: Say exactly this out loud and then stop. Do not call any tools: "${AFTER_LOGIN_MESSAGE}"`;
        if (this.stateManager) {
          this.stateManager.pendingChainedToolCall = { toolName: 'cancellation_step_authenticate', args: { courseType: authCourseType } };
        }
        console.log(`🎯 [${callId}] Cancellation proceed to Step 2 - say-only then inject cancellation_step_authenticate (courseType: ${authCourseType})`);
      }

      const isConfirmCancellationProceed = !forceNextToolChoice && toolName === 'cancellation_step_confirm_cancellation' &&
        toolResult?.success === true &&
        toolResult?.confirmed === true &&
        toolResult?.nextStep === 'cancellation_step_initiate_cancellation';
      if (isConfirmCancellationProceed) {
        const session = sessionStateManager.getSession(callSid);
        const bookingDetails = sessionStateManager.getBookingDetails(callSid) || session?.bookingDetails;
        const initCourseType = courseType || session?.courseType;
        const validCourseType = initCourseType && initCourseType !== 'TBD';
        if (!validCourseType) {
          console.error(`❌ [${callId}] courseType not available or TBD for initiate_cancellation - skipping chained call (set in locateBooking/confirm_cancellation)`);
        }
        const initCourseDate = bookingDetails?.courseDate || bookingDetails?.bookingDate;
        if (initCourseDate && validCourseType) {
          responseInstructions = `CRITICAL: Say exactly this out loud and then stop. Do not call any tools: "${AFTER_CONFIRM_CANCEL_MESSAGE}"`;
          if (this.stateManager) {
            this.stateManager.pendingChainedToolCall = { toolName: 'cancellation_step_initiate_cancellation', args: { courseType: initCourseType, workflowType: 'existing', courseDate: initCourseDate } };
          }
          console.log(`🎯 [${callId}] Cancellation confirmed - say-only then inject initiate_cancellation (courseType: ${initCourseType}, courseDate: ${initCourseDate})`);
        }
      }

      const isInitiateCancellationProceed = !forceNextToolChoice && toolName === 'cancellation_step_initiate_cancellation' &&
        toolResult?.success === true &&
        toolResult?.cancellationFormOpened === true;
      if (isInitiateCancellationProceed) {
        const fillCourseType = courseType || sessionStateManager.getSession(callSid)?.courseType;
        const cancellationFee = sessionStateManager.getCancellationFee(callSid);
        const validCourseType = fillCourseType && fillCourseType !== 'TBD';
        if (!validCourseType) {
          console.error(`❌ [${callId}] courseType not available or TBD for fill_cancellation_form - skipping chained call`);
        } else if (cancellationFee == null || cancellationFee === undefined) {
          console.error(`❌ [${callId}] cancellationFee not available for chained fill_cancellation_form - skipping`);
        } else {
          responseInstructions = `CRITICAL: You must output ONLY this single sentence, no other words or tools: "${AFTER_FORM_OPENED_MESSAGE}"`;
          if (this.stateManager) {
            this.stateManager.pendingChainedToolCall = { toolName: 'cancellation_step_fill_cancellation_form', args: { courseType: fillCourseType, workflowType: 'existing', cancellationFee: Number(cancellationFee) } };
          }
          console.log(`🎯 [${callId}] Cancellation form opened - say-only then inject fill_cancellation_form`);
        }
      }

      const isFillCancellationFormProceed = !forceNextToolChoice && toolName === 'cancellation_step_fill_cancellation_form' &&
        toolResult?.success === true &&
        toolResult?.cancellationSubmitted === true;
      if (isFillCancellationFormProceed) {
        const navCourseType = courseType || sessionStateManager.getSession(callSid)?.courseType;
        const validCourseType = navCourseType && navCourseType !== 'TBD';
        if (!validCourseType) {
          console.error(`❌ [${callId}] courseType not available or TBD for navigate_communication - skipping chained call`);
        } else {
          responseInstructions = `CRITICAL: You must output ONLY this single sentence, no other words or tools: "${AFTER_FORM_SUBMITTED_MESSAGE}"`;
          if (this.stateManager) {
            this.stateManager.pendingChainedToolCall = { toolName: 'cancellation_step_navigate_communication', args: { courseType: navCourseType, workflowType: 'existing' } };
          }
          console.log(`🎯 [${callId}] Cancellation form submitted - say-only then inject navigate_communication`);
        }
      }

      const isNavigateCommunicationProceed = !forceNextToolChoice && toolName === 'cancellation_step_navigate_communication' &&
        toolResult?.success === true &&
        toolResult?.templatePageOpened === true;
      if (isNavigateCommunicationProceed) {
        const selCourseType = courseType || sessionStateManager.getSession(callSid)?.courseType;
        const validCourseType = selCourseType && selCourseType !== 'TBD';
        if (!validCourseType) {
          console.error(`❌ [${callId}] courseType not available or TBD for select_template - skipping chained call`);
        } else {
          responseInstructions = `CRITICAL: Say exactly this out loud and then stop. Do not call any tools: "${BEAR_WITH_ME}"`;
          if (this.stateManager) {
            this.stateManager.pendingChainedToolCall = { toolName: 'cancellation_step_select_template', args: { courseType: selCourseType, workflowType: 'existing' } };
          }
          console.log(`🎯 [${callId}] Template page opened - say-only then inject select_template`);
        }
      }
      
      if (retryCount > 0) {
        console.log(`✅ [${callId}] Successfully acquired response lock after ${retryCount} retry attempt(s)`);
      }
      console.log(`[RESPONSE-SOURCE] [${callId}] tool_completion`);
      // Step 1: Set tool_choice before creating response (force next tool when chaining, else disable)
      const toolChoiceForResponse = forceNextToolChoice
        ? { type: 'function', name: forceNextToolChoice }
        : 'none';
      openaiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          tool_choice: toolChoiceForResponse
        }
      }));
      
      // Small delay to ensure session update is processed
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Track when selectBookingOptions completes successfully to delay periodic updates
      if (toolName === 'booking_step_select_booking_options' && toolResult?.success === true) {
        // Estimate acknowledgment end time based on response instructions
        const acknowledgmentText = responseInstructions || 'Booking options selected successfully';
        const estimatedDuration = this.estimateAcknowledgmentDuration(acknowledgmentText);
        const acknowledgmentEndTime = Date.now() + estimatedDuration;
        
        // Store in conversation state for delayed periodic update start
        if (!conversations[callSid]) {
          conversations[callSid] = {};
        }
        conversations[callSid].bikeTypeQuestionsCompleted = {
          acknowledgmentEndTime: acknowledgmentEndTime,
          estimatedDuration: estimatedDuration
        };
        console.log(`📊 [${callId}] Bike type questions completed - acknowledgment will end at ${new Date(acknowledgmentEndTime).toISOString()} (estimated ${estimatedDuration}ms)`);
      }
      
      // Step 2: Create response with contextual instructions
      const responseCreatePayload = {
        type: 'response.create',
        response: {
          modalities: ['audio', 'text']
        }
      };
      
      // PHASE 1: Include contextual instructions to ensure automatic continuation
      if (responseInstructions) {
        responseCreatePayload.response.instructions = responseInstructions;
        const chained = isVerifyBookingIntentProceed || isConfirmCancellationProceed || isInitiateCancellationProceed || isFillCancellationFormProceed || isNavigateCommunicationProceed;
        console.log(`📋 [${callId}] Including contextual instructions in response.create after tool completion (phase: ${workflowPhase}${isClientVerification ? ', client_verification' : ''}${isRequiresToolRedirect ? ', force requiresTool redirect' : ''}${chained ? ', say-only then chained tool' : ''})`);
      }
      
      openaiWs.send(JSON.stringify(responseCreatePayload));
      console.log(`✅ [${callId}] Response triggered after tool completion with contextual instructions`);
      
      // CRITICAL RACE CONDITION FIX: Clear completion flag after response is created
      // This allows normal operation to resume
      if (this.stateManager) {
        this.stateManager.clearToolExecutionCompleting();
        console.log(`🔓 [${callId}] Cleared toolExecutionCompleting flag after response creation`);
      }
      
      // Step 3: Re-enable tools after delay
      setTimeout(() => {
        if (openaiWs && openaiWs.readyState === 1) {
          openaiWs.send(JSON.stringify({
            type: 'session.update',
            session: {
              tool_choice: 'auto'
            }
          }));
        }
      }, 3000);
      
    } catch (error) {
      console.error(`❌ [${callId}] Error triggering response:`, error);
      // Release lock and clear completion flag on error
      if (this.stateManager) {
        this.stateManager.releaseResponseLock();
        this.stateManager.clearToolExecutionCompleting();
        console.log(`🔓 [${callId}] Cleared toolExecutionCompleting flag after error`);
      }
    }
  }
}

/**
 * HTTP result submitter for SIP
 * Returns result in HTTP response format
 */
export class HTTPResultSubmitter extends ToolResultSubmitter {
  constructor() {
    super();
  }

  /**
   * Format result for HTTP response
   * @param {string} callId - Call ID
   * @param {string} toolCallId - Tool call ID
   * @param {object} result - Execution result
   * @param {object} options - Additional options
   * @returns {object} HTTP response object
   */
  async submitResult(callId, toolCallId, result, options = {}) {
    // For HTTP, we return the result object directly
    // The handler will format it as JSON response
    return {
      success: result.success !== false,
      result: result,
      tool_call_id: toolCallId,
      call_id: callId
    };
  }

  /**
   * Trigger response after tool completion
   * For HTTP/SIP, this is handled by OpenAI's SIP connector
   * No action needed here
   */
  async triggerResponse(callId, options = {}) {
    // No-op for HTTP/SIP - OpenAI handles response triggering
  }

  /**
   * Estimate acknowledgment duration for bike type questions completion
   * @param {string} text - Response text
   * @returns {number} Estimated duration in milliseconds
   */
  estimateAcknowledgmentDuration(text) {
    if (!text || typeof text !== 'string') {
      return 3000; // Default 3 seconds
    }
    // Extract actual message text (remove CRITICAL instructions)
    const messageMatch = text.match(/"([^"]+)"/);
    const messageText = messageMatch ? messageMatch[1] : text.split('\n')[0];
    const wordCount = messageText.trim().split(/\s+/).filter(word => word.length > 0).length;
    // Average speech rate: ~2.5 words/second (150 words/minute)
    // Add 1 second buffer for natural pauses
    const durationMs = (wordCount / 2.5) * 1000 + 1000;
    return Math.ceil(durationMs);
  }
}

/**
 * Factory function to create appropriate submitter
 * @param {string} type - 'websocket' or 'http'
 * @param {object} options - Options for submitter
 * @returns {ToolResultSubmitter} Submitter instance
 */
export function createResultSubmitter(type, options = {}) {
  if (type === 'websocket') {
    return new WebSocketResultSubmitter(options.openaiWs, options.stateManager);
  } else if (type === 'http') {
    return new HTTPResultSubmitter();
  } else {
    throw new Error(`Unknown submitter type: ${type}`);
  }
}

