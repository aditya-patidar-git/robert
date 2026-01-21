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
    this.activeExecutions.set(callSid, {
      toolName,
      startTime: Date.now(),
      acknowledgmentSent: false,
      lastUpdateTime: Date.now(),
      updateInterval: null,
      stateManager: stateManager, // Store reference for thread-safe checks
      isStepBasedTool: this.isStepBasedTool(toolName) // Track if this is a step-based tool for threshold adjustment
    });
    console.log(`📊 [${callSid}] Started tracking tool execution: ${toolName}${this.isStepBasedTool(toolName) ? ' (step-based, using longer threshold)' : ''}`);
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

      // Note: We intentionally allow acknowledgments during tool execution - they are meant to reassure callers
      // The toolExecutionCompleting, isInterrupted, and isResponding flags provide sufficient safeguards

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
          
          // Start periodic updates
          this.startPeriodicUpdates(callSid, openaiWs, config);
          
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
   * @param {string} callSid - Call SID
   * @param {WebSocket} openaiWs - OpenAI WebSocket connection
   * @param {Object} config - ConversationBehaviorConfig
   */
  startPeriodicUpdates(callSid, openaiWs, config) {
    const execution = this.activeExecutions.get(callSid);
    if (!execution || !config?.progressIndicators?.enabled) {
      return;
    }

    // Enable periodic updates for all tools, including step-based tools
    // Step-based tools will use longer intervals to avoid redundant messages

    // Clear any existing interval
    if (execution.updateInterval) {
      clearInterval(execution.updateInterval);
    }

    const updateInterval = config.progressIndicators.updateIntervalMs || 8000;
    const messages = config.progressIndicators.updateMessages || [
      "This is taking a bit longer than usual, please hold on.",
      "I'm still working on that, just a moment.",
      "Almost there, please bear with me."
    ];

    let updateCount = 0;
    execution.updateInterval = setInterval(() => {
      // Atomic check: get execution atomically (thread-safe per callSid)
      const execution = this.activeExecutions.get(callSid);
      if (!execution || !openaiWs || openaiWs.readyState !== 1) {
        this.stopPeriodicUpdates(callSid);
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
        
        // Note: We intentionally allow periodic updates during tool execution - they are meant to reassure callers
        // The toolExecutionCompleting, isInterrupted, and isResponding flags provide sufficient safeguards
      }

      const elapsed = Date.now() - execution.startTime;
      const message = messages[updateCount % messages.length];
      updateCount++;

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
          if (execution.stateManager.isResponding || execution.stateManager.activeResponseId !== null) {
            return; // Response became active between check and send
          }
          // Note: We intentionally allow periodic updates during tool execution - they are meant to reassure callers
          // The toolExecutionCompleting, isInterrupted, and isResponding flags provide sufficient safeguards
        }

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
        console.log(`📊 [${callSid}] Sent periodic update after ${elapsed}ms: "${message}"`);
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
    if (execution && execution.updateInterval) {
      try {
        clearInterval(execution.updateInterval);
        execution.updateInterval = null;
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
    if (execution && execution.updateInterval) {
      try {
        clearInterval(execution.updateInterval);
        execution.updateInterval = null;
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
