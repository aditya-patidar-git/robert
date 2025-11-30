/**
 * SIP Service
 * Handles OpenAI Realtime SIP connector configuration and management
 * Primary path: Twilio Elastic SIP Trunk → OpenAI Realtime SIP endpoint
 */

import dotenv from "dotenv";

dotenv.config();

class SipService {
  constructor() {
    this.openaiSipEndpoint = process.env.OPENAI_SIP_ENDPOINT || null;
    this.sipEnabled = process.env.SIP_ENABLED === 'true' || false;
  }

  /**
   * Check if SIP is enabled and configured
   * @returns {boolean} - True if SIP is available
   */
  isSipEnabled() {
    return this.sipEnabled && this.openaiSipEndpoint !== null;
  }

  /**
   * Get OpenAI SIP endpoint URL
   * @returns {string|null} - SIP endpoint URL or null
   */
  getSipEndpoint() {
    return this.openaiSipEndpoint;
  }

  /**
   * Configure SIP session for OpenAI Realtime
   * @param {Object} config - Configuration object
   * @param {string} config.voice - Voice ID
   * @param {string} config.instructions - System instructions
   * @param {Array} config.tools - Tool definitions
   * @param {Object} config.sessionParams - Additional session parameters
   * @returns {Object} - SIP configuration for OpenAI
   */
  configureSipSession(config) {
    if (!this.isSipEnabled()) {
      throw new Error('SIP is not enabled or configured');
    }

    return {
      voice: config.voice || 'ash',
      instructions: config.instructions || 'You are a friendly AI assistant.',
      tools: config.tools || [],
      session: {
        modalities: ['audio', 'text'],
        input_audio_format: 'g711_ulaw',
        output_audio_format: 'g711_ulaw',
        turn_detection: {
          type: 'server_vad',
          threshold: config.vadThreshold || 0.5,
          prefix_padding_ms: config.startPadding || 300,
          silence_duration_ms: config.endPadding || 500
        },
        temperature: config.temperature || 0.4,
        ...config.sessionParams
      }
    };
  }

  /**
   * Validate SIP configuration
   * @param {Object} config - Configuration to validate
   * @returns {Object} - Validation result
   */
  validateSipConfig(config) {
    const errors = [];

    if (!config.voice) {
      errors.push('Voice is required');
    }

    if (!config.instructions) {
      errors.push('Instructions are required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default new SipService();

