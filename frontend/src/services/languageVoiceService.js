import authenticatedApiClient from '../api/authenticatedApi.js';

const languageVoiceService = {
  // Get all language/voice mappings
  async getLanguageMappings() {
    const response = await authenticatedApiClient.get('/api/admin/language-voice-mappings');
    return response.data.mappings || [];
  },

  // Get specific language mapping
  async getLanguageMapping(languageCode) {
    const response = await authenticatedApiClient.get(`/api/admin/language-voice-mappings/${languageCode}`);
    return response.data.mapping;
  },

  // Update language/voice mapping
  async updateLanguageMapping(languageCode, voiceId, voiceName = null, isActive = null) {
    const response = await authenticatedApiClient.put(`/api/admin/language-voice-mappings/${languageCode}`, {
      voiceId,
      voiceName,
      isActive
    });
    return response.data.mapping;
  },

  // Bulk update language mappings
  async bulkUpdateLanguageMappings(mappings) {
    const response = await authenticatedApiClient.put('/api/admin/language-voice-mappings', {
      mappings
    });
    return response.data;
  }
};

export default languageVoiceService;

