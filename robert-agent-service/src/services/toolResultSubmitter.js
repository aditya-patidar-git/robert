/**
 * Tool Result Submitter
 * Abstraction for submitting tool execution results
 * Supports both WebSocket (Media Streams) and HTTP (SIP) submission
 */

import promptService from './promptService.js';
import { conversations } from '../shared/state.js';
import { AFTER_LOGIN_MESSAGE, AFTER_DETERMINE_WORKFLOW_MESSAGE, AFTER_CONFIRM_CANCEL_MESSAGE, AFTER_FORM_OPENED_MESSAGE, AFTER_FORM_SUBMITTED_MESSAGE, BEAR_WITH_ME } from '../config/cancellationPhrases.js';
import sessionStateManager from './browser/sessionStateManager.js';
import progressIndicatorService from './progressIndicatorService.js';
import { getNextStepName } from './browser/stepConfiguration.js';
import { getLicenceHeldOptionsForPrompt } from './commonBookingSteps/index.js';

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
 * Premature question detection and response storage helpers.
 * Used when the agent asks for preferences (e.g. bike type) before invoking the relevant tool.
 */

/** Patterns that indicate a bike-type-related question (asked before booking_step_select_booking_options) */
const BIKE_TYPE_QUESTION_PATTERNS = [
  /\b(which|what)\s+(type\s+of\s+)?bike\b/i,
  /\bbike\s+(type|preference)\b/i,
  /\b125cc\s+automatic|50cc\s+automatic|125cc\s+manual\b/i,
  /\b(automatic|manual)\s+(or|and)\b/i,
  /\bwould you (like|prefer).*(125cc|50cc|automatic|manual)/i,
  /\bwhich.*(125cc|50cc|automatic|manual|scooter|geared)/i
];

/**
 * Detect if agent response contains premature questions (e.g. bike type before booking_step_select_booking_options).
 * @param {string} responseText - Full agent response text
 * @param {string} expectedTool - Tool that should be invoked before asking (e.g. 'booking_step_select_booking_options')
 * @param {Object} [context] - Optional context: { outputItems } to check if tool was called in same response
 * @returns {{ isPremature: boolean, type: string }|null} Premature question info or null
 */
export function detectPrematureQuestion(responseText, expectedTool, context = {}) {
  if (!responseText || typeof responseText !== 'string') return null;
  if (expectedTool !== 'booking_step_select_booking_options') return null;

  const outputItems = context.outputItems || [];
  const toolWasCalledInResponse = outputItems.some(
    item => item.type === 'function_call' && item.name === expectedTool
  );
  if (toolWasCalledInResponse) return null;

  const text = responseText.toLowerCase().trim();
  const hasBikeTypeQuestion = BIKE_TYPE_QUESTION_PATTERNS.some(p => p.test(text));
  if (!hasBikeTypeQuestion) return null;

  return { isPremature: true, type: 'bikeType', expectedTool };
}

/**
 * Store user response to a premature question in conversation state.
 * @param {string} callSid - Call SID
 * @param {string} responseText - User's transcribed response
 * @param {{ type: string, expectedTool: string }} prematureQuestion - From detectPrematureQuestion
 */
export function storePrematureResponse(callSid, responseText, prematureQuestion) {
  if (!callSid || !responseText || !prematureQuestion?.type) return;
  if (!conversations[callSid]) conversations[callSid] = {};
  if (!conversations[callSid].prematureResponses) conversations[callSid].prematureResponses = {};
  conversations[callSid].prematureResponses[prematureQuestion.type] = {
    responseText: (responseText || '').trim(),
    storedAt: Date.now(),
    expectedTool: prematureQuestion.expectedTool
  };
  console.log(`📝 [${callSid}] Stored premature response for ${prematureQuestion.type}: "${(responseText || '').slice(0, 60)}..."`);
}

/**
 * Match stored response against valid options (case-insensitive, flexible).
 * @param {string} callSid - Call SID
 * @param {string} preferenceType - e.g. 'bikeType'
 * @param {string[]} validOptions - Valid option strings (e.g. ['125cc automatic', '50cc automatic', '125cc manual'])
 * @returns {string|null} Matched valid option or null
 */
