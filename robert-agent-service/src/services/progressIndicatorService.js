/**
 * Progress Indicator Service
 * Provides feedback to callers during long-running tool operations
 */

import { conversations } from '../shared/state.js';

/** Per-tool messages for immediate tool-start acknowledgments (create booking workflow). Short phrases to minimize race conditions and prioritize tool results. */
const BOOKING_STEP_TOOL_START_MESSAGES = {
  booking_step_check_availability: 'Checking availability.',
  booking_step_authenticate: 'Logging in.',
  booking_step_navigate_contacts: 'Opening contacts.',
  booking_step_search_client: 'Finding your client.',
  booking_step_select_session: 'Selecting session.',
  booking_step_select_booking_options: 'Loading options.',
  booking_step_lookup_contact: 'Looking up contact.',
  booking_step_create_new_contact: 'Adding new contact.',
  booking_step_fill_contact_details: 'Filling details.',
  booking_step_process_payment: 'Processing payment.',
  booking_step_send_payment_request: 'Sending payment link.',
  booking_step_send_confirmation: 'Sending confirmation.',
  booking_step_send_terms: 'Sending terms.',
  booking_step_send_sms: 'Sending SMS.'
};

class ProgressIndicatorService {
  constructor() {
    this.activeExecutions = new Map(); // callSid -> { toolName, startTime, acknowledgmentSent, lastUpdateTime, updateInterval }
    this.holdingResponseIds = new Map(); // callSid -> Set of responseId (acknowledgments/periodic updates; do not set waitingForUser when these complete)
    this.expectNonWaitingResponseCallSids = new Set(); // callSids for which the next response.created should be registered as non-waiting (e.g. "Your booking options are successfully selected")
  }

  /**
   * Get the tool-start acknowledgment message for create-booking steps (booking_step_*).
   * Returns null for payment steps to avoid race: only one response.create in flight so
   * response.done does not wrongly set waitingForUser; the agent's reply from triggerResponse provides the message.
   * Returns null for check_availability so no ack is sent until the tool returns—avoids agent suggesting imaginary slots.
   * @param {string} toolName - Name of the tool
   * @returns {string|null} - Message to speak, or null if not a booking step or no message defined (or payment/availability step)
   */
  getToolStartMessage(toolName) {
    if (!toolName || !toolName.startsWith('booking_step_')) {
      return null;
    }
    // Skip immediate ack for payment steps to avoid race with triggerResponse (Option A)
    if (toolName === 'booking_step_process_payment' || toolName === 'booking_step_send_payment_request') {
      return null;
    }
    // Skip ack for availability: no message until tool returns to prevent agent suggesting imaginary slots
    if (toolName === 'booking_step_check_availability') {
      return null;
    }
    return BOOKING_STEP_TOOL_START_MESSAGES[toolName] || null;
  }

  /**
   * Check if a tool is a step-based booking tool
   * @param {string} toolName - Name of the tool
   * @returns {boolean} - True if it's a step-based tool
   */
  isStepBasedTool(toolName) {
    // Step-based tools start with "booking_step_"
    return toolName && toolName.startsWith('booking_step_');
  }

  /**
   * Check if periodic updates should be enabled for a tool
   * Only specific long-running browser automation tools should have periodic updates
   * @param {string} toolName - Name of the tool
   * @returns {boolean} - True if periodic updates should be enabled
   */
  shouldEnablePeriodicUpdates(toolName) {
    // Only enable periodic updates for specific long-running navigation operations:
    // Booking workflow:
    // 1. booking_step_search_client - navigates from client search page to client verification page
    // 2. booking_step_select_session - navigates after client verification page to selectBookingOptions page
    // 3. booking_step_lookup_contact - looks up existing client contact (existing workflow only)
    // 4. booking_step_create_new_contact - creates new client contact (new workflow only)
    // 5. booking_step_fill_contact_details - fills contact details form and checks for missing fields sequentially
    // 6. booking_step_send_confirmation - sends booking confirmation email
    // 7. booking_step_send_terms - sends terms and conditions email
    // 8. booking_step_send_sms - sends SMS confirmation
    // Cancellation workflow:
    // 9. cancellation_step_search_client - searches for client with fallback logic
    // 10. cancellation_step_locate_booking - finds booking in client profile
    // 11. cancellation_step_fill_cancellation_form - fills cancellation form fields
    // 12. cancellation_step_send_confirmation - sends cancellation confirmation email
    return toolName === 'booking_step_search_client' 
      || toolName === 'booking_step_select_session' 
      || toolName === 'booking_step_lookup_contact'
      || toolName === 'booking_step_create_new_contact'
      || toolName === 'booking_step_fill_contact_details'
      || toolName === 'booking_step_send_confirmation'
      || toolName === 'booking_step_send_terms'
      || toolName === 'booking_step_send_sms'
      || toolName === 'cancellation_step_search_client'
      || toolName === 'cancellation_step_locate_booking'
      || toolName === 'cancellation_step_fill_cancellation_form'
      || toolName === 'cancellation_step_send_confirmation';
  }

