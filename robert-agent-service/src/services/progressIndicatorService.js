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
    // Skip progress tracking for step-based tools
    if (this.isStepBasedTool(toolName)) {
      console.log(`📊 [${callSid}] Skipping progress tracking for step-based tool: ${toolName}`);
      return;
    }

    this.activeExecutions.set(callSid, {
      toolName,
      startTime: Date.now(),
      acknowledgmentSent: false,
      lastUpdateTime: Date.now(),
      updateInterval: null,
      stateManager: stateManager // Store reference for thread-safe checks
    });
    console.log(`📊 [${callSid}] Started tracking tool execution: ${toolName}`);
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

    // Skip acknowledgment for step-based tools
    if (this.isStepBasedTool(execution.toolName)) {
      return false;
    }

    const elapsed = Date.now() - execution.startTime;
    const threshold = config.progressIndicators.acknowledgmentThresholdMs || 2000;

    if (!execution.acknowledgmentSent && elapsed >= threshold) {
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

    // Skip periodic updates for step-based tools
    if (this.isStepBasedTool(execution.toolName)) {
      console.log(`📊 [${callSid}] Skipping periodic updates for step-based tool: ${execution.toolName}`);
      return;
    }

    // Clear any existing interval
    if (execution.updateInterval) {
      clearInterval(execution.updateInterval);
    }

    const updateInterval = config.progressIndicators.updateIntervalMs || 5000;
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

      // CRITICAL: Check if response is already active before sending periodic update
      // This prevents race conditions where tool completion creates response while periodic update fires
      if (execution.stateManager) {
        if (execution.stateManager.isResponding || execution.stateManager.activeResponseId !== null) {
          // Skip this update - response already active (prevents "conversation already has active response" error)
          console.log(`⏭️ [${callSid}] Skipping periodic update - response already active (isResponding: ${execution.stateManager.isResponding}, activeResponseId: ${execution.stateManager.activeResponseId})`);
          return;
        }
      }

      const elapsed = Date.now() - execution.startTime;
      const message = messages[updateCount % messages.length];
      updateCount++;

      try {
        // Only send if no response is active (double-check for race conditions)
        if (execution.stateManager) {
          if (execution.stateManager.isResponding || execution.stateManager.activeResponseId !== null) {
            return; // Response became active between check and send
          }
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
    } else {
      // Execution might not exist if it was a step-based tool (skipped tracking)
      // This is expected and not an error
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