export function matchStoredResponse(callSid, preferenceType, validOptions) {
  if (!callSid || !preferenceType || !Array.isArray(validOptions) || validOptions.length === 0) return null;
  const stored = conversations[callSid]?.prematureResponses?.[preferenceType];
  if (!stored?.responseText) return null;

  const userText = stored.responseText.toLowerCase().trim();
  const normalizedOptions = validOptions.map(o => (o || '').toLowerCase().trim());

  for (let i = 0; i < normalizedOptions.length; i++) {
    const opt = normalizedOptions[i];
    if (userText === opt) return validOptions[i];
    if (userText.includes(opt) || opt.includes(userText)) return validOptions[i];
  }
  if (/^(125|50)\s*cc\s+automatic$/i.test(userText)) return userText.includes('50') ? '50cc automatic' : '125cc automatic';
  if (/^(125|50)\s*cc\s+manual$/i.test(userText)) return '125cc manual';
  if (/\bautomatic\b/i.test(userText) && !/\bmanual\b/i.test(userText)) {
    if (/\b50\b/i.test(userText)) return '50cc automatic';
    return '125cc automatic';
  }
  if (/\bmanual\b/i.test(userText) && /\b125\b/i.test(userText)) return '125cc manual';

  return null;
}

/**
 * Clear stored response after use.
 * @param {string} callSid - Call SID
 * @param {string} preferenceType - e.g. 'bikeType'
 */