  /**
   * Start tracking a tool execution
   * @param {string} callSid - Call SID
   * @param {string} toolName - Name of the tool being executed
   * @param {CallStateManager|null} stateManager - Optional state manager for response state checks
   */
  startToolExecution(callSid, toolName, stateManager = null) {
    // CRITICAL RACE CONDITION FIX: Clear any existing completion flag when starting new tool
    // This ensures we don't carry over a stuck flag from a previous tool execution
    if (stateManager && stateManager.toolExecutionCompleting) {
      console.log(`🔓 [${callSid}] Clearing toolExecutionCompleting flag at start of new tool: ${toolName}`);
      stateManager.clearToolExecutionCompleting();
    }
    
    // Delay periodic updates only for the short "one click" step (create_new_contact). No delay for
    // lookup_contact (long 30–40s step needs 3 updates from start) or fill_contact_details.
    const bikeTypeCompletion = conversations[callSid]?.bikeTypeQuestionsCompleted;
    const shouldDelayPeriodicUpdates = bikeTypeCompletion && toolName === 'booking_step_create_new_contact';
    
    // Enable progress tracking for all tools, including step-based tools
    // Step-based tools will use longer thresholds to avoid redundant messages for quick steps
    const allowsPeriodicUpdates = this.shouldEnablePeriodicUpdates(toolName);
    // Tools that get 3 periodic updates (after bike type questions until client details page):
    // - booking_step_lookup_contact (existing workflow only - 3 updates)
    // - booking_step_fill_contact_details (existing workflow only - 3 updates)
    // Tools that get 2 periodic updates:
    // - booking_step_search_client (find and verify client - create booking)
    // - booking_step_create_new_contact (new workflow only - 2 updates)
    // - booking_step_fill_contact_details (new workflow only - 2 updates)
    // Booking: booking_step_select_session, booking_step_send_confirmation, booking_step_send_terms, booking_step_send_sms
    // Cancellation: cancellation_step_locate_booking, cancellation_step_fill_cancellation_form,
    //               cancellation_step_send_confirmation
    // Others get 1 update
    const toolsWithThreeUpdates = [
      'booking_step_lookup_contact'
    ];
    const toolsWithTwoUpdates = [
      'booking_step_search_client',
      'booking_step_create_new_contact',
      'booking_step_select_session',
      'booking_step_send_confirmation',
      'booking_step_send_terms',
      'booking_step_send_sms',
      'cancellation_step_search_client',
      'cancellation_step_locate_booking',
      'cancellation_step_fill_cancellation_form',
      'cancellation_step_send_confirmation'
    ];
    
    // For booking_step_fill_contact_details, determine updates based on workflow type
    let maxPeriodicUpdates;
    if (toolName === 'booking_step_fill_contact_details') {
      // Check workflow type from session
      const session = conversations[callSid]?.bookingSession;
      const workflowType = session?.workflowType;
      // Existing workflow gets 3 updates, new workflow gets 2 updates
      maxPeriodicUpdates = workflowType === 'existing' ? 3 : 2;
    } else {
      maxPeriodicUpdates = toolsWithThreeUpdates.includes(toolName) ? 3 
        : toolsWithTwoUpdates.includes(toolName) ? 2 
        : 1;
    }
    // Calculate delayed start time if bike type questions were just completed
    let delayedStartTime = null;
    if (shouldDelayPeriodicUpdates && bikeTypeCompletion) {
      const timeSinceAcknowledgmentEnd = Date.now() - bikeTypeCompletion.acknowledgmentEndTime;
      const delayMs = 12000; // 12 seconds after acknowledgment ends
      if (timeSinceAcknowledgmentEnd < delayMs) {
        delayedStartTime = bikeTypeCompletion.acknowledgmentEndTime + delayMs;
        console.log(`⏱️ [${callSid}] Delaying periodic updates for ${toolName} - will start at ${new Date(delayedStartTime).toISOString()} (${delayMs - timeSinceAcknowledgmentEnd}ms from now)`);
      } else {
        // Already past the delay time, start immediately
        console.log(`✅ [${callSid}] Delay period already passed for ${toolName}, starting periodic updates immediately`);
      }
    }
    
    this.activeExecutions.set(callSid, {
      toolName,
      startTime: Date.now(),
      acknowledgmentSent: false,
      lastUpdateTime: Date.now(),
      updateInterval: null,
      updateTimeout: null, // Track setTimeout for periodic updates
      ackFallbackTimeout: null, // Timer for fallback ack if immediate ack was not sent
      periodicUpdateCount: 0, // Track how many periodic updates have been sent
      maxPeriodicUpdates: maxPeriodicUpdates, // Maximum number of periodic updates allowed for this tool
      stateManager: stateManager, // Store reference for thread-safe checks
      isStepBasedTool: this.isStepBasedTool(toolName), // Track if this is a step-based tool for threshold adjustment
      allowsPeriodicUpdates: allowsPeriodicUpdates, // Track if this tool should have periodic updates enabled
      delayedStartTime: delayedStartTime, // When to start periodic updates (if delayed)
      expectHoldingResponse: false // Set true before sending ack/periodic response.create; cleared when response.created is notified
    });
    console.log(`📊 [${callSid}] Started tracking tool execution: ${toolName}${this.isStepBasedTool(toolName) ? ' (step-based, using longer threshold)' : ''}${allowsPeriodicUpdates ? ' (periodic updates enabled)' : ''}`);
  }

