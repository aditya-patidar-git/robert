import authenticatedApiClient from '../api/authenticatedApi.js';

const transcriptService = {
  // Get all transcripts with pagination and filtering
  async getAllTranscripts(params = {}) {
    const response = await authenticatedApiClient.get('/api/transcripts', { params });
    return response.data;
  },

  // Get specific transcript with full details (escalations, complaints, provenance)
  async getTranscript(transcriptId) {
    const response = await authenticatedApiClient.get(`/api/transcripts/${transcriptId}`);
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

  // Export transcripts
  async exportTranscripts(params = {}) {
    const { format = 'csv', id, ...filters } = params;
    const response = await authenticatedApiClient.get('/api/transcripts/export', {
      params: { format, ...filters },
      responseType: 'blob'
    });
    return response.data;
  },

  // Get escalation timeline for a call
  async getEscalationTimeline(callId) {
    const response = await authenticatedApiClient.get(`/api/transcripts/${callId}/escalations`);
    return response.data;
  },

  // Get recording URL (if available)
  async getRecordingUrl(callSid) {
    // Use the outbound recording proxy endpoint
    const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
    return `${API_BASE}/api/outbound/recording/${callSid}`;
  }
};

export default transcriptService;