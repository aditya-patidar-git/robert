/**
 * Progress Indicator Service
 * Provides feedback to callers during long-running tool operations
 */

class ProgressIndicatorService {
  constructor() {
    this.activeExecutions = new Map(); // callSid -> { toolName, startTime, acknowledgmentSent, lastUpdateTime, updateInterval }
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
    // 1. booking_step_search_client - navigates from client search page to client verification page
    // 2. booking_step_select_session - navigates after client verification page to selectBookingOptions page
    // 3. booking_step_fill_contact_details - fills contact details form and checks for missing fields sequentially
    // 4. booking_step_send_confirmation - sends booking confirmation email
    // 5. booking_step_send_terms - sends terms and conditions email
    // 6. booking_step_send_sms - sends SMS confirmation
    return toolName === 'booking_step_search_client' 
      || toolName === 'booking_step_select_session' 
      || toolName === 'booking_step_fill_contact_details'
      || toolName === 'booking_step_send_confirmation'
      || toolName === 'booking_step_send_terms'
      || toolName === 'booking_step_send_sms';
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
    
    // Enable progress tracking for all tools, including step-based tools
    // Step-based tools will use longer thresholds to avoid redundant messages for quick steps
    const allowsPeriodicUpdates = this.shouldEnablePeriodicUpdates(toolName);
    // Tools that get 2 periodic updates: booking_step_select_session, booking_step_fill_contact_details,
    // booking_step_send_confirmation, booking_step_send_terms, booking_step_send_sms
    // Others get 1 update
    const toolsWithTwoUpdates = [
      'booking_step_select_session',
      'booking_step_fill_contact_details',
      'booking_step_send_confirmation',
      'booking_step_send_terms',
      'booking_step_send_sms'
    ];
    const maxPeriodicUpdates = toolsWithTwoUpdates.includes(toolName) ? 2 : 1;
    this.activeExecutions.set(callSid, {
      toolName,
      startTime: Date.now(),
      acknowledgmentSent: false,
      lastUpdateTime: Date.now(),
      updateInterval: null,
      updateTimeout: null, // Track setTimeout for periodic updates
      periodicUpdateCount: 0, // Track how many periodic updates have been sent
      maxPeriodicUpdates: maxPeriodicUpdates, // Maximum number of periodic updates allowed for this tool
      stateManager: stateManager, // Store reference for thread-safe checks
      isStepBasedTool: this.isStepBasedTool(toolName), // Track if this is a step-based tool for threshold adjustment
      allowsPeriodicUpdates: allowsPeriodicUpdates // Track if this tool should have periodic updates enabled
    });
    console.log(`📊 [${callSid}] Started tracking tool execution: ${toolName}${this.isStepBasedTool(toolName) ? ' (step-based, using longer threshold)' : ''}${allowsPeriodicUpdates ? ' (periodic updates enabled)' : ''}`);
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
    // Use longer threshold for step-based tools (5-8 seconds) to avoid redundant messages for quick steps
    // Regular tools use 2 seconds, step-based tools use 5 seconds
    const baseThreshold = config.progressIndicators.acknowledgmentThresholdMs || 2000;
    const threshold = execution.isStepBasedTool ? Math.max(baseThreshold * 2.5, 5000) : baseThreshold;

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
          openaiWs.send(JSON.stringify({
            type: 'response.create',
            response: {
              modalities: ['audio', 'text']
            }
          }));
          
          // Inject the acknowledgment message
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

    // Clear any existing timeout or interval
    if (execution.updateTimeout) {
      clearTimeout(execution.updateTimeout);
    }
    if (execution.updateInterval) {
      clearInterval(execution.updateInterval);
    }

    const updateInterval = config.progressIndicators.updateIntervalMs || 8000;
    const messages = config.progressIndicators.updateMessages || [
      "This is taking a bit longer than usual, please hold on.",
      "I'm still working on that, just a moment.",
      "Almost there, please bear with me."
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

        // CRITICAL FIX: Disable tools before sending periodic update to prevent AI from responding
        // Periodic updates are informational only and should not trigger tool invocations
        openaiWs.send(JSON.stringify({
          type: 'session.update',
          session: {
            tool_choice: 'none'
          }
        }));
        
        // Wait briefly for session update to take effect
        await new Promise(resolve => setTimeout(resolve, 100));

        openaiWs.send(JSON.stringify({
          type: 'response.create',
          response: {
            modalities: ['audio', 'text']
          }
        }));
        
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
        
        execution.lastUpdateTime = Date.now();
        execution.periodicUpdateCount++;
        console.log(`📊 [${callSid}] Sent periodic update ${execution.periodicUpdateCount}/${execution.maxPeriodicUpdates} after ${elapsed}ms: "${message}"`);
        
        // Re-enable tools after a delay to allow periodic update to complete
        // This ensures tools are available for the actual tool execution completion
        setTimeout(() => {
          if (openaiWs && openaiWs.readyState === 1) {
            openaiWs.send(JSON.stringify({
              type: 'session.update',
              session: {
                tool_choice: 'auto'
              }
            }));
          }
        }, 2000); // Wait 2 seconds for periodic update audio to start playing
        
        // Schedule second periodic update if needed (for booking_step_select_session)
        if (execution.periodicUpdateCount < execution.maxPeriodicUpdates) {
          execution.updateTimeout = setTimeout(async () => {
            // Re-check execution state before sending second update
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
              if (execution.stateManager.toolExecutionCompleting) {
                console.log(`🛑 [${callSid}] Skipping second periodic update - tool execution completing (race condition prevention)`);
                this.stopPeriodicUpdates(callSid);
                return;
              }
              
              if (execution.stateManager.isInterrupted) {
                console.log(`🛑 [${callSid}] Skipping second periodic update - user has interrupted`);
                this.stopPeriodicUpdates(callSid);
                return;
              }
              
              if (execution.stateManager.isResponding || execution.stateManager.activeResponseId !== null) {
                console.log(`⏭️ [${callSid}] Skipping second periodic update - response already active`);
                return;
              }
            }

            const elapsed = Date.now() - execution.startTime;
            const message = messages[Math.floor(Math.random() * messages.length)];

            try {
              // Double-check interruption and response state before sending
              if (execution.stateManager) {
                if (execution.stateManager.toolExecutionCompleting) {
                  console.log(`🛑 [${callSid}] Skipping second periodic update - tool execution completing before send (race condition prevention)`);
                  this.stopPeriodicUpdates(callSid);
                  return;
                }
                if (execution.stateManager.isInterrupted) {
                  console.log(`🛑 [${callSid}] Skipping second periodic update - user interrupted before send`);
                  this.stopPeriodicUpdates(callSid);
                  return;
                }
                
                if (!execution.stateManager.tryAcquireResponseLock()) {
                  return;
                }
              }

              // CRITICAL FIX: Disable tools before sending periodic update to prevent AI from responding
              openaiWs.send(JSON.stringify({
                type: 'session.update',
                session: {
                  tool_choice: 'none'
                }
              }));
              
              await new Promise(resolve => setTimeout(resolve, 100));

              openaiWs.send(JSON.stringify({
                type: 'response.create',
                response: {
                  modalities: ['audio', 'text']
                }
              }));
              
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
              
              execution.lastUpdateTime = Date.now();
              execution.periodicUpdateCount++;
              execution.updateTimeout = null; // Clear timeout reference after sending
              console.log(`📊 [${callSid}] Sent periodic update ${execution.periodicUpdateCount}/${execution.maxPeriodicUpdates} after ${elapsed}ms: "${message}"`);
              
              // Re-enable tools after a delay to allow periodic update to complete
              setTimeout(() => {
                if (openaiWs && openaiWs.readyState === 1) {
                  openaiWs.send(JSON.stringify({
                    type: 'session.update',
                    session: {
                      tool_choice: 'auto'
                    }
                  }));
                }
              }, 2000);
            } catch (err) {
              console.error(`❌ [${callSid}] Error sending second periodic update:`, err);
              this.stopPeriodicUpdates(callSid);
            }
          }, updateInterval); // Schedule second update after another updateInterval delay
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