  /**
   * Schedule acknowledgment and periodic updates (shared by Media Streams and SIP).
   * @param {string} callId - Call identifier (callSid or SIP call_id)
   * @param {string} toolName - Tool name (for step-based threshold)
   * @param {WebSocket} openaiWs - WebSocket to send items
   * @param {Object} config - ConversationBehaviorConfig
   * @param {Object|null} stateManager - Optional; null for SIP
   * @param {function(): WebSocket|null} [getWsRef] - Optional; re-fetch WS in timeout (e.g. () => getSipCallWebSocket(callId))
   */
  scheduleAcknowledgmentAndPeriodicUpdates(callId, toolName, openaiWs, config, stateManager, getWsRef) {
    if (!config?.progressIndicators?.enabled || !openaiWs || openaiWs.readyState !== 1) {
      return;
    }
    this.startToolExecution(callId, toolName, stateManager);
    // Fallback ack: if no ack sent within 500ms (e.g. immediate ack skipped due to lock), try once
    const execution = this.activeExecutions.get(callId);
    if (execution) {
      execution.ackFallbackTimeout = setTimeout(() => {
        const exec = this.activeExecutions.get(callId);
        if (!exec || exec.acknowledgmentSent) return;
        const ws = typeof getWsRef === 'function' ? getWsRef() : openaiWs;
        if (!ws || ws.readyState !== 1) return;
        this.checkAndSendAcknowledgment(callId, ws, config);
      }, 500);
    }
  }

