import authenticatedApiClient from '../api/authenticatedApi.js';

const transcriptService = {
  // Get all transcripts with pagination and filtering
  async getAllTranscripts(params = {}) {
    const response = await authenticatedApiClient.get('/api/transcripts', { params });
    return response.data;
  },

  // Delete or redact transcript
  async deleteTranscript(transcriptId, redact = false) {
    const response = await authenticatedApiClient.delete(`/api/transcripts/${transcriptId}`, {
      data: { redact }
    });
    return response.data;
  },

  // Submit complaint
  async submitComplaint(complaintData) {
    const response = await authenticatedApiClient.post('/api/transcripts/complaint', complaintData);
    return response.data;
  },

  // Get recording URL (if available)
  async getRecordingUrl(callSid) {
    // This would typically come from the transcript data
    // For now, we'll construct it based on Twilio patterns
    const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
    return `${API_BASE}/api/outbound/recording/${callSid}`;
  }
};

export default transcriptService;