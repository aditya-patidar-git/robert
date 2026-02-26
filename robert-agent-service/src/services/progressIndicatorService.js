/**
 * Progress Indicator Service
 * Provides periodic updates during long-running tool operations
 */

import { conversations } from '../shared/state.js';

class ProgressIndicatorService {
  constructor() {
    this.activeExecutions = new Map(); // callSid -> { toolName, startTime, lastUpdateTime, updateTimeout, periodicUpdateCount, maxPeriodicUpdates, stateManager, allowsPeriodicUpdates, delayedStartTime, expectHoldingResponse }
    this.holdingResponseIds = new Map(); // callSid -> Set of responseId (periodic updates; do not set waitingForUser when these complete)
    this.expectNonWaitingResponseCallSids = new Set(); // callSids for which the next response.created should be registered as non-waiting (e.g. "Your booking options are successfully selected")
    /** First periodic update fires after this (ms) so at least one fires before tool often ends. */
    this.FIRST_PERIODIC_INTERVAL_MS = 6000;
    /** Retry delay when response lock is unavailable (ms). */
    this.PERIODIC_UPDATE_RETRY_DELAY_MS = 2500;
    /** Max retries (total attempts = 1 + this value). */
    this.MAX_PERIODIC_UPDATE_RETRIES = 2;
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
    // 2b. booking_step_select_booking_options - applies bike type/preferences and taps Next (slow when called with bikeType)
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
      || toolName === 'booking_step_select_booking_options'
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

    // Resolve alias so periodic updates are enabled when model calls booking_step_confirm_booking
    // (redirected by executor to lookup_contact or create_new_contact; we need the same name for progress)
    if (toolName === 'booking_step_confirm_booking') {
      const workflowType = conversations[callSid]?.bookingSession?.workflowType || 'existing';
      toolName = workflowType === 'new' ? 'booking_step_create_new_contact' : 'booking_step_lookup_contact';
      console.log(`🔧 [${callSid}] Progress: resolved booking_step_confirm_booking → ${toolName} (workflowType: ${workflowType})`);
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
    // - booking_step_search_client (find and verify client - 3 updates)
    // - cancellation_step_search_client (find and verify client - cancellation, 3 updates)
    // Tools that get 2 periodic updates:
    // - booking_step_create_new_contact (new workflow only - 2 updates)
    // - booking_step_fill_contact_details (new workflow only - 2 updates)
    // Booking: booking_step_select_session, booking_step_send_confirmation, booking_step_send_terms, booking_step_send_sms
    // Cancellation: cancellation_step_locate_booking, cancellation_step_fill_cancellation_form,
    //               cancellation_step_send_confirmation
    // Others get 1 update
    const toolsWithThreeUpdates = [
      'booking_step_lookup_contact',
      'booking_step_search_client',
      'cancellation_step_search_client'
    ];
    const toolsWithTwoUpdates = [
      'booking_step_create_new_contact',
      'booking_step_select_session',
      'booking_step_select_booking_options',
      'booking_step_send_confirmation',
      'booking_step_send_terms',
      'booking_step_send_sms',
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
      lastUpdateTime: Date.now(),
      updateTimeout: null, // Track setTimeout for periodic updates
      periodicUpdateCount: 0, // Track how many periodic updates have been sent
      maxPeriodicUpdates: maxPeriodicUpdates, // Maximum number of periodic updates allowed for this tool
      stateManager: stateManager, // Store reference for thread-safe checks
      allowsPeriodicUpdates: allowsPeriodicUpdates, // Track if this tool should have periodic updates enabled
      delayedStartTime: delayedStartTime, // When to start periodic updates (if delayed)
      expectHoldingResponse: false // Set true before sending periodic response.create; cleared when response.created is notified
    });
    console.log(`📊 [${callSid}] Started tracking tool execution: ${toolName}${allowsPeriodicUpdates ? ' (periodic updates enabled)' : ''}`);
  }

  /**
   * Schedule periodic updates for long-running tools (shared by Media Streams and SIP).
   * @param {string} callId - Call identifier (callSid or SIP call_id)
   * @param {string} toolName - Tool name
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
    // Start periodic updates immediately for whitelisted tools
    const execution = this.activeExecutions.get(callId);
    if (execution && execution.allowsPeriodicUpdates) {
        const ws = typeof getWsRef === 'function' ? getWsRef() : openaiWs;
      if (ws && ws.readyState === 1) {
        this.startPeriodicUpdates(callId, ws, config);
      }
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

    // First periodic update fires earlier (6s default) so at least one is sent before tool often ends
    const firstIntervalMs = Math.min(updateInterval, this.FIRST_PERIODIC_INTERVAL_MS);

    // Use setTimeout instead of setInterval to send only ONE update
    execution.updateTimeout = setTimeout(() => {
      this.trySendOnePeriodicUpdate(callSid, openaiWs, config, 0, null, updateInterval, messages);
    }, firstIntervalMs);
  }

  /**
   * Schedule a retry for sending a periodic update when lock was unavailable.
   * @param {string} callSid - Call SID
   * @param {WebSocket} openaiWs - OpenAI WebSocket
   * @param {Object} config - ConversationBehaviorConfig
   * @param {number} retryCount - Current retry count (0 = first attempt)
   * @param {Object|null} scheduleNextArgs - null for first update; { updateGapMs, messages } for next updates
   * @param {number} updateInterval - updateIntervalMs from config
   * @param {Array<string>} messages - updateMessages from config
   */
  schedulePeriodicUpdateRetry(callSid, openaiWs, config, retryCount, scheduleNextArgs, updateInterval, messages) {
    if (retryCount >= this.MAX_PERIODIC_UPDATE_RETRIES) {
      console.log(`⏭️ [${callSid}] Periodic update retry limit reached (${retryCount}), skipping this update`);
        return;
      }
    const delayMs = this.PERIODIC_UPDATE_RETRY_DELAY_MS;
    console.log(`⏱️ [${callSid}] Scheduling periodic update retry ${retryCount + 1}/${this.MAX_PERIODIC_UPDATE_RETRIES} in ${delayMs}ms`);
    setTimeout(() => {
      this.trySendOnePeriodicUpdate(callSid, openaiWs, config, retryCount + 1, scheduleNextArgs, updateInterval, messages);
    }, delayMs);
  }