  /**
   * Check if acknowledgment should be sent and send it
   * @param {string} callSid - Call SID
   * @param {WebSocket} openaiWs - OpenAI WebSocket connection
   * @param {Object} config - ConversationBehaviorConfig
   * @returns {boolean} - True if acknowledgment was sent
   */
  checkAndSendAcknowledgment(callSid, openaiWs, config) {
    const execution = this.activeExecutions.get(callSid);
    if (!execution || !config?.progressIndicators?.enabled) {
      return false;
    }

    // CRITICAL RACE CONDITION FIX: Check completion flag FIRST (highest priority)
    if (execution.stateManager && execution.stateManager.toolExecutionCompleting) {
      console.log(`🛑 [${callSid}] Skipping acknowledgment - tool execution completing (race condition prevention)`);
      return false;
    }

    // CRITICAL: Don't send acknowledgment if user has interrupted
    if (execution.stateManager && execution.stateManager.isInterrupted) {
      console.log(`🛑 [${callSid}] Skipping acknowledgment - user has interrupted`);
      return false;
    }

    const elapsed = Date.now() - execution.startTime;
    // Use longer threshold for step-based tools (5s) to avoid redundant messages for quick steps; exception: check_availability and authenticate use base (2s) for earlier ack
    const baseThreshold = config.progressIndicators.acknowledgmentThresholdMs || 2000;
    const useShortThreshold = execution.toolName === 'booking_step_check_availability' || execution.toolName === 'booking_step_authenticate';
    const threshold = useShortThreshold ? baseThreshold : (execution.isStepBasedTool ? Math.max(baseThreshold * 2.5, 5000) : baseThreshold);

    if (!execution.acknowledgmentSent && elapsed >= threshold) {
      // Double-check completion flag and interruption state before sending
      if (execution.stateManager && execution.stateManager.toolExecutionCompleting) {
        console.log(`🛑 [${callSid}] Skipping acknowledgment - tool execution completing before send (race condition prevention)`);
        return false;
      }
      if (execution.stateManager && execution.stateManager.isInterrupted) {
        console.log(`🛑 [${callSid}] Skipping acknowledgment - user interrupted before send`);
        return false;
      }

      // CRITICAL RACE CONDITION FIX: Acquire response lock atomically before sending
      // This prevents race conditions with tool completion responses
      if (execution.stateManager && !execution.stateManager.tryAcquireResponseLock()) {
        // Lock not available - another response is being created (likely tool completion)
        // Skip this acknowledgment to avoid "conversation_already_has_active_response" error
        return false;
      }

      const messages = config.progressIndicators.acknowledgmentMessages || [
        "Let me check that for you.",
        "I'm looking into that now.",
        "Just a moment, please."
      ];
      
      const message = messages[Math.floor(Math.random() * messages.length)];
      
      try {
        if (openaiWs && openaiWs.readyState === 1) { // WebSocket.OPEN
          execution.expectHoldingResponse = true; // Next response.created is this acknowledgment; do not set waitingForUser when it completes
          // Item-first: conversation item must exist before response.create (Realtime API requirement)
          openaiWs.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: message
                }
              ]
            }
          }));
          openaiWs.send(JSON.stringify({
            type: 'response.create',
            response: {
              modalities: ['audio', 'text'],
              instructions: `Say exactly: "${(message || '').replace(/"/g, '\\"')}"`
            }
          }));
          
          execution.acknowledgmentSent = true;
          console.log(`✅ [${callSid}] Sent acknowledgment after ${elapsed}ms: "${message}"`);
          
          // Start periodic updates only for whitelisted tools
          if (execution.allowsPeriodicUpdates) {
            this.startPeriodicUpdates(callSid, openaiWs, config);
          }
          
          return true;
        }
      } catch (err) {
        console.error(`❌ [${callSid}] Error sending acknowledgment:`, err);
      }
    }

    return false;
  }

  /**
   * Send an immediate tool-start acknowledgment for create-booking steps (one phrase per step).
   * Message is sent as a holding response so response.done does not set waitingForUser.
   * Call immediately after scheduleAcknowledgmentAndPeriodicUpdates so execution already exists.
   * @param {string} callId - Call SID
   * @param {string} toolName - Tool name (e.g. booking_step_search_client)
   * @param {WebSocket} openaiWs - OpenAI WebSocket connection
   * @param {Object} config - ConversationBehaviorConfig
   * @param {Object|null} stateManager - Optional state manager for guards
   */
  sendImmediateToolStartAcknowledgment(callId, toolName, openaiWs, config, stateManager) {
    if (!config?.progressIndicators?.enabled || !openaiWs || openaiWs.readyState !== 1) {
      return;
    }
    const message = this.getToolStartMessage(toolName);
    if (!message) {
      return;
    }
    const execution = this.activeExecutions.get(callId);
    if (!execution) {
      return;
    }
    if (stateManager) {
      if (stateManager.toolExecutionCompleting) {
        return;
      }
      if (stateManager.isInterrupted) {
        return;
      }
      if (!stateManager.tryAcquireResponseLock()) {
        return;
      }
    }
    try {
      execution.expectHoldingResponse = true;
      openaiWs.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: message }]
        }
      }));
      openaiWs.send(JSON.stringify({
        type: 'response.create',
        response: { modalities: ['audio', 'text'] }
      }));
      execution.acknowledgmentSent = true;
      if (execution.allowsPeriodicUpdates) {
        this.startPeriodicUpdates(callId, openaiWs, config);
      }
      console.log(`✅ [${callId}] Sent immediate tool-start acknowledgment for ${toolName}: "${message}"`);
    } catch (err) {
      console.error(`❌ [${callId}] Error sending immediate tool-start acknowledgment:`, err);
    }
  }

  /**
   * Start sending periodic updates during long operations
   * Sends periodic updates for whitelisted tools (1 for booking_step_search_client, 2 for booking_step_select_session)
   * @param {string} callSid - Call SID
   * @param {WebSocket} openaiWs - OpenAI WebSocket connection
   * @param {Object} config - ConversationBehaviorConfig
   */
  startPeriodicUpdates(callSid, openaiWs, config) {
    const execution = this.activeExecutions.get(callSid);
    if (!execution || !config?.progressIndicators?.enabled) {
      return;
    }

    // CRITICAL: Only enable periodic updates for whitelisted tools
    if (!execution.allowsPeriodicUpdates) {
      console.log(`⏭️ [${callSid}] Skipping periodic updates - tool ${execution.toolName} is not whitelisted`);
      return;
    }

    // Check if we've already sent the maximum number of periodic updates
    if (execution.periodicUpdateCount >= execution.maxPeriodicUpdates) {
      console.log(`⏭️ [${callSid}] Skipping periodic updates - already sent ${execution.periodicUpdateCount}/${execution.maxPeriodicUpdates} for ${execution.toolName}`);
      return;
    }
    
    // Check if periodic updates should be delayed (after bike type questions)
    if (execution.delayedStartTime && Date.now() < execution.delayedStartTime) {
      const delayMs = execution.delayedStartTime - Date.now();
      console.log(`⏱️ [${callSid}] Delaying periodic updates for ${execution.toolName} - will start in ${delayMs}ms (at ${new Date(execution.delayedStartTime).toISOString()})`);
      setTimeout(() => {
        // Re-check execution state after delay
        const exec = this.activeExecutions.get(callSid);
        if (exec && exec.allowsPeriodicUpdates && exec.periodicUpdateCount < exec.maxPeriodicUpdates) {
          this.startPeriodicUpdates(callSid, openaiWs, config);
        }
      }, delayMs);
      return;
    }

    // Clear any existing timeout or interval
    if (execution.updateTimeout) {
      clearTimeout(execution.updateTimeout);
    }
    if (execution.updateInterval) {
      clearInterval(execution.updateInterval);
    }

    const updateInterval = config.progressIndicators.updateIntervalMs || 12000;
    const messages = config.progressIndicators.updateMessages || [
      "Please bear with me for a moment"
    ];

    // Use setTimeout instead of setInterval to send only ONE update
    execution.updateTimeout = setTimeout(async () => {
      // Atomic check: get execution atomically (thread-safe per callSid)
      const execution = this.activeExecutions.get(callSid);
      if (!execution || !openaiWs || openaiWs.readyState !== 1) {
        this.stopPeriodicUpdates(callSid);
        return;
      }

      // Check if we've already sent the maximum number of periodic updates
      if (execution.periodicUpdateCount >= execution.maxPeriodicUpdates) {
        return;
      }

      // CRITICAL: Check if user has interrupted before sending periodic update
      if (execution.stateManager) {
        // CRITICAL RACE CONDITION FIX: Check completion flag FIRST (highest priority)
        // This prevents periodic updates from firing when tool is completing
        if (execution.stateManager.toolExecutionCompleting) {
          console.log(`🛑 [${callSid}] Skipping periodic update - tool execution completing (race condition prevention)`);
          this.stopPeriodicUpdates(callSid);
          return;
        }
        
        // Check for interruption (second priority)
        if (execution.stateManager.isInterrupted) {
          console.log(`🛑 [${callSid}] Skipping periodic update - user has interrupted`);
          this.stopPeriodicUpdates(callSid);
          return;
        }
        
        // Check if response is already active
        if (execution.stateManager.isResponding || execution.stateManager.activeResponseId !== null) {
          // Skip this update - response already active (prevents "conversation already has active response" error)
          console.log(`⏭️ [${callSid}] Skipping periodic update - response already active (isResponding: ${execution.stateManager.isResponding}, activeResponseId: ${execution.stateManager.activeResponseId})`);
          return;
        }
      }

      const elapsed = Date.now() - execution.startTime;
      const message = messages[Math.floor(Math.random() * messages.length)];

      try {
        // Double-check interruption and response state before sending
        if (execution.stateManager) {
          // CRITICAL RACE CONDITION FIX: Double-check completion flag before sending
          if (execution.stateManager.toolExecutionCompleting) {
            console.log(`🛑 [${callSid}] Skipping periodic update - tool execution completing before send (race condition prevention)`);
            this.stopPeriodicUpdates(callSid);
            return;
          }
          if (execution.stateManager.isInterrupted) {
            console.log(`🛑 [${callSid}] Skipping periodic update - user interrupted before send`);
            this.stopPeriodicUpdates(callSid);
            return;
          }
          
          // CRITICAL RACE CONDITION FIX: Acquire response lock atomically before sending
          // This prevents race conditions with tool completion responses
          if (!execution.stateManager.tryAcquireResponseLock()) {
            // Lock not available - another response is being created (likely tool completion)
            // Skip this periodic update to avoid "conversation_already_has_active_response" error
            return;
          }
        }

        // CRITICAL FIX: Disable tools before sending periodic update to prevent AI from responding.
        // Periodic updates are informational only; do not wait for caller—agent continues tool flow.
        openaiWs.send(JSON.stringify({
          type: 'session.update',
          session: {
            tool_choice: 'none'
          }
        }));
        
        // Wait briefly for session update to take effect
        await new Promise(resolve => setTimeout(resolve, 100));

        // CRITICAL: Send conversation.item.create FIRST so the message exists when response.create is called
        // This ensures the AI can reference the exact message that was just added
        openaiWs.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: message
              }
            ]
          }
        }));

        // Wait for message to be added to conversation before creating response
        await new Promise(resolve => setTimeout(resolve, 100));

        // CRITICAL: Add explicit instructions to force exact message repetition
        // This prevents the AI from generating additional questions or content based on workflow phase
        const periodicUpdateInstructions = `CRITICAL: You MUST say EXACTLY and ONLY: "${message}". Do NOT add or rephrase. Do NOT mention next steps, verification, or asking for name. This is a holding message only; say ONLY this and nothing else.`;

        execution.expectHoldingResponse = true; // Next response.created is this periodic update; do not set waitingForUser when it completes
        openaiWs.send(JSON.stringify({
          type: 'response.create',
          response: {
            modalities: ['audio', 'text'],
            instructions: periodicUpdateInstructions
          }
        }));
        
        execution.lastUpdateTime = Date.now();
        execution.periodicUpdateCount++;
        console.log(`📊 [${callSid}] Sent periodic update ${execution.periodicUpdateCount}/${execution.maxPeriodicUpdates} after ${elapsed}ms: "${message}"`);
        
        const estimatedAudioDuration = this.estimateAudioDuration(message);
        const firstUpdateCompletionTime = Date.now() + estimatedAudioDuration;
        console.log(`⏱️ [${callSid}] First update estimated completion time: ${new Date(firstUpdateCompletionTime).toISOString()} (${estimatedAudioDuration}ms audio duration)`);

        const isCancellationStep = execution.toolName.startsWith('cancellation_step_');
        if (!isCancellationStep) {
          const reenableDelayMs = Math.max(2000, estimatedAudioDuration + 1000);
          setTimeout(() => {
            if (openaiWs && openaiWs.readyState === 1) {
              openaiWs.send(JSON.stringify({
                type: 'session.update',
                session: { tool_choice: 'auto' }
              }));
            }
          }, reenableDelayMs);
        }
        
        // Schedule next periodic update if needed (for tools with 2 or 3 updates)
        // Next update starts updateInterval after previous update completes
        const nextUpdateGapMs = updateInterval;
        if (execution.periodicUpdateCount < execution.maxPeriodicUpdates) {
          this.scheduleNextPeriodicUpdate(callSid, openaiWs, config, firstUpdateCompletionTime, nextUpdateGapMs, messages);
        } else {
          execution.updateTimeout = null; // Clear timeout reference if no more updates needed
        }
      } catch (err) {
        console.error(`❌ [${callSid}] Error sending periodic update:`, err);
        this.stopPeriodicUpdates(callSid);
      }
    }, updateInterval);
  }

  /**
   * Schedule the next periodic update recursively
   * @param {string} callSid - Call SID
   * @param {WebSocket} openaiWs - OpenAI WebSocket connection
   * @param {Object} config - ConversationBehaviorConfig
   * @param {number} previousUpdateCompletionTime - When the previous update completed
   * @param {number} updateGapMs - Gap between updates in milliseconds
   * @param {Array<string>} messages - Array of update messages
   */
  scheduleNextPeriodicUpdate(callSid, openaiWs, config, previousUpdateCompletionTime, updateGapMs, messages) {
    const execution = this.activeExecutions.get(callSid);
    if (!execution) {
      return;
    }

    const timeUntilNextUpdate = (previousUpdateCompletionTime + updateGapMs) - Date.now();
    const delayForNextUpdate = Math.max(0, timeUntilNextUpdate);

    console.log(`⏱️ [${callSid}] Scheduling next update (${execution.periodicUpdateCount + 1}/${execution.maxPeriodicUpdates}) in ${delayForNextUpdate}ms (${delayForNextUpdate / 1000}s) - will start ${updateGapMs / 1000}s after previous update completes`);
    
    execution.updateTimeout = setTimeout(async () => {
      // Re-check execution state before sending update
      const exec = this.activeExecutions.get(callSid);
      if (!exec || !openaiWs || openaiWs.readyState !== 1) {
        this.stopPeriodicUpdates(callSid);
        return;
      }

      // Check if we've already sent the maximum number of periodic updates
      if (exec.periodicUpdateCount >= exec.maxPeriodicUpdates) {
        exec.updateTimeout = null;
        return;
      }

      // CRITICAL: Check if user has interrupted before sending periodic update
      if (exec.stateManager) {
        if (exec.stateManager.toolExecutionCompleting) {
          console.log(`🛑 [${callSid}] Skipping periodic update ${exec.periodicUpdateCount + 1} - tool execution completing (race condition prevention)`);
          this.stopPeriodicUpdates(callSid);
          return;
        }
        
        if (exec.stateManager.isInterrupted) {
          console.log(`🛑 [${callSid}] Skipping periodic update ${exec.periodicUpdateCount + 1} - user has interrupted`);
          this.stopPeriodicUpdates(callSid);
          return;
        }
        
        if (exec.stateManager.isResponding || exec.stateManager.activeResponseId !== null) {
          console.log(`⏭️ [${callSid}] Skipping periodic update ${exec.periodicUpdateCount + 1} - response already active`);
          return;
        }
      }

      const elapsed = Date.now() - exec.startTime;
      // Use first message (generic message for all periodic updates)
      const message = messages[0];

      try {
        // Double-check interruption and response state before sending
        if (exec.stateManager) {
          if (exec.stateManager.toolExecutionCompleting) {
            console.log(`🛑 [${callSid}] Skipping periodic update ${exec.periodicUpdateCount + 1} - tool execution completing before send (race condition prevention)`);
            this.stopPeriodicUpdates(callSid);
            return;
          }
          if (exec.stateManager.isInterrupted) {
            console.log(`🛑 [${callSid}] Skipping periodic update ${exec.periodicUpdateCount + 1} - user interrupted before send`);
            this.stopPeriodicUpdates(callSid);
            return;
          }
          
          if (!exec.stateManager.tryAcquireResponseLock()) {
            return;
          }
        }

        // CRITICAL FIX: Disable tools before sending periodic update. Informational only; do not wait for caller.
        openaiWs.send(JSON.stringify({
          type: 'session.update',
          session: {
            tool_choice: 'none'
          }
        }));
        
        await new Promise(resolve => setTimeout(resolve, 100));

        // CRITICAL: Send conversation.item.create FIRST so the message exists when response.create is called
        // This ensures the AI can reference the exact message that was just added
        openaiWs.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: message
              }
            ]
          }
        }));

        // Wait for message to be added to conversation before creating response
        await new Promise(resolve => setTimeout(resolve, 100));

        // CRITICAL: Add explicit instructions to force exact message repetition
        // This prevents the AI from generating additional questions or content based on workflow phase
        const periodicUpdateInstructions = `CRITICAL: You MUST say EXACTLY and ONLY: "${message}". Do NOT add or rephrase. Do NOT mention next steps, verification, or asking for name. This is a holding message only; say ONLY this and nothing else.`;

        exec.expectHoldingResponse = true; // Next response.created is this periodic update; do not set waitingForUser when it completes
        openaiWs.send(JSON.stringify({
          type: 'response.create',
          response: {
            modalities: ['audio', 'text'],
            instructions: periodicUpdateInstructions
          }
        }));
        
        exec.lastUpdateTime = Date.now();
        exec.periodicUpdateCount++;

        const estimatedAudioDuration = this.estimateAudioDuration(message);
        const updateCompletionTime = Date.now() + estimatedAudioDuration;
        console.log(`📊 [${callSid}] Sent periodic update ${exec.periodicUpdateCount}/${exec.maxPeriodicUpdates} after ${elapsed}ms: "${message}"`);

        const isCancellationStep = exec.toolName.startsWith('cancellation_step_');
        if (!isCancellationStep) {
          const reenableDelayMs = Math.max(2000, estimatedAudioDuration + 1000);
          setTimeout(() => {
            if (openaiWs && openaiWs.readyState === 1) {
              openaiWs.send(JSON.stringify({
                type: 'session.update',
                session: { tool_choice: 'auto' }
              }));
            }
          }, reenableDelayMs);
        }
        
        // Schedule next periodic update if needed (recursive for 3 updates)
        if (exec.periodicUpdateCount < exec.maxPeriodicUpdates) {
          this.scheduleNextPeriodicUpdate(callSid, openaiWs, config, updateCompletionTime, updateGapMs, messages);
        } else {
          exec.updateTimeout = null; // Clear timeout reference if no more updates needed
        }
      } catch (err) {
        console.error(`❌ [${callSid}] Error sending periodic update ${exec.periodicUpdateCount + 1}:`, err);
        this.stopPeriodicUpdates(callSid);
      }
    }, delayForNextUpdate);
  }

  /**
   * Estimate audio playback duration for a message
   * @param {string} message - Message text
   * @returns {number} Estimated duration in milliseconds
   */
  estimateAudioDuration(message) {
    if (!message || typeof message !== 'string') {
      return 2000; // Default 2 seconds for empty/invalid messages
    }
    
    const wordCount = message.trim().split(/\s+/).filter(word => word.length > 0).length;
    // Average speech rate: ~2.5 words/second (150 words/minute)
    // Add 1 second buffer for natural pauses and processing
    const durationMs = (wordCount / 2.5) * 1000 + 1000;
    return Math.ceil(durationMs);
  }

  /**
   * Stop periodic updates for a call
   * @param {string} callSid - Call SID
   */
  stopPeriodicUpdates(callSid) {
    const execution = this.activeExecutions.get(callSid);
    if (execution) {
      try {
        if (execution.ackFallbackTimeout) {
          clearTimeout(execution.ackFallbackTimeout);
          execution.ackFallbackTimeout = null;
        }
        // Clear setTimeout (for single periodic update)
        if (execution.updateTimeout) {
          clearTimeout(execution.updateTimeout);
          execution.updateTimeout = null;
        }
        // Clear setInterval (for legacy/backward compatibility)
        if (execution.updateInterval) {
          clearInterval(execution.updateInterval);
          execution.updateInterval = null;
        }
      } catch (err) {
        console.error(`❌ [${callSid}] Error stopping periodic updates:`, err);
      }
    }
  }

  /**
   * Stop periodic updates without ending tool execution tracking
   * Used during fallback to prevent multiple responses while keeping execution metrics
   * @param {string} callSid - Call SID
   */
  stopPeriodicUpdatesOnly(callSid) {
    const execution = this.activeExecutions.get(callSid);
    if (execution) {
      try {
        // Clear setTimeout (for single periodic update)
        if (execution.updateTimeout) {
          clearTimeout(execution.updateTimeout);
          execution.updateTimeout = null;
        }
        // Clear setInterval (for legacy/backward compatibility)
        if (execution.updateInterval) {
          clearInterval(execution.updateInterval);
          execution.updateInterval = null;
        }
        console.log(`🛑 [${callSid}] Stopped periodic updates (execution still tracked for metrics)`);
      } catch (err) {
        console.error(`❌ [${callSid}] Error stopping periodic updates:`, err);
      }
    }
  }

  /**
   * End tool execution tracking
   * @param {string} callSid - Call SID
   */
  endToolExecution(callSid) {
    const execution = this.activeExecutions.get(callSid);
    if (execution?.ackFallbackTimeout) {
      clearTimeout(execution.ackFallbackTimeout);
      execution.ackFallbackTimeout = null;
    }
    this.stopPeriodicUpdates(callSid);
    if (execution) {
      const duration = Date.now() - execution.startTime;
      console.log(`📊 [${callSid}] Tool execution completed: ${execution.toolName} (duration: ${duration}ms)`);
      this.activeExecutions.delete(callSid);
    }
  }

  /**
   * Get execution info for a call
   * @param {string} callSid - Call SID
   * @returns {Object|null} - Execution info or null
   */
  getExecutionInfo(callSid) {
    return this.activeExecutions.get(callSid) || null;
  }

  /**
   * Notify that a response was created (called from response.created handler).
   * If we just sent an acknowledgment or periodic update, register this response ID so response.done does not set waitingForUser.
   * @param {string} callSid - Call SID
   * @param {string|null} responseId - Response ID from event.response.id
   */
  notifyResponseCreated(callSid, responseId) {
    if (!callSid || !responseId) return;
    const execution = this.activeExecutions.get(callSid);
    if (execution && execution.expectHoldingResponse) {
      if (!this.holdingResponseIds.has(callSid)) {
        this.holdingResponseIds.set(callSid, new Set());
      }
      this.holdingResponseIds.get(callSid).add(responseId);
      execution.expectHoldingResponse = false;
      console.log(`📌 [${callSid}] Registered holding response ${responseId} (ack/periodic update)`);
      return;
    }
    if (this.expectNonWaitingResponseCallSids.has(callSid)) {
      this.expectNonWaitingResponseCallSids.delete(callSid);
      if (!this.holdingResponseIds.has(callSid)) {
        this.holdingResponseIds.set(callSid, new Set());
      }
      this.holdingResponseIds.get(callSid).add(responseId);
      console.log(`📌 [${callSid}] Registered non-waiting response ${responseId} (e.g. booking options acknowledgment)`);
    }
  }

  /**
   * Mark that the next response.created for this call should be treated as non-waiting (do not set waitingForUser when it completes).
   * Call before sending response.create for e.g. "Your booking options are successfully selected" so that response.done does not set waitingForUser.
   * @param {string} callSid - Call SID
   */
  setExpectNonWaitingResponse(callSid) {
    if (callSid) this.expectNonWaitingResponseCallSids.add(callSid);
  }

  /**
   * Check if the completed response was an acknowledgment or periodic update (holding message).
   * @param {string} callSid - Call SID
   * @param {string} responseId - Response ID from response.done event
   * @returns {boolean}
   */
  isHoldingResponse(callSid, responseId) {
    return this.holdingResponseIds.get(callSid)?.has(responseId) ?? false;
  }

  /**
   * Remove a response ID from the holding set after response.done has been handled.
   * @param {string} callSid - Call SID
   * @param {string} responseId - Response ID
   */
  removeHoldingResponse(callSid, responseId) {
    const set = this.holdingResponseIds.get(callSid);
    if (set) {
      set.delete(responseId);
      if (set.size === 0) this.holdingResponseIds.delete(callSid);
    }
  }

  /**
   * Clear holding response IDs for a call (call from full call cleanup only, not when a single tool ends).
   * @param {string} callSid - Call SID
   */
  clearHoldingResponsesForCall(callSid) {
    this.holdingResponseIds.delete(callSid);
    this.expectNonWaitingResponseCallSids.delete(callSid);
  }

  /**
   * Send a progress update message to the caller
   * @param {string} callSid - Call SID
   * @param {string} message - Progress message
   * @param {WebSocket} openaiWs - OpenAI WebSocket connection
   */
  sendProgressUpdate(callSid, message, openaiWs) {
    if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      // Register so response.done does not set waitingForUser (holding response)
      const execution = this.activeExecutions.get(callSid);
      if (execution) {
        execution.expectHoldingResponse = true;
      } else {
        this.setExpectNonWaitingResponse(callSid);
      }

      // Create a conversation item with the progress message
      openaiWs.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'assistant',
          content: [{
            type: 'text',
            text: message
          }]
        }
      }));

      // Trigger response creation
      openaiWs.send(JSON.stringify({
        type: 'response.create',
        response: {
          modalities: ['audio', 'text']
        }
      }));

      console.log(`💬 [${callSid}] Sent progress update: "${message}"`);
    } catch (error) {
      console.error(`❌ [${callSid}] Error sending progress update:`, error);
    }
  }
}

export default new ProgressIndicatorService();
