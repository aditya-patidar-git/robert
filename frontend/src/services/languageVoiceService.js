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
    try {
      console.log('🔍 [FRONTEND] Calling getLanguageMappings API...');
      const response = await this.get('');
      console.log('📦 [FRONTEND] Raw language mappings response:', response);
      
      // Backend returns: { status: "success", mappings: [...] }
      // After BaseService normalization with dataPath: 'mappings', response.data is already the mappings array
      
      // Check if response.data is already the array (normalized)
      if (Array.isArray(response?.data)) {
        console.log(`✅ [FRONTEND] Found ${response.data.length} mappings in response.data`);
        return response.data;
      }
      
      // Fallback for different response structures
      if (response?.data?.mappings) {
        console.log(`✅ [FRONTEND] Found ${response.data.mappings.length} mappings in response.data.mappings`);
        return response.data.mappings;
      }
      if (response?.mappings) {
        console.log(`✅ [FRONTEND] Found ${response.mappings.length} mappings in response.mappings`);
        return response.mappings;
      }
      if (Array.isArray(response)) {
        console.log(`✅ [FRONTEND] Response is array with ${response.length} items`);
        return response;
      }
      
      console.warn('⚠️ [FRONTEND] No mappings found in response, returning empty array');
      console.warn('⚠️ [FRONTEND] Response structure:', JSON.stringify(response, null, 2));
      return [];
    } catch (error) {
      console.error('❌ [FRONTEND] Error in getLanguageMappings:', error);
      return [];
    }
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

  /**
   * Create new language/voice mapping
   * @param {Object} languageData - Language mapping data
   * @param {string} languageData.languageCode - Language code (e.g., 'zh-CN')
   * @param {string} languageData.languageName - Language name (e.g., 'Chinese')
   * @param {string} languageData.localeCode - Locale code (e.g., 'zh-CN')
   * @param {string} languageData.voiceId - Voice ID
   * @param {string} languageData.voiceName - Voice name (optional)
   * @param {boolean} languageData.isActive - Active status (default: true)
   * @returns {Promise<Object>} Created mapping object
   */
  async createLanguageMapping(languageData) {
    const response = await this.post('', languageData);
    return response.data?.mapping || response.data;
  }
}

// Export singleton instance
const languageVoiceService = new LanguageVoiceService();
export default languageVoiceService;