export function clearStoredResponse(callSid, preferenceType) {
  if (!callSid || !conversations[callSid]?.prematureResponses) return;
  delete conversations[callSid].prematureResponses[preferenceType];
  console.log(`🗑️ [${callSid}] Cleared stored premature response for ${preferenceType}`);
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

    // Barge-in: skip TTS when user interrupted; tool result is already in conversation and model context
    if (this.stateManager?.isInterrupted === true) {
      console.log(`ℹ️ [${callId}] Skipping response creation - user interrupted (barge-in); tool result already in conversation`);
      return;
    }

    const toolResult = options?.toolResult;
    const isPriorityResult = toolResult && (
      toolResult.requiresConfirmation === true ||
      toolResult.requiresPreferences === true ||
      toolResult.requiresTermsBeforeSend === true ||
      toolResult.requiresPaymentMethod === true ||
      (Array.isArray(toolResult.missingFields) && toolResult.missingFields.length > 0)
    );

    // No longer waiting for acknowledgments - they have been removed

    // Retry configuration: allow time for periodic holding response to finish so tool result can be spoken
    const MAX_RETRIES = 10;
    const RETRY_DELAY_MS = 400; // Wait 400ms between retries (holding message may still be playing)

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

      console.error(`❌ [${callId}] Failed to acquire response lock after ${MAX_RETRIES} attempts. Final state: ${finalLockReason}.`);
      console.warn(`⚠️ [${callId}] Force-releasing stuck lock to ensure tool result is spoken. Tool: ${options?.toolName || 'unknown'}`);

      if (this.stateManager) {
        this.stateManager.forceReleaseResponseLock();
        lockAcquired = this.stateManager.tryAcquireResponseLock();

        if (!lockAcquired) {
          console.error(`❌ [${callId}] Force-release failed. Agent will wait for user input instead of automatically continuing.`);
          this.stateManager.clearToolExecutionCompleting();
          return;
        }
        console.log(`✅ [${callId}] Force-release succeeded - proceeding with tool result response`);
      } else {
        return;
      }
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

      // Search client: missing customerMobile/customerEmail/customerName — instruct to call in same turn if caller just gave it, else ask once
      const isSearchClientRequiredParamError = (toolName === 'booking_step_search_client' || toolName === 'cancellation_step_search_client') &&
        toolResult && toolResult.success === false &&
        String(toolResult.error || '').includes('is required for client search');
      if (isSearchClientRequiredParamError) {
        const searchToolName = toolName === 'cancellation_step_search_client' ? 'cancellation_step_search_client' : 'booking_step_search_client';
        const searchClientParamInstruction = `CRITICAL: The caller must provide a search key (mobile, email, or name). If they just said their mobile number, email, or name in this or the previous turn, call **${searchToolName}** in THIS SAME RESPONSE with customerMobile, customerEmail, or customerName set to that value (UK mobile: 11 digits starting with 07). Do NOT say "let me do that" or "I'll enter it now" and then wait—call the tool now. If you do not have the value, ask one short question (e.g. "Could you say your mobile number again?") and then call the tool when they respond.`;
        responseInstructions = responseInstructions
          ? `${searchClientParamInstruction}\n\n${responseInstructions}`
          : searchClientParamInstruction;
        console.log(`🎯 [${callId}] Search client missing param - instructing to call in same turn if value from caller, else ask once`);
      }

      // Step tool parameter/validation failure: instruct to resolve (ask user or use context) and retry, do NOT offer transfer (skip when search_client required-param already handled)
      const isStepToolParamError = !isSearchClientRequiredParamError && toolName && (toolName.startsWith('booking_step_') || toolName.startsWith('cancellation_step_')) &&
        toolResult && toolResult.success === false && toolResult.error &&
        /Validation failed|Required|Invalid parameters|missing|courseType/i.test(toolResult.error);
      if (isStepToolParamError) {
        const paramErrorInstruction = `CRITICAL: This is a missing or invalid parameter error for a booking/cancellation step—NOT a technical failure. Do NOT offer to transfer the caller to a human agent for this. First try to resolve it: (1) If you have the missing detail from context (e.g. agreedSlot, course type from the conversation or session), call the same step again with the correct parameters. (2) If you need the detail from the caller, ask one short question (e.g. "Which course is this for—Introduction to Motorcycling or CBT?"), then call the same step again with the correct parameters. Only offer transfer if you cannot resolve after trying.`;
        responseInstructions = responseInstructions
          ? `${paramErrorInstruction}\n\n${responseInstructions}`
          : paramErrorInstruction;
        console.log(`🎯 [${callId}] Step tool parameter/validation error - instructing to resolve and retry, not transfer`);
      }

      // Step execution failure (timeout or retriable): offer to retry or restart workflow
      const isStepExecutionFailure = toolName && (toolName.startsWith('booking_step_') || toolName.startsWith('cancellation_step_')) &&
        toolResult && toolResult.success === false &&
        (toolResult.canRetry === true || /timeout|exceeded|failed/i.test(toolResult.error || ''));
      if (isStepExecutionFailure) {
        const failureInstruction = `CRITICAL: This step failed (e.g. timeout or temporary error). Briefly acknowledge what happened (e.g. "That step took too long" or "Something didn't complete in time"). Then offer the caller two options: (1) "I can try that step again" — if they agree, call the same step again with the same parameters. (2) "Or we can start over from the beginning" — if they say start over, restart, or from the beginning, the system will reset and you can begin the booking/cancellation flow again. Do not transfer to a human unless the caller explicitly asks for it or both retry and start-over fail.`;
        responseInstructions = responseInstructions
          ? `${failureInstruction}\n\n${responseInstructions}`
          : failureInstruction;
        console.log(`🎯 [${callId}] Step execution failure (timeout/retriable) - instructing to offer retry or start over`);
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
        // Mismatch (wrong value for fullName, postcode, or telephoneNumber): say ONLY the mismatch message; do NOT repeat generic verification prompt
        if (toolResult && Array.isArray(toolResult.mismatches) && toolResult.mismatches.length > 0) {
          const mismatchInstruction = `CRITICAL: The caller gave a value that does NOT match our records (mismatched field(s): ${toolResult.mismatches.join(', ')}). You MUST NOT say "Thanks for this; I believe that I have found your profile" or "please confirm your full name" or "please confirm your postcode" or "please confirm your telephone number". Say ONLY the following exact message, then ask the caller to provide the correct value again: "${toolResult.message}". Do not add any other verification or confirmation sentence after the mismatch message. Then call client_verification again with the field(s) when the caller provides the correct value (use fullName/postcode from previous tool result if already verified; add ONLY the new value the caller spoke). Do NOT pass postcode or telephoneNumber from stored clientDetails—only use what the caller actually says.`;
          responseInstructions = responseInstructions
            ? `${mismatchInstruction}\n\n${responseInstructions}`
            : mismatchInstruction;
          console.log(`🎯 [${callId}] Client verification MISMATCH (wrong value) - instructing to say ONLY mismatch message, not generic prompt: ${toolResult.mismatches.join(', ')}`);
        } else if (toolResult && !toolResult.verified && toolResult.missingFields) {
          // Verification incomplete (field not yet provided) - agent must continue asking for missing fields
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

      // Phase 0: After check_availability (step 1), present ONLY slots from tool result; do NOT invent slots; IMMEDIATELY call authenticate after slot confirmation
      if (toolName === 'booking_step_check_availability' && toolResult?.success === true) {
        const slotsFromTool = toolResult?.message ? ` Tool result message: "${toolResult.message}"` : '';
        const instruction = `CRITICAL: booking_step_check_availability just returned the exact slots to present. You MUST read the slot list from the tool result verbatim—do NOT paraphrase, infer, or substitute any date, time, or location. Do NOT invent or add any slots; present ONLY what appears after "Slots to present:" in the tool result message.${slotsFromTool}

MANDATORY WORKFLOW: When the caller confirms the slot (e.g. "yes", "okay go ahead", "proceed"), you MUST call booking_step_authenticate with agreedSlot (slot from tool result) in that same turn. booking_step_authenticate is CRM system login only—it does NOT mean asking the caller for their name or email. Do NOT ask for full name, email, or any contact details. Confirm the slot and call the tool.`;
        responseInstructions = responseInstructions ? `${instruction}\n\n${responseInstructions}` : instruction;
        console.log(`🎯 [${callId}] Check availability completed - instructing to present ONLY tool result slots (verbatim), then IMMEDIATELY call booking_step_authenticate; no contact questions`);
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
        const instruction = `CRITICAL: booking_step_select_session completed. The UI is still on the diaries tab—the booking options tab opens only when you call booking_step_select_booking_options. 

ABSOLUTE REQUIREMENT: In your response, you MUST:
1. Say ONLY a brief confirmation (e.g. "Session selected. Proceeding to booking options." or "Got it, proceeding.") 
2. DO NOT mention bike type, bike preference, automatic/manual, 125cc, 50cc, or any booking options in your response AT ALL
3. DO NOT ask "what type of bike" or "which bike type would you prefer" or any variation
4. DO NOT say "Now let's move on to selecting your booking options" followed by asking about bike type
5. IMMEDIATELY call **booking_step_select_booking_options** with courseType and workflowType from the current session in this same turn

Only AFTER booking_step_select_booking_options returns may you ask for bike type. After the caller says their choice, call **booking_step_select_booking_options** again with courseType, workflowType, and **bikeType** (e.g. bikeType: "125cc automatic")—do NOT use selectedOptions. There is NO tool named booking_step_finalize_booking, booking_step_finalize_course_options, or booking_step_select_options. After options are set, use booking_step_lookup_contact (existing) or booking_step_create_new_contact (new), then booking_step_fill_contact_details.`;
        responseInstructions = responseInstructions ? `${instruction}\n\n${responseInstructions}` : instruction;
        console.log(`🎯 [${callId}] Select session completed - STRICT instruction: do NOT mention bike type in response, call booking_step_select_booking_options immediately`);
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

      // When select_booking_options returns requiresPreferences (e.g. missing bikeType), check for stored premature response first
      const isSelectBookingOptionsRequiresPrefs = toolName === 'booking_step_select_booking_options' && toolResult?.requiresPreferences === true;
      if (isSelectBookingOptionsRequiresPrefs) {
        const validBikeTypes = toolResult?.validOptions?.bikeType || ['125cc automatic', '50cc automatic', '125cc manual'];
        const matchedBikeType = matchStoredResponse(callSid, 'bikeType', validBikeTypes);

        if (matchedBikeType) {
          clearStoredResponse(callSid, 'bikeType');
          const instruction = `CRITICAL: The caller already told you their bike type: "${matchedBikeType}". Do NOT ask again. Call **booking_step_select_booking_options** immediately with courseType, workflowType, and bikeType: "${matchedBikeType}".`;
          responseInstructions = responseInstructions ? `${instruction}\n\n${responseInstructions}` : instruction;
          this.stateManager.pendingChainedToolCall = {
            toolName: 'booking_step_select_booking_options',
            args: {
              courseType: courseType || sessionStateManager.getSession(callSid)?.courseType,
              workflowType: workflowType || sessionStateManager.getSession(callSid)?.workflowType || 'existing',
              bikeType: matchedBikeType
            }
          };
          console.log(`🎯 [${callId}] Select booking options requires preferences - using stored bikeType: "${matchedBikeType}"`);
        } else {
          const noRepeatInstruction = `CRITICAL: The tool needs the caller's bike type preference. If you already asked for bike type in your previous message, do NOT ask again—wait for the caller's answer. If you have not asked yet, ask once using the message below and list the three options (125cc automatic, 50cc automatic, 125cc manual).`;
          responseInstructions = responseInstructions ? `${noRepeatInstruction}\n\n${responseInstructions}` : noRepeatInstruction;
          console.log(`🎯 [${callId}] Select booking options requires preferences (e.g. bikeType) - instructing to ask once only, do not repeat`);
        }
      }

      // Handle validation errors gracefully - when bikeType is invalid (e.g., "automatic" instead of "125cc automatic")
      const isSelectBookingOptionsValidationError = toolName === 'booking_step_select_booking_options' && toolResult?.success === false && toolResult?.error && toolResult.error.includes('Invalid enum value');
      if (isSelectBookingOptionsValidationError) {
        const gracefulErrorInstruction = `CRITICAL: The bike type provided was not specific enough. The caller said something like "automatic" but the system needs the full option. Gracefully explain: "I need a bit more detail. For the Introduction to Motorcycling course, please choose one of: 125cc automatic, 50cc automatic, or 125cc manual." Then wait for their response and call booking_step_select_booking_options again with the correct bikeType value. Do NOT repeat the error message verbatim—handle it conversationally.`;
        responseInstructions = responseInstructions ? `${gracefulErrorInstruction}\n\n${responseInstructions}` : gracefulErrorInstruction;
        console.log(`🎯 [${callId}] Select booking options validation error - instructing graceful handling`);
      }

      // Phase 3: After select_booking_options (or alias e.g. booking_step_finalize), call lookup_contact (existing) or create_new_contact (new) next
      const bookingOptionsAliases = ['booking_step_finalize', 'booking_step_finalize_booking', 'booking_step_finalize_course_options', 'booking_step_select_options', 'booking_step_booking_options'];
      const isSelectBookingOptionsCompleted = (toolName === 'booking_step_select_booking_options' || bookingOptionsAliases.includes(toolName)) && toolResult?.success === true;
      if (isSelectBookingOptionsCompleted) {
        const wt = workflowType || conversations[callSid]?.bookingSession?.workflowType;
        const instruction = wt === 'new'
          ? `CRITICAL: Do not call booking_step_select_booking_options again. Say only a brief confirmation (e.g. "Your booking options are successfully selected."). Do NOT mention "contact details" or "finalize your contact details". Do not ask any questions. Do NOT ask for name, email, phone, or any contact detail on this page or before the contact details page has loaded (i.e. before booking_step_fill_contact_details has been called and returned). Call booking_step_create_new_contact next with courseType and workflowType: "new". Then immediately call booking_step_fill_contact_details.`
          : `CRITICAL: Do not call booking_step_select_booking_options again. Say ONLY 2-5 words (e.g. "Options set." or "Done."). Do NOT say any other sentence or list next steps. Do NOT say the booking is confirmed, that they are all set, or that the booking is complete—payment has not been done yet. Do NOT ask for name, email, phone, or any contact detail on this page or before the contact details page has loaded (i.e. before booking_step_fill_contact_details has been called and returned). Then call booking_step_lookup_contact with courseType and workflowType: "existing". This step is silent (no questions)—do not ask about contact until booking_step_fill_contact_details has run and returned missingFields.`;
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

      // Phase 5: After create_new_contact, call fill_contact_details next (set chained tool so we don't go to waiting state if model doesn't call it in same turn)
      if (toolName === 'booking_step_create_new_contact' && toolResult?.success === true) {
        const instruction = `CRITICAL: booking_step_create_new_contact completed. Do not call it again. In this same response call booking_step_fill_contact_details FIRST with only courseType and workflowType (no contact parameters). Do NOT say you will check which details are needed; call the tool first. Do NOT ask for name, email, or phone before that call. After it returns missingFields, collect ONLY those missing fields—each with double confirmation (ask → repeat to verify; if no match, ask once more and take as final)—then call booking_step_fill_contact_details ONCE with ALL parameters.`;
        responseInstructions = responseInstructions ? `${instruction}\n\n${responseInstructions}` : instruction;
        const reqCourseType = courseType || sessionStateManager.getSession(callSid)?.courseType;
        if (this.stateManager && reqCourseType) {
          this.stateManager.pendingChainedToolCall = {
            toolName: 'booking_step_fill_contact_details',
            args: { courseType: reqCourseType, workflowType: 'new' }
          };
          console.log(`🎯 [${callId}] Create new contact completed - instructing to call booking_step_fill_contact_details next`);
          console.log(`🎯 [${callId}] Pending recovery tool set (after create_new_contact) - will auto-run booking_step_fill_contact_details if model does not call it`);
        } else {
          console.log(`🎯 [${callId}] Create new contact completed - instructing to call booking_step_fill_contact_details next`);
        }
      }

      const isFillContactDetailsMissing = toolName === 'booking_step_fill_contact_details' &&
        toolResult?.success === true &&
        Array.isArray(toolResult?.missingFields) &&
        toolResult.missingFields.length > 0;
      if (isFillContactDetailsMissing) {
        const msg = toolResult.message || `I need your ${(toolResult.missingFields || []).join(', ')}; could you please provide them?`;
        let instruction = toolResult.instruction || `Ask the caller for ALL missing details using: "${msg}". For each required detail use a two-step pattern: (1) ask for the detail; (2) when the caller gives it, your NEXT turn MUST be to ask them to repeat that same detail to cross-verify (e.g. "Could you please repeat that so I can confirm I have it correct?"). Only after they repeat, ask for the next detail. Do NOT move to the next question until the current one has been repeated and verified. STRICTLY (GDPR): Never say the caller's postcode, address, name, phone number, email, NI number, or any other personal detail aloud. Do not say "X is confirmed" or recite the value to confirm—ask them to repeat it; do not recite it yourself. Do NOT call booking_step_fill_contact_details again until you have every value. Then call it ONCE with all parameters: customerEmail, customerMobile, postcode, houseNumber, licenceHeld, nationalInsurance, drivingLicenceNumber (as applicable).`;
        if (toolResult.missingFields?.includes('licenceHeld')) {
          const optionsList = getLicenceHeldOptionsForPrompt();
          instruction += ` For licence type (licenceHeld): list these exact options and ask the caller to choose one: ${optionsList}. Pass the exact option text they choose as licenceHeld—do not guess from vague terms like "motorcycle".`;
        }
        responseInstructions = responseInstructions
          ? `${instruction}\n\n${responseInstructions}`
          : instruction;
        console.log(`🎯 [${callId}] Fill contact details incomplete - instructing to collect all missing then call once: ${toolResult.missingFields?.join(', ')}`);
      }

      // Phase 6: After fill_contact_details completes successfully (no missingFields), call process_payment in the same turn—do not wait for caller
      const isFillContactDetailsComplete = toolName === 'booking_step_fill_contact_details' &&
        toolResult?.success === true &&
        (!Array.isArray(toolResult?.missingFields) || toolResult.missingFields.length === 0);
      if (isFillContactDetailsComplete) {
        const partialFill = toolResult?.partialFill === true || (Array.isArray(toolResult?.skippedFields) && toolResult.skippedFields.length > 0);
        const instruction = partialFill
          ? `CRITICAL: booking_step_fill_contact_details completed (some fields could not be filled, e.g. ${(toolResult.skippedFields || []).join(', ')}). Do NOT say "booking confirmed", "you're all set", or "everything is in place". Say ONLY a brief line (e.g. "Proceeding to payment.") and IMMEDIATELY call **booking_step_process_payment** with courseType and workflowType. Do not ask any questions—call the tool in this same response.`
          : `CRITICAL: booking_step_fill_contact_details completed. Do NOT wait for the caller to say "proceed". In this turn say ONLY a brief confirmation (e.g. "Contact details done. Proceeding to payment.") and IMMEDIATELY call **booking_step_process_payment** with courseType and workflowType. Do not ask any questions—call the tool in this same response.`;
        responseInstructions = responseInstructions ? `${instruction}\n\n${responseInstructions}` : instruction;
        const reqCourseType = courseType || sessionStateManager.getSession(callSid)?.courseType;
        if (this.stateManager && reqCourseType) {
          const session = sessionStateManager.getSession(callSid);
          this.stateManager.pendingChainedToolCall = {
            toolName: 'booking_step_process_payment',
            args: { courseType: reqCourseType, workflowType: workflowType || session?.workflowType || 'existing' }
          };
          console.log(`🎯 [${callId}] Fill contact details completed - instructing to call booking_step_process_payment in same turn; pending recovery tool set`);
        } else {
          console.log(`🎯 [${callId}] Fill contact details completed - instructing to call booking_step_process_payment in same turn`);
        }
      }

      // process_payment returned requiresPaymentMethod: agent MUST ask the question in THIS response (do not say "let me proceed" and then wait)
      if (toolName === 'booking_step_process_payment' && toolResult?.requiresPaymentMethod === true) {
        const instruction = toolResult.instruction || `CRITICAL: Do NOT call booking_step_process_payment again. In THIS response you MUST ask the caller exactly: "Would you like to receive the payment request via email or SMS?" Do NOT say "I'll call the correct step" or "Let me proceed" and then wait—ask the question now. When they answer (email or SMS), call **booking_step_send_payment_request** with deliveryMethod: "email" or "sms", plus courseType, workflowType, and clientEmail or clientMobile as needed.`;
        responseInstructions = responseInstructions
          ? `${instruction}\n\n${responseInstructions}`
          : instruction;
        console.log(`🎯 [${callId}] process_payment requiresPaymentMethod - instructing to ask email/SMS question in this response, then call send_payment_request`);
      }

      // send_payment_request returned requiresClientEmail: agent must ask caller for email, then call again with clientEmail
      if (toolName === 'booking_step_send_payment_request' && toolResult?.requiresClientEmail === true) {
        const instruction = toolResult.instruction || `CRITICAL: Ask the caller: "What email address should I send the payment link to?" When they give it, call **booking_step_send_payment_request** again with the same parameters (courseType, workflowType, deliveryMethod: "email", termsAcceptedBeforeSend as before) and **clientEmail** set to the address they said. Do not use a different tool.`;
        responseInstructions = responseInstructions
          ? `${instruction}\n\n${responseInstructions}`
          : instruction;
        console.log(`🎯 [${callId}] send_payment_request requiresClientEmail - instructing to ask caller for email then call again with clientEmail`);
      }

      // send_payment_request returned requiresClientMobile (SMS): agent must ask caller for mobile, then call again with clientMobile
      if (toolName === 'booking_step_send_payment_request' && toolResult?.requiresClientMobile === true) {
        const instruction = toolResult.instruction || `CRITICAL: Ask the caller: "What mobile number should I send the payment link to?" When they give it, call **booking_step_send_payment_request** again with the same parameters (courseType, workflowType, deliveryMethod: "sms", termsAcceptedBeforeSend as before) and **clientMobile** set to the number they said. Do not use a different tool.`;
        responseInstructions = responseInstructions
          ? `${instruction}\n\n${responseInstructions}`
          : instruction;
        console.log(`🎯 [${callId}] send_payment_request requiresClientMobile - instructing to ask caller for mobile then call again with clientMobile`);
      }

      // send_payment_request returned requiresConfirmation: agent must ask user to confirm email/phone, then call again with confirmed: true to click "Send by email now" and start polling
      if (toolName === 'booking_step_send_payment_request' && toolResult?.requiresConfirmation === true) {
        const instruction = toolResult.instruction || `CRITICAL — CORRECT TOOL NAME ONLY: When the caller confirms the ${toolResult.deliveryMethod === 'sms' ? 'phone number' : 'email address'}, you MUST call **booking_step_send_payment_request** again (the SAME tool, not any other). Use the exact name: booking_step_send_payment_request. Pass the SAME parameters: courseType, workflowType, deliveryMethod, clientEmail or clientMobile, termsAcceptedBeforeSend: true, and you MUST add **confirmed: true**. Do NOT call a tool named "booking_step_confirm_payment_request"—that tool does not exist. Only **booking_step_send_payment_request** with confirmed: true will click "Send by email now" / "Send by SMS" and send the link. Ask the caller: "Just to confirm, the payment request will be sent to ${toolResult.emailAddress || toolResult.phoneNumber || 'that address'}. Could you please confirm that this is correct?" When they say yes, invoke **booking_step_send_payment_request** with confirmed: true.`;
        responseInstructions = responseInstructions
          ? `${instruction}\n\n${responseInstructions}`
          : instruction;
        console.log(`🎯 [${callId}] send_payment_request requiresConfirmation - instructing to confirm with caller then call again with confirmed: true (emphasizing correct tool: booking_step_send_payment_request only)`);
      }

      // send_sms returned requiresClientMobile: agent must ask caller for mobile, then call again with customerMobile
      if (toolName === 'booking_step_send_sms' && toolResult?.requiresClientMobile === true) {
        const instruction = toolResult.instruction || `CRITICAL: Ask the caller: "What mobile number should I send the SMS confirmation to?" When they give it, call **booking_step_send_sms** again with the same courseType and workflowType and **customerMobile** set to the number they said. Do not use a different tool.`;
        responseInstructions = responseInstructions
          ? `${instruction}\n\n${responseInstructions}`
          : instruction;
        console.log(`🎯 [${callId}] send_sms requiresClientMobile - instructing to ask caller for mobile then call again with customerMobile`);
      }

      // send_payment_request returned payment completed / booking finalized: run send_confirmation → send_terms → send_sms automatically via chained tools (no waiting for user)
      const isBookingFinalized = toolName === 'booking_step_send_payment_request' && toolResult?.success === true &&
        (toolResult?.paymentCompleted === true || toolResult?.bookingFinalized === true);
      if (isBookingFinalized) {
        const instruction = `CRITICAL: Booking is finalized. Say ONLY a brief confirmation to the caller (e.g. "Your booking is complete. I'm sending your confirmation and details now."). Do NOT wait for the caller to respond. The system will automatically send the confirmation email, terms, and SMS. Do not call any tools in this response.`;
        responseInstructions = responseInstructions
          ? `${instruction}\n\n${responseInstructions}`
          : instruction;
        console.log(`🎯 [${callId}] send_payment_request booking finalized - setting chained tools: send_confirmation → send_terms → send_sms`);
        if (callSid && this.stateManager && (courseType || sessionStateManager.getSession(callSid)?.courseType)) {
          const chainArgs = { courseType: courseType || sessionStateManager.getSession(callSid)?.courseType, workflowType: workflowType || sessionStateManager.getSession(callSid)?.workflowType || 'existing' };
          // Pass customerMobile for booking_step_send_sms when available (recipient email is from booking context for send_confirmation/send_terms)
          const customerMobile = toolResult?.phoneNumber || conversations[callSid]?.clientDetails?.telephoneNumber;
          if (customerMobile) chainArgs.customerMobile = customerMobile;
          if (!conversations[callSid]) conversations[callSid] = {};
          conversations[callSid].postBookingFinalizedChain = ['booking_step_send_terms', 'booking_step_send_sms'];
          conversations[callSid].postBookingFinalizedChainArgs = chainArgs;
          this.stateManager.pendingChainedToolCall = { toolName: 'booking_step_send_confirmation', args: chainArgs };
        }
      }

      // After send_confirmation or send_terms completes, set next in post-booking chain so it runs automatically (no user input)
      const isPostBookingChainedStep = (toolName === 'booking_step_send_confirmation' || toolName === 'booking_step_send_terms') &&
        callSid && conversations[callSid]?.postBookingFinalizedChain?.length > 0 && this.stateManager;
      if (isPostBookingChainedStep) {
        const chain = conversations[callSid].postBookingFinalizedChain;
        const chainArgs = conversations[callSid].postBookingFinalizedChainArgs || { courseType: courseType || sessionStateManager.getSession(callSid)?.courseType, workflowType: workflowType || sessionStateManager.getSession(callSid)?.workflowType || 'existing' };
        const nextTool = chain.shift();
        conversations[callSid].postBookingFinalizedChain = chain.length ? chain : undefined;
        if (!chain.length) {
          delete conversations[callSid].postBookingFinalizedChainArgs;
        }
        this.stateManager.pendingChainedToolCall = { toolName: nextTool, args: chainArgs };
        console.log(`🎯 [${callId}] Post-booking chain: next automatic step ${nextTool}`);
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

      const isDetermineWorkflowProceed = !forceNextToolChoice && toolName === 'cancellation_step_determine_workflow' &&
        toolResult?.success === true &&
        toolResult?.nextStep === 'cancellation_step_navigate_contacts';
      if (isDetermineWorkflowProceed) {
        const navCourseType = courseType || sessionStateManager.getSession(callSid)?.courseType;
        const validCourseType = navCourseType && navCourseType !== 'TBD';
        if (!validCourseType) {
          console.error(`❌ [${callId}] courseType not available or TBD for chained cancellation_step_navigate_contacts - skipping`);
        } else {
          responseInstructions = `CRITICAL: Say exactly this out loud and then stop. Do not call any tools: "${AFTER_DETERMINE_WORKFLOW_MESSAGE}"`;
          if (this.stateManager) {
            this.stateManager.pendingChainedToolCall = { toolName: 'cancellation_step_navigate_contacts', args: { courseType: navCourseType, workflowType: 'existing' } };
          }
          console.log(`🎯 [${callId}] Cancellation Step 3 done - say-only then inject cancellation_step_navigate_contacts (courseType: ${navCourseType})`);
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

      const isSelectTemplateProceed = !forceNextToolChoice && toolName === 'cancellation_step_select_template' &&
        toolResult?.success === true &&
        (toolResult?.templateSelected === true || toolResult?.templateSelected === undefined);
      if (isSelectTemplateProceed) {
        const sendCourseType = courseType || sessionStateManager.getSession(callSid)?.courseType;
        const validCourseType = sendCourseType && sendCourseType !== 'TBD';
        if (!validCourseType) {
          console.error(`❌ [${callId}] courseType not available or TBD for chained cancellation_step_send_confirmation - skipping`);
        } else {
          responseInstructions = `CRITICAL: Say exactly this out loud and then stop. Do not call any tools: "${AFTER_FORM_SUBMITTED_MESSAGE}"`;
          if (this.stateManager) {
            this.stateManager.pendingChainedToolCall = { toolName: 'cancellation_step_send_confirmation', args: { courseType: sendCourseType, workflowType: 'existing' } };
          }
          console.log(`🎯 [${callId}] Template selected - say-only then inject cancellation_step_send_confirmation (courseType: ${sendCourseType})`);
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
        const chained = isVerifyBookingIntentProceed || isConfirmCancellationProceed || isInitiateCancellationProceed || isFillCancellationFormProceed || isNavigateCommunicationProceed || isSelectTemplateProceed;
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

