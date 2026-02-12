/**
 * Silence Detection Service
 * Monitors for extended silence and sends proactive engagement messages
 */

class SilenceDetectionService {
  constructor() {
    this.callStates = new Map(); // callSid -> { agentFinishedTime, proactiveCount, checkInterval }
  }

  /**
   * Mark when agent finishes speaking
   * @param {string} callSid - Call SID
   */
  agentFinishedSpeaking(callSid) {
    const state = this.callStates.get(callSid) || { proactiveCount: 0 };
    state.agentFinishedTime = Date.now();
    this.callStates.set(callSid, state);
    console.log(`👂 [${callSid}] Agent finished speaking - silence detection active`);
  }

  /**
   * Reset silence timer when user speaks
   * @param {string} callSid - Call SID
   */
  userSpoke(callSid) {
    const state = this.callStates.get(callSid);
    if (state) {
      state.agentFinishedTime = null;
      state.proactiveCount = 0;
      // Clear any pending checks
      if (state.checkInterval) {
        clearInterval(state.checkInterval);
        state.checkInterval = null;
      }
      console.log(`👤 [${callSid}] User spoke - silence timer reset`);
    }
  }

  /**
   * Start monitoring for silence
   * @param {string} callSid - Call SID
   * @param {WebSocket} openaiWs - OpenAI WebSocket connection
   * @param {Object} config - ConversationBehaviorConfig
   */
  startMonitoring(callSid, openaiWs, config) {
    if (!config?.silenceDetection?.enabled) {
      return;
    }

    const state = this.callStates.get(callSid);
    if (!state || !state.agentFinishedTime) {
      return;
    }

    // Clear any existing interval
    if (state.checkInterval) {
      clearInterval(state.checkInterval);
    }

    const threshold = config.silenceDetection.silenceThresholdMs || 15000;
    const maxAttempts = config.silenceDetection.maxProactiveAttempts || 2;

    state.checkInterval = setInterval(() => {
      const currentState = this.callStates.get(callSid);
      if (!currentState || !currentState.agentFinishedTime) {
        this.stopMonitoring(callSid);
        return;
      }

      const silenceDuration = Date.now() - currentState.agentFinishedTime;
      
      if (silenceDuration >= threshold && currentState.proactiveCount < maxAttempts) {
        this.sendProactiveMessage(callSid, openaiWs, config);
      }
    }, 1000); // Check every second
  }

  /**
   * Send proactive engagement message
   * @param {string} callSid - Call SID
   * @param {WebSocket} openaiWs - OpenAI WebSocket connection
   * @param {Object} config - ConversationBehaviorConfig
   */
  sendProactiveMessage(callSid, openaiWs, config) {
    const state = this.callStates.get(callSid);
    if (!state || !openaiWs || openaiWs.readyState !== 1) {
      return;
    }

    const messages = config.silenceDetection.proactiveMessages || [
      "Are you still there?",
      "Is there anything else I can help you with?",
      "Would you like me to continue?"
    ];

    const message = messages[state.proactiveCount % messages.length];
    state.proactiveCount++;

    try {
      openaiWs.send(JSON.stringify({
        type: 'response.create',
        response: {
          modalities: ['audio', 'text'],
          instructions: `Say exactly: "${message}"`
        }
      }));
      console.log(`💬 [${callSid}] Sent proactive message (attempt ${state.proactiveCount}): "${message}"`);
      
      // Reset agent finished time after sending message
      state.agentFinishedTime = Date.now();
    } catch (err) {
      console.error(`❌ [${callSid}] Error sending proactive message:`, err);
    }
  }

  /**
   * Check if silence threshold exceeded and send message if needed
   * @param {string} callSid - Call SID
   * @param {WebSocket} openaiWs - OpenAI WebSocket connection
   * @param {Object} config - ConversationBehaviorConfig
   */
  checkSilence(callSid, openaiWs, config) {
    if (!config?.silenceDetection?.enabled) {
      return;
    }

    const state = this.callStates.get(callSid);
    if (!state || !state.agentFinishedTime) {
      return;
    }

    const silenceDuration = Date.now() - state.agentFinishedTime;
    const threshold = config.silenceDetection.silenceThresholdMs || 15000;
    const maxAttempts = config.silenceDetection.maxProactiveAttempts || 2;

    if (silenceDuration >= threshold && state.proactiveCount < maxAttempts) {
      this.sendProactiveMessage(callSid, openaiWs, config);
    }
  }

  /**
   * Stop monitoring for a call
   * @param {string} callSid - Call SID
   */
  stopMonitoring(callSid) {
    const state = this.callStates.get(callSid);
    if (state && state.checkInterval) {
      clearInterval(state.checkInterval);
      state.checkInterval = null;
    }
  }

  /**
   * Reset tracking for a call
   * @param {string} callSid - Call SID
   */
  reset(callSid) {
    this.stopMonitoring(callSid);
    this.callStates.delete(callSid);
    console.log(`🧹 [${callSid}] Silence detection reset`);
  }

  /**
   * Check if current silence is likely a pause (vs finished speech)
   * @param {string} callSid - Call SID
   * @param {number} pauseDetectionMs - Threshold to distinguish pause from finished
   * @returns {boolean} - True if silence is likely a pause (likely to continue)
   */
  isLikelyPause(callSid, pauseDetectionMs) {
    const state = this.callStates.get(callSid);
    if (!state || !state.agentFinishedTime) {
      return false;
    }
    
    const silenceDuration = Date.now() - state.agentFinishedTime;
    const isPause = silenceDuration < pauseDetectionMs;
    
    console.log(`🔍 [${callSid}] Silence duration: ${silenceDuration}ms, pauseDetection: ${pauseDetectionMs}ms, isLikelyPause: ${isPause}`);
    return isPause;
  }
}

export default new SilenceDetectionService();

