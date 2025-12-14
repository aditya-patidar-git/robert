import { BaseService } from './baseService';

/**
 * Voice Service
 * Handles voice discovery, preview, and configuration
 * @extends BaseService
 */
class VoiceService extends BaseService {
  constructor() {
    super('/api/admin/audio-telephony/voices', {
      dataPath: 'voices',
      normalizeResponse: true
    });
  }

  /**
   * Get all available voices
   * @param {string|null} language - Optional language filter
   * @param {boolean} forceRefresh - Force refresh from API
   * @returns {Promise<Array<Object>>} Array of voice objects
   */
  async getVoices(language = null, forceRefresh = false) {
    const params = {};
    if (language) params.language = language;
    if (forceRefresh) params.forceRefresh = true;
    
    const response = await this.get('', params);
    
    // Handle different response structures
    if (response.data?.status === 'success' && response.data?.voices) {
      return response.data.voices;
    }
    
    return response.data?.voices || response.data || [];
  }

  /**
   * Get specific voice by ID
   * @param {string} voiceId - Voice ID
   * @returns {Promise<Object>} Voice object
   */
  async getVoice(voiceId) {
    const response = await this.get(`/${voiceId}`);
    
    // Handle different response structures
    if (response.data?.status === 'success' && response.data?.voice) {
      return response.data.voice;
    }
    
    return response.data?.voice || response.data;
  }

  /**
   * Preview voice with custom text
   * @param {string} voiceId - Voice ID
   * @param {string} text - Text to preview
   * @param {Object} options - Additional options (modelId, translateTo, etc.)
   * @returns {Promise<Object>} Preview result
   */
  async previewVoice(voiceId, text, options = {}) {
    const requestBody = {
      voiceId,
      text
    };
    
    // Add modelId if provided
    if (options.modelId) {
      requestBody.modelId = options.modelId;
    }
    
    // Add translateTo if provided (language code to translate text to)
    if (options.translateTo) {
      requestBody.translateTo = options.translateTo;
    }
    
    const response = await this.post('/preview', requestBody);
    
    // Handle different response structures
    if (response.data?.status === 'success' && response.data?.preview) {
      return response.data.preview;
    }
    
    return response.data?.preview || response.data;
  }

  /**
   * Set default voice
   * @param {string} voiceId - Voice ID
   * @returns {Promise<Object>} Updated voice object
   */
  async setDefaultVoice(voiceId) {
    const response = await this.patch(`/${voiceId}/default`);
    
    // Handle different response structures
    if (response.data?.status === 'success' && response.data?.voice) {
      return response.data.voice;
    }
    
    return response.data?.voice || response.data;
  }

  /**
   * Get voice discovery status
   * @returns {Promise<Object>} Discovery status
   */
  async getDiscoveryStatus() {
    return this.get('/discovery-status');
  }

  /**
   * Force voice discovery refresh
   * @returns {Promise<Object>} Refresh result
   */
  async refreshVoices() {
    return this.post('/refresh');
  }
}

// Export singleton instance
const voiceService = new VoiceService();
export default voiceService;
