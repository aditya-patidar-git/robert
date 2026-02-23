/**
 * Tool Result Submitter
 * Abstraction for submitting tool execution results
 * Supports both WebSocket (Media Streams) and HTTP (SIP) submission
 */

import promptService from './promptService.js';
import { conversations } from '../shared/state.js';
import { AFTER_LOGIN_MESSAGE, AFTER_CONFIRM_CANCEL_MESSAGE, AFTER_FORM_OPENED_MESSAGE, AFTER_FORM_SUBMITTED_MESSAGE, BEAR_WITH_ME } from '../config/cancellationPhrases.js';
import sessionStateManager from './browser/sessionStateManager.js';
import progressIndicatorService from './progressIndicatorService.js';
import { getNextStepName } from './browser/stepConfiguration.js';

/** Cancellation step tools in order (step 1..14). Used to recover from wrong/non-existent tool by running the correct next step. */
const CANCELLATION_TOOL_ORDER = [
  'cancellation_step_verify_booking_intent',
  'cancellation_step_authenticate',
  'cancellation_step_determine_workflow',
  'cancellation_step_navigate_contacts',
  'cancellation_step_search_client',
  'cancellation_step_select_client',
  'cancellation_step_locate_booking',
  'cancellation_step_confirm_cancellation',
  'cancellation_step_initiate_cancellation',
  'cancellation_step_fill_cancellation_form',
  'cancellation_step_navigate_communication',
  'cancellation_step_select_template',
  'cancellation_step_send_confirmation',
  'cancellation_step_voice_confirmation'
];

