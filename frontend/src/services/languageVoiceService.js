import { BaseService } from './baseService';

/**
 * Language Voice Mapping Service
 * Handles language-to-voice mappings configuration
 * @extends BaseService
 */
class LanguageVoiceService extends BaseService {
  constructor() {
    super('/api/admin/language-voice-mappings', {
      dataPath: 'mappings',
      normalizeResponse: true
    });
  }

  /**
   * Get all language/voice mappings
   * @returns {Promise<Array<Object>>} Array of mapping objects
   */
  async getLanguageMappings() {
    const response = await this.get('');
    return response.data || [];
  }

  /**
   * Get specific language mapping
   * @param {string} languageCode - Language code (e.g., 'en-US')
   * @returns {Promise<Object>} Mapping object
   */
  async getLanguageMapping(languageCode) {
    const response = await this.get(`/${languageCode}`);
    return response.data?.mapping || response.data;
  }

  /**
   * Update language/voice mapping
   * @param {string} languageCode - Language code
   * @param {string} voiceId - Voice ID
   * @param {string|null} voiceName - Optional voice name
   * @param {boolean|null} isActive - Optional active status
   * @returns {Promise<Object>} Updated mapping object
   */
  async updateLanguageMapping(languageCode, voiceId, voiceName = null, isActive = null) {
    const response = await this.put(`/${languageCode}`, {
      voiceId,
      voiceName,
      isActive
    });
    return response.data?.mapping || response.data;
  }

  /**
   * Bulk update language mappings
   * @param {Array<Object>} mappings - Array of mapping objects
   * @returns {Promise<Object>} Update result
   */
  async bulkUpdateLanguageMappings(mappings) {
    return this.put('', {
      mappings
    });
  }
}

// Export singleton instance
const languageVoiceService = new LanguageVoiceService();
export default languageVoiceService;
