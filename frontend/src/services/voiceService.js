import authenticatedApiClient from '../api/authenticatedApi.js';

const voiceService = {
  // Get all available voices
  async getVoices(language = null, forceRefresh = false) {
    const params = {};
    if (language) params.language = language;
    if (forceRefresh) params.forceRefresh = true;
    
    const response = await authenticatedApiClient.get('/api/admin/audio-telephony/voices', { params });
    const data = response.data;
    
    // Handle the response structure from backend
    if (data.status === 'success' && data.voices) {
      return data.voices;
    }
    
    // Fallback to original structure if response format is different
    return data.voices || data || [];
  },

  // Get specific voice by ID
  async getVoice(voiceId) {
    const response = await authenticatedApiClient.get(`/api/admin/audio-telephony/voices/${voiceId}`);
    const data = response.data;
    
    // Handle the response structure from backend
    if (data.status === 'success' && data.voice) {
      return data.voice;
    }
    
    // Fallback to original structure if response format is different
    return data.voice || data;
  },

  // Preview voice with custom text
  async previewVoice(voiceId, text) {
    const response = await authenticatedApiClient.post('/api/admin/audio-telephony/voices/preview', {
      voiceId,
      text
    });
    const data = response.data;
    
    // Handle the response structure from backend
    if (data.status === 'success' && data.preview) {
      return data.preview;
    }
    
    // Fallback to original structure if response format is different
    return data.preview || data;
  },

  // Set default voice
  async setDefaultVoice(voiceId) {
    const response = await authenticatedApiClient.patch(`/api/admin/audio-telephony/voices/${voiceId}/default`);
    const data = response.data;
    
    // Handle the response structure from backend
    if (data.status === 'success' && data.voice) {
      return data.voice;
    }
    
    // Fallback to original structure if response format is different
    return data.voice || data;
  },

  // Get voice discovery status
  async getDiscoveryStatus() {
    const response = await authenticatedApiClient.get('/api/admin/audio-telephony/voices/discovery-status');
    return response.data;
  },

  // Force voice discovery refresh
  async refreshVoices() {
    const response = await authenticatedApiClient.post('/api/admin/audio-telephony/voices/refresh');
    return response.data;
  }
};

export default voiceService;