/** Booking step name (from stepConfiguration) → tool name. Used to recover from wrong/non-existent booking step by tallying correct next step. */
const BOOKING_STEP_NAME_TO_TOOL = {
  checkAvailability: 'booking_step_check_availability',
  authenticate: 'booking_step_authenticate',
  navigateContacts: 'booking_step_navigate_contacts',
  searchClient: 'booking_step_search_client',
  selectSession: 'booking_step_select_session',
  selectBookingOptions: 'booking_step_select_booking_options',
  createNewContact: 'booking_step_create_new_contact',
  lookupContact: 'booking_step_lookup_contact',
  fillContactDetails: 'booking_step_fill_contact_details',
  processPayment: 'booking_step_process_payment',
  sendPaymentRequest: 'booking_step_send_payment_request',
  sendConfirmation: 'booking_step_send_confirmation',
  sendTerms: 'booking_step_send_terms',
  sendSMS: 'booking_step_send_sms'
};

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

  /**
   * Estimate acknowledgment duration for bike type questions completion.
   * Used by WebSocketResultSubmitter when select_booking_options completes.
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

        // Phase 0: Override workflowPhase from session step so we get the right template (fixes workflowContext===booking always returning booking_start and general_inquiry when session was missing)
        if (workflowPhase !== 'cancellation' && currentStep != null && currentStep !== undefined) {
          const step = currentStep;
          const wt = bookingSession.workflowType || workflowType;
          if (step === 1) workflowPhase = 'booking_availability';
          else if (step === 2) workflowPhase = 'booking_authentication';
          else if (step === 4 || step === 5) workflowPhase = 'booking_existing_client';
          else if (step === 6 && wt === 'new') workflowPhase = 'booking_new_client';
          else if (step === 6 && wt === 'existing') workflowPhase = 'booking_existing_client';
          else if (step === 7) workflowPhase = 'booking_options';
          else if (step === 8 && wt === 'existing') workflowPhase = 'booking_lookup_contact';
          else if (step >= 8 && step <= 9) workflowPhase = 'booking_payment';
          else if (step >= 10) workflowPhase = 'booking_completion';
        }
      }

      // Keep payment phase when process_payment failed (validation or execution) so next response stays in payment context
      if (options?.toolName === 'booking_step_process_payment' && options?.toolResult && options.toolResult.success === false) {
        workflowPhase = 'booking_payment';
        console.log(`🎯 [${callId}] process_payment failed - keeping phase booking_payment for next response`);
      }
      // Also keep payment phase when process_payment returned requiresTermsBeforeSend (success but not completed)
      if (options?.toolName === 'booking_step_process_payment' && options?.toolResult && options.toolResult.requiresTermsBeforeSend === true) {
        workflowPhase = 'booking_payment';
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

      // Step tool parameter/validation failure: instruct to resolve (ask user or use context) and retry, do NOT offer transfer
      const isStepToolParamError = toolName && (toolName.startsWith('booking_step_') || toolName.startsWith('cancellation_step_')) &&
        toolResult && toolResult.success === false && toolResult.error &&
        /Validation failed|Required|Invalid parameters|missing|courseType/i.test(toolResult.error);
      if (isStepToolParamError) {
        const paramErrorInstruction = `CRITICAL: This is a missing or invalid parameter error for a booking/cancellation step—NOT a technical failure. Do NOT offer to transfer the caller to a human agent for this. First try to resolve it: (1) If you have the missing detail from context (e.g. agreedSlot, course type from the conversation or session), call the same step again with the correct parameters. (2) If you need the detail from the caller, ask one short question (e.g. "Which course is this for—Introduction to Motorcycling or CBT?"), then call the same step again with the correct parameters. Only offer transfer if you cannot resolve after trying.`;
        responseInstructions = responseInstructions
          ? `${paramErrorInstruction}\n\n${responseInstructions}`
          : paramErrorInstruction;
        console.log(`🎯 [${callId}] Step tool parameter/validation error - instructing to resolve and retry, not transfer`);
      }

      // Unknown tool recovery (booking): any non-existent or wrong booking_step_* — tally correct next step from session and auto-run (like cancellation)
      const isUnknownBookingStepTool = toolName && toolName.startsWith('booking_step_') &&
        toolResult && toolResult.success === false &&
        (/(Unknown tool|Tool not found)/i.test(toolResult.details || '') || /(Unknown tool|Tool not found)/i.test(toolResult.error || ''));
      if (isUnknownBookingStepTool && this.stateManager) {
        const session = sessionStateManager.getSession(callSid);
        const reqCourseType = courseType || session?.courseType;
        const wfType = workflowType || session?.workflowType || 'existing';
        let currentStep = sessionStateManager.getCurrentStep(callSid);
        if (currentStep == null) {
          currentStep = wfType === 'new' ? 5 : 7;
        }
        const nextStepName = getNextStepName(reqCourseType, wfType, currentStep);
        const correctTool = nextStepName ? BOOKING_STEP_NAME_TO_TOOL[nextStepName] : null;
        if (correctTool && reqCourseType) {
          const args = { courseType: reqCourseType, workflowType: wfType };
          this.stateManager.pendingChainedToolCall = { toolName: correctTool, args };
          const tallyInstruction = `CRITICAL: That tool does not exist. The correct next step is **${correctTool}**. Call it with courseType "${reqCourseType}" and workflowType "${wfType}". Do not ask the caller to repeat—proceed automatically.`;
          responseInstructions = responseInstructions
            ? `${tallyInstruction}\n\n${responseInstructions}`
            : tallyInstruction;
          console.log(`🎯 [${callId}] Unknown booking step tool - tally recovery set to ${correctTool} (next step: ${nextStepName}); will auto-run if model does not call it`);
        }
      }

      // Unknown cancellation tool (e.g. cancellation_step_find_booking) — tally next step from ordered list and auto-run
      const isUnknownCancellationTool = toolName && toolName.startsWith('cancellation_step_') &&
        toolResult && toolResult.success === false &&
        (/(Unknown tool|Tool not found)/i.test(toolResult.details || '') || /(Unknown tool|Tool not found)/i.test(toolResult.error || ''));
      if (isUnknownCancellationTool && this.stateManager) {
        const session = sessionStateManager.getSession(callSid);
        const currentStep = sessionStateManager.getCancellationCurrentStep(callSid) ?? 1; // 1-based
        const nextIndex = Math.max(0, Math.min((currentStep - 1), CANCELLATION_TOOL_ORDER.length - 1));
        const correctTool = CANCELLATION_TOOL_ORDER[nextIndex] || CANCELLATION_TOOL_ORDER[0];
        const reqCourseType = courseType || session?.courseType;
        if (reqCourseType) {
          const args = { courseType: reqCourseType, workflowType: 'existing' };
          const bd = sessionStateManager.getBookingDetails(callSid) || session?.bookingDetails;
          if (bd?.courseDate) args.courseDate = bd.courseDate;
          this.stateManager.pendingChainedToolCall = { toolName: correctTool, args };
          responseInstructions = (responseInstructions || '') + `\n\nCRITICAL: That tool does not exist. The correct next step is ${correctTool}. Call it with courseType "${reqCourseType}".`;
          console.log(`🎯 [${callId}] Unknown cancellation tool - pending recovery set to ${correctTool} (step ${nextIndex + 1})`);
        }
      }

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
            
            return `CRITICAL: Client verification is INCOMPLETE. You have collected: ${toolResult.verifiedFields?.join(', ') || 'none'}. You MUST immediately ask for the next missing field: ${missingFieldNames}. Use the exact prompt: "${toolResult.message}". Then call client_verification again with only the field(s) the caller has just said—use fullName and postcode from the previous tool result if already verified, and add ONLY the new value the caller spoke. Do NOT pass postcode or telephoneNumber from stored clientDetails—only use what the caller actually said. If the caller provides multiple fields in one response, extract them and call the tool with those caller-spoken values only. Do NOT wait for the user to ask "are you still there". Continue the verification flow immediately.`;
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

      // Phase 0: After check_availability (step 1), present ONLY slots from tool result; do NOT invent slots; do NOT ask for full name or contact details
      if (toolName === 'booking_step_check_availability' && toolResult?.success === true) {
        const slotsFromTool = toolResult?.message ? ` Tool result message: "${toolResult.message}"` : '';
        const instruction = `CRITICAL: booking_step_check_availability just returned the exact slots to present. You MUST read the slot list from the tool result verbatim—do NOT paraphrase, infer, or substitute any date, time, or location. Do NOT invent or add any slots; present ONLY what appears after "Slots to present:" in the tool result message.${slotsFromTool} After the caller confirms a slot, call booking_step_authenticate only. Do NOT ask for full name, email, postcode, telephone, or any contact or personal details—only confirm the slot then proceed to authentication.`;
        responseInstructions = responseInstructions ? `${instruction}\n\n${responseInstructions}` : instruction;
        console.log(`🎯 [${callId}] Check availability completed - instructing to present ONLY tool result slots (verbatim), then booking_step_authenticate; no contact questions`);
      }

      // Phase 1: After search_client finds a client with requiresVerification, agent MUST call client_verification (not search_client again), then after verified call booking_step_select_session
      const isSearchClientRequiresVerification = toolName === 'booking_step_search_client' &&
        toolResult?.success === true &&
        toolResult?.requiresVerification === true;
      if (isSearchClientRequiresVerification) {
        const verificationPrompt = toolResult?.verificationPrompt || 'I found your profile. For data protection, please confirm your full name, then your postcode, then your telephone number.';
        const instruction = `CRITICAL: booking_step_search_client found a client; verification is required. Do NOT call booking_step_search_client again. Say: "${verificationPrompt}" Then ask for full name first. Call client_verification with ONLY fullName when the caller provides it. After the tool returns, ask for postcode and call client_verification with fullName (from the previous tool result) and postcode ONLY when the caller says their postcode. Then ask for telephone number and call with fullName, postcode, and telephoneNumber ONLY when the caller says their number. Do NOT pass postcode or telephoneNumber from the search result or stored clientDetails—only use what the caller actually says. Only after client_verification returns verified: true, call booking_step_select_session to open the diaries tab.`;
        responseInstructions = responseInstructions
          ? `${instruction}\n\n${responseInstructions}`
          : instruction;
        if (workflowPhase === 'general_inquiry' || workflowPhase === 'booking_start') {
          workflowPhase = 'booking_existing_client';
          const refreshed = promptService.getContextualInstructions({
            isInitialGreeting: false,
            workflowPhase: 'booking_existing_client',
            courseType,
            workflowType: workflowType || 'existing',
            currentStep: currentStep ?? 5,
            activeTool: null
          });
          responseInstructions = refreshed ? `${instruction}\n\n${refreshed}` : responseInstructions;
        }
        console.log(`🎯 [${callId}] Search client requires verification - instructing to call client_verification next (do not call search_client again), then booking_step_select_session after verified`);
      }

      // Phase 2: After select_session, call select_booking_options in this turn first; do NOT ask for bike type until after the tool returns
      if (toolName === 'booking_step_select_session' && toolResult?.success === true) {
        const instruction = `CRITICAL: booking_step_select_session completed. The UI is still on the diaries tab—the booking options tab opens only when you call booking_step_select_booking_options. In this turn you MUST: (1) Say ONLY a brief confirmation (e.g. "Session selected. Proceeding to booking options.")—do NOT ask for bike type, do NOT list 125cc/50cc/manual options, do NOT say "which bike type would you prefer". (2) Call **booking_step_select_booking_options** with courseType and workflowType from the current session in this same turn. Only after the tool returns may you ask for bike type. After the caller says their choice, call **booking_step_select_booking_options** again with courseType, workflowType, and **bikeType** (e.g. bikeType: "125cc automatic")—do NOT use selectedOptions. There is NO tool named booking_step_finalize_booking, booking_step_finalize_course_options, or booking_step_select_options. After options are set, use booking_step_lookup_contact (existing) or booking_step_create_new_contact (new), then booking_step_fill_contact_details.`;
        responseInstructions = responseInstructions ? `${instruction}\n\n${responseInstructions}` : instruction;
        console.log(`🎯 [${callId}] Select session completed - instructing to call booking_step_select_booking_options next`);
        const reqCourseType = courseType || sessionStateManager.getSession(callSid)?.courseType;
        if (this.stateManager && reqCourseType) {
          const session = sessionStateManager.getSession(callSid);
          this.stateManager.pendingChainedToolCall = {
            toolName: 'booking_step_select_booking_options',
            args: { courseType: reqCourseType, workflowType: workflowType || session?.workflowType || 'existing' }
          };
          console.log(`🎯 [${callId}] Pending recovery tool set (after select_session) - will auto-run booking_step_select_booking_options if model does not call it`);
        }
      }

      // When select_booking_options returns requiresPreferences (e.g. missing bikeType), ask once only—do not repeat if already asked
      const isSelectBookingOptionsRequiresPrefs = toolName === 'booking_step_select_booking_options' && toolResult?.requiresPreferences === true;
      if (isSelectBookingOptionsRequiresPrefs) {
        const noRepeatInstruction = `CRITICAL: The tool needs the caller's bike type preference. If you already asked for bike type in your previous message, do NOT ask again—wait for the caller's answer. If you have not asked yet, ask once using the message below and list the three options (125cc automatic, 50cc automatic, 125cc manual).`;
        responseInstructions = responseInstructions ? `${noRepeatInstruction}\n\n${responseInstructions}` : noRepeatInstruction;
        console.log(`🎯 [${callId}] Select booking options requires preferences (e.g. bikeType) - instructing to ask once only, do not repeat`);
      }

      // Phase 3: After select_booking_options (or alias e.g. booking_step_finalize), call lookup_contact (existing) or create_new_contact (new) next
      const bookingOptionsAliases = ['booking_step_finalize', 'booking_step_finalize_booking', 'booking_step_finalize_course_options', 'booking_step_select_options', 'booking_step_booking_options'];
      const isSelectBookingOptionsCompleted = (toolName === 'booking_step_select_booking_options' || bookingOptionsAliases.includes(toolName)) && toolResult?.success === true;
      if (isSelectBookingOptionsCompleted) {
        const wt = workflowType || conversations[callSid]?.bookingSession?.workflowType;
        const instruction = wt === 'new'
          ? `CRITICAL: Do not call booking_step_select_booking_options again. Say only a brief confirmation (e.g. "Your booking options are successfully selected."). Do NOT mention "contact details" or "finalize your contact details". Do not ask any questions. Call booking_step_create_new_contact next with courseType and workflowType: "new". Then immediately call booking_step_fill_contact_details.`
          : `CRITICAL: Do not call booking_step_select_booking_options again. Say ONLY 2-5 words (e.g. "Options set." or "Done."). Do NOT say any other sentence or list next steps. Then call booking_step_lookup_contact with courseType and workflowType: "existing". This step is silent (no questions)—do not ask about contact until booking_step_fill_contact_details has run and returned missingFields.`;
        responseInstructions = responseInstructions ? `${instruction}\n\n${responseInstructions}` : instruction;
        console.log(`🎯 [${callId}] Select booking options completed - instructing to call ${wt === 'new' ? 'booking_step_create_new_contact' : 'booking_step_lookup_contact'} next`);
        const nextTool = wt === 'new' ? 'booking_step_create_new_contact' : 'booking_step_lookup_contact';
        const reqCourseType = courseType || sessionStateManager.getSession(callSid)?.courseType;
        if (this.stateManager && reqCourseType) {
          const session = sessionStateManager.getSession(callSid);
          this.stateManager.pendingChainedToolCall = {
            toolName: nextTool,
            args: { courseType: reqCourseType, workflowType: wt === 'new' ? 'new' : 'existing' }
          };
          console.log(`🎯 [${callId}] Pending recovery tool set (after select_booking_options) - will auto-run ${nextTool} if model does not call it`);
        }
      }

      // Phase 4: After lookup_contact, call fill_contact_details next (do NOT ask for email or any contact details here)
      if (toolName === 'booking_step_lookup_contact' && toolResult?.success === true) {
        const instruction = `CRITICAL: booking_step_lookup_contact completed. Do NOT say "we're all set with your contact details", "let's move on to payment", or "are you ready to proceed with payment" until you have called booking_step_fill_contact_details and it has returned. Call booking_step_fill_contact_details in this turn with courseType and workflowType. If it returns missingFields, ask the caller for those (iteratively); then call the tool again with the collected values. Only when the tool returns success with no missingFields may you mention payment. Do NOT ask for email or any contact details before calling the tool.`;
        responseInstructions = responseInstructions ? `${instruction}\n\n${responseInstructions}` : instruction;
        console.log(`🎯 [${callId}] Lookup contact completed - instructing to call booking_step_fill_contact_details next`);
        const reqCourseType = courseType || sessionStateManager.getSession(callSid)?.courseType;
        if (this.stateManager && reqCourseType) {
          const session = sessionStateManager.getSession(callSid);
          this.stateManager.pendingChainedToolCall = {
            toolName: 'booking_step_fill_contact_details',
            args: { courseType: reqCourseType, workflowType: workflowType || session?.workflowType || 'existing' }
          };
          console.log(`🎯 [${callId}] Pending recovery tool set (after lookup_contact) - will auto-run booking_step_fill_contact_details if model does not call it`);
        }
      }

      // Phase 5: After create_new_contact, call fill_contact_details next
      if (toolName === 'booking_step_create_new_contact' && toolResult?.success === true) {
        const instruction = `CRITICAL: booking_step_create_new_contact completed. Do not call it again. Call booking_step_fill_contact_details next. Collect all required contact details from the caller, then call the tool once with all parameters.`;
        responseInstructions = responseInstructions ? `${instruction}\n\n${responseInstructions}` : instruction;
        console.log(`🎯 [${callId}] Create new contact completed - instructing to call booking_step_fill_contact_details next`);
      }

      const isFillContactDetailsMissing = toolName === 'booking_step_fill_contact_details' &&
        toolResult?.success === true &&
        Array.isArray(toolResult?.missingFields) &&
        toolResult.missingFields.length > 0;
      if (isFillContactDetailsMissing) {
        const msg = toolResult.message || `I need your ${(toolResult.missingFields || []).join(', ')}; could you please provide them?`;
        const instruction = toolResult.instruction || `Ask the caller for ALL missing details using: "${msg}". Ask the caller to REPEAT each missing detail so you can confirm you have it correct. Do NOT read back or repeat the caller's personal details on the call (GDPR). Do NOT call booking_step_fill_contact_details again until you have every value. Then call it ONCE with all parameters: customerEmail, customerMobile, postcode, houseNumber, licenceHeld, nationalInsurance, drivingLicenceNumber (as applicable).`;
        responseInstructions = responseInstructions
          ? `${instruction}\n\n${responseInstructions}`
          : instruction;
        console.log(`🎯 [${callId}] Fill contact details incomplete - instructing to collect all missing then call once: ${toolResult.missingFields?.join(', ')}`);
      }

      // process_payment returned requiresPaymentMethod: agent must use booking_step_send_payment_request next, not process_payment again
      if (toolName === 'booking_step_process_payment' && toolResult?.requiresPaymentMethod === true) {
        const instruction = toolResult.instruction || `CRITICAL: Do NOT call booking_step_process_payment again. Ask the caller: "Would you like to receive the payment request via email or SMS?" When they answer, call **booking_step_send_payment_request** with deliveryMethod: "email" or "sms" (and courseType, workflowType, and clientEmail or clientMobile as needed).`;
        responseInstructions = responseInstructions
          ? `${instruction}\n\n${responseInstructions}`
          : instruction;
        console.log(`🎯 [${callId}] process_payment requiresPaymentMethod - instructing to call booking_step_send_payment_request next`);
      }

      // send_payment_request returned requiresConfirmation: agent must ask user to confirm email/phone, then call again with confirmed: true to click "Send by email now" and start polling
      if (toolName === 'booking_step_send_payment_request' && toolResult?.requiresConfirmation === true) {
        const instruction = toolResult.instruction || `CRITICAL: The payment request form is filled but not yet sent. Ask the caller to confirm the ${toolResult.deliveryMethod === 'sms' ? 'phone number' : 'email address'} (e.g. "Just to confirm, the payment request will be sent to ${toolResult.emailAddress || toolResult.phoneNumber || 'that address'}. Could you please confirm that this is correct?"). When they say yes, call **booking_step_send_payment_request** again with the SAME courseType, workflowType, deliveryMethod, clientEmail/clientMobile, and termsAcceptedBeforeSend: true, plus **confirmed: true**. Do NOT call without confirmed: true or the send button will not be clicked.`;
        responseInstructions = responseInstructions
          ? `${instruction}\n\n${responseInstructions}`
          : instruction;
        console.log(`🎯 [${callId}] send_payment_request requiresConfirmation - instructing to confirm with caller then call again with confirmed: true`);
      }

      // send_payment_request returned payment completed / booking finalized: agent MUST call send_confirmation, send_terms, send_sms in order (do not wait for caller)
      const isBookingFinalized = toolName === 'booking_step_send_payment_request' && toolResult?.success === true &&
        (toolResult?.paymentCompleted === true || toolResult?.bookingFinalized === true);
      if (isBookingFinalized) {
        const instruction = `CRITICAL: Booking is finalized. In this turn you MUST call **booking_step_send_confirmation**, then **booking_step_send_terms**, then **booking_step_send_sms** (in that order). Do not wait for the caller to ask—proceed automatically. Say a brief confirmation to the caller (e.g. "Your booking is complete. I'm sending your confirmation and details now.") then invoke these three tools in sequence.`;
        responseInstructions = responseInstructions
          ? `${instruction}\n\n${responseInstructions}`
          : instruction;
        console.log(`🎯 [${callId}] send_payment_request booking finalized - instructing to call send_confirmation, send_terms, send_sms in order`);
      }

      if (toolName === 'transfer_call' && toolResult?.allTransferNumbersFailed === true && toolResult?.messageForCaller) {
        const msg = toolResult.messageForCaller;
        const transferInstruction = `CRITICAL: The transfer could not be completed because all agents are busy. You MUST say exactly this to the caller: "${msg}" Then offer to help with anything else or end the call.`;
        responseInstructions = responseInstructions
          ? `${transferInstruction}\n\n${responseInstructions}`
          : transferInstruction;
        console.log(`🎯 [${callId}] Transfer all-occupied - instructing agent to say message to caller`);
      }

      // Transfer blocked by KBA while in booking after select_session (step 6): redirect to booking_step_select_booking_options
      const isTransferBlockedKBAInBookingStep6 = toolName === 'transfer_call' &&
        toolResult?.success === false &&
        (toolResult?.error === 'KBA_REQUIRED' || toolResult?.requiresKBA === true) &&
        conversations[callSid]?.workflowContext === 'booking' &&
        currentStep === 6;
      if (isTransferBlockedKBAInBookingStep6) {
        const kbaInstruction = `CRITICAL: The transfer could not be completed because identity verification is required. Do NOT offer to transfer again for this. Continue the booking flow: call **booking_step_select_booking_options** with courseType and workflowType from the current session, then ask the caller for bike type and list "125cc automatic, 50cc automatic, 125cc manual" as usual.`;
        responseInstructions = responseInstructions
          ? `${kbaInstruction}\n\n${responseInstructions}`
          : kbaInstruction;
        console.log(`🎯 [${callId}] Transfer blocked (KBA) - instructing to continue with booking_step_select_booking_options`);
        const reqCourseType = courseType || sessionStateManager.getSession(callSid)?.courseType;
        if (this.stateManager && reqCourseType) {
          const session = sessionStateManager.getSession(callSid);
          this.stateManager.pendingChainedToolCall = {
            toolName: 'booking_step_select_booking_options',
            args: { courseType: reqCourseType, workflowType: workflowType || session?.workflowType || 'existing' }
          };
        }
      }

      let forceNextToolChoice = null;
      const isRequiresToolRedirect = !!toolResult?.requiresTool;
      if (isRequiresToolRedirect) {
        forceNextToolChoice = toolResult.requiresTool;
        const session = sessionStateManager.getSession(callSid);
        const reqCourseType = courseType || session?.courseType;
        if (!reqCourseType) {
          console.warn(`⚠️ [${callId}] courseType not available for ${toolResult.requiresTool} - will be determined from booking`);
        }
        responseInstructions = `CRITICAL: You called a step out of order. SPEAK a short phrase like "Let me do that now." then IN THIS SAME RESPONSE invoke the tool ${toolResult.requiresTool} with courseType "${reqCourseType}". Do NOT output JSON or parameters as text—say words, then call the tool.`;
        console.log(`🎯 [${callId}] Wrong step - forcing required tool: ${toolResult.requiresTool}`);
        // Schedule automatic execution of correct tool if model does not call it (avoid waiting state)
        if (this.stateManager && reqCourseType) {
          const args = { courseType: reqCourseType, workflowType: session?.workflowType || 'existing' };
          if (forceNextToolChoice.startsWith('cancellation_step_')) {
            const bd = sessionStateManager.getBookingDetails(callSid) || session?.bookingDetails;
            if (bd?.courseDate) args.courseDate = bd.courseDate;
          }
          this.stateManager.pendingChainedToolCall = { toolName: forceNextToolChoice, args };
          console.log(`🎯 [${callId}] Pending recovery tool set - will auto-run ${forceNextToolChoice} if model does not call it`);
        }
      }

      const isVerifyBookingIntentProceed = !forceNextToolChoice && toolName === 'cancellation_step_verify_booking_intent' &&
        toolResult?.success === true &&
        toolResult?.proceedToStep2 === true &&
        toolResult?.nextStep === 'cancellation_step_authenticate';
      if (isVerifyBookingIntentProceed) {
        // courseType is required before Step 2 (collected in Step 1 before policy); never use TBD
        const authCourseType = courseType || sessionStateManager.getSession(callSid)?.courseType;
        if (!authCourseType || authCourseType === 'TBD') {
          console.error(`❌ [${callId}] courseType not available for chained cancellation_step_authenticate - ask for course type in Step 1 first`);
        } else {
          responseInstructions = `CRITICAL: Say exactly this out loud and then stop. Do not call any tools: "${AFTER_LOGIN_MESSAGE}"`;
          if (this.stateManager) {
            this.stateManager.pendingChainedToolCall = { toolName: 'cancellation_step_authenticate', args: { courseType: authCourseType } };
          }
          console.log(`🎯 [${callId}] Cancellation proceed to Step 2 - say-only then inject cancellation_step_authenticate (courseType: ${authCourseType})`);
        }
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

      // "Your booking options are successfully selected" is a non-waiting acknowledgment; register next response so response.done does not set waitingForUser
      if (toolName === 'booking_step_select_booking_options' && toolResult?.success === true) {
        progressIndicatorService.setExpectNonWaitingResponse(callSid);
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