  /**
   * Try once to send one periodic update (first or next in sequence). Skips if lock unavailable; schedules retry when under limit.
   * @param {string} callSid - Call SID
   * @param {WebSocket} openaiWs - OpenAI WebSocket
   * @param {Object} config - ConversationBehaviorConfig
   * @param {number} retryCount - Retry attempt (0 = first attempt)
   * @param {Object|null} scheduleNextArgs - null for first update; { updateGapMs, messages } for next update
   * @param {number} updateInterval - updateIntervalMs from config
   * @param {Array<string>} messages - updateMessages from config
   */
  async trySendOnePeriodicUpdate(callSid, openaiWs, config, retryCount, scheduleNextArgs, updateInterval, messages) {
    const execution = this.activeExecutions.get(callSid);
    if (!execution || !openaiWs || openaiWs.readyState !== 1) {
          this.stopPeriodicUpdates(callSid);
          return;
        }
    if (execution.periodicUpdateCount >= execution.maxPeriodicUpdates) return;
        if (execution.stateManager) {
          if (execution.stateManager.toolExecutionCompleting) {
            this.stopPeriodicUpdates(callSid);
            return;
          }
          if (execution.stateManager.isInterrupted) {
            console.log(`⏭️ [${callSid}] Periodic update (retry ${retryCount}) - interrupted (will retry)`);
            this.schedulePeriodicUpdateRetry(callSid, openaiWs, config, retryCount, scheduleNextArgs, updateInterval, messages);
            return;
          }
      if (execution.stateManager.isResponding || execution.stateManager.activeResponseId !== null) {
        console.log(`⏭️ [${callSid}] Periodic update (retry ${retryCount}) - response already active`);
        this.schedulePeriodicUpdateRetry(callSid, openaiWs, config, retryCount, scheduleNextArgs, updateInterval, messages);
        return;
      }
          if (!execution.stateManager.tryAcquireResponseLock()) {
        console.log(`⏭️ [${callSid}] Periodic update (retry ${retryCount}) - response lock unavailable`);
        this.schedulePeriodicUpdateRetry(callSid, openaiWs, config, retryCount, scheduleNextArgs, updateInterval, messages);
            return;
          }
        }
    const isFirst = scheduleNextArgs === null;
    const message = isFirst ? messages[Math.floor(Math.random() * messages.length)] : messages[0];
    const elapsed = Date.now() - execution.startTime;
    try {
      openaiWs.send(JSON.stringify({ type: 'session.update', session: { tool_choice: 'none' } }));
        await new Promise(resolve => setTimeout(resolve, 100));
      execution.expectHoldingResponse = true;
        openaiWs.send(JSON.stringify({
          type: 'response.create',
          response: {
            modalities: ['audio', 'text'],
          instructions: `CRITICAL: You MUST say EXACTLY and ONLY: "${(message || '').replace(/"/g, '\\"')}". Do NOT add or rephrase. Do NOT ask any questions. Do NOT mention contact details, payment, bike type, transfer, updating phone number, or any step of the booking or cancellation flow. Do NOT offer to transfer or to update details. Do not call any tools. This is a generic holding message only—say ONLY the exact phrase above and nothing else.`
          }
        }));
        execution.lastUpdateTime = Date.now();
        execution.periodicUpdateCount++;
        console.log(`📊 [${callSid}] Sent periodic update ${execution.periodicUpdateCount}/${execution.maxPeriodicUpdates} after ${elapsed}ms: "${message}"`);
        const estimatedAudioDuration = this.estimateAudioDuration(message);
      const updateCompletionTime = Date.now() + estimatedAudioDuration;
      if (!execution.toolName.startsWith('cancellation_step_')) {
          const reenableDelayMs = Math.max(2000, estimatedAudioDuration + 1000);
          setTimeout(() => {
            if (openaiWs && openaiWs.readyState === 1) {
            openaiWs.send(JSON.stringify({ type: 'session.update', session: { tool_choice: 'auto' } }));
            }
          }, reenableDelayMs);
        }
        if (execution.periodicUpdateCount < execution.maxPeriodicUpdates) {
        if (isFirst) {
          this.scheduleNextPeriodicUpdate(callSid, openaiWs, config, updateCompletionTime, updateInterval, messages);
        } else {
          this.scheduleNextPeriodicUpdate(callSid, openaiWs, config, updateCompletionTime, scheduleNextArgs.updateGapMs, scheduleNextArgs.messages);
        }
      } else {
        execution.updateTimeout = null;
        }
      } catch (err) {
        console.error(`❌ [${callSid}] Error sending periodic update:`, err);
        this.stopPeriodicUpdates(callSid);
      }
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

      // Use shared try-once with retry (no bypass - production-safe)
      await this.trySendOnePeriodicUpdate(callSid, openaiWs, config, 0, { updateGapMs, messages }, updateGapMs, messages);
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
        // Clear setTimeout (for single periodic update)
        if (execution.updateTimeout) {
          clearTimeout(execution.updateTimeout);
          execution.updateTimeout = null;
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
    this.stopPeriodicUpdates(callSid);
    const execution = this.activeExecutions.get(callSid);
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
}

export default new ProgressIndicatorService();
