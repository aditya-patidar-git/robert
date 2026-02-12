import { BaseService } from './baseService';

/**
 * Transcript Service
 * Handles transcript retrieval, deletion, complaints, and exports
 * @extends BaseService
 */
class TranscriptService extends BaseService {
  constructor() {
    super('/api/transcripts', {
      dataPath: null,
      normalizeResponse: true
    });
  }

  /**
   * Get all transcripts with pagination and filtering
   * @param {Object} params - Query parameters (page, limit, filters, etc.)
   * @returns {Promise<Object>} Transcripts data with pagination
   */
  async getAllTranscripts(params = {}) {
    return this.get('', params);
  }

  /**
   * Get specific transcript with full details (escalations, complaints, provenance)
   * @param {string} transcriptId - Transcript ID
   * @returns {Promise<Object>} Transcript details
   */
  async getTranscript(transcriptId) {
    return this.get(`/${transcriptId}`);
  }

  /**
   * Delete or redact transcript
   * @param {string} transcriptId - Transcript ID
   * @param {boolean} redact - Whether to redact instead of delete (default: false)
   * @returns {Promise<Object>} Deletion/redaction result
   */
  async deleteTranscript(transcriptId, redact = false) {
    return this.delete(`/${transcriptId}`, {
      data: { redact }
    });
  }

  /**
   * Submit complaint
   * @param {Object} complaintData - Complaint data
   * @returns {Promise<Object>} Complaint submission result
   */
  async submitComplaint(complaintData) {
    return this.post('/complaint', complaintData);
  }

  /**
   * Export transcripts
   * @param {Object} params - Export parameters (format, id, filters, etc.)
   * @param {string} params.format - Export format ('csv' or 'json')
   * @returns {Promise<Blob>} Exported file (Blob)
   */
  async exportTranscripts(params = {}) {
    const { format = 'csv', id, ...filters } = params;
    const response = await this.get('/export', { format, ...filters }, {
      responseType: 'blob',
      normalizeResponse: false // Don't normalize blob responses
    });
    return response.data;
  }

  /**
   * Get escalation timeline for a call
   * @param {string} callId - Call ID
   * @returns {Promise<Object>} Escalation timeline
   */
  async getEscalationTimeline(callId) {
    return this.get(`/${callId}/escalations`);
  }

  /**
   * Get recording URL (if available)
   * @param {string} callSid - Call SID
   * @returns {string} Recording URL
   */
  async getRecordingUrl(callSid) {
    const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
    return `${API_BASE}/api/outbound/recording/${callSid}`;
  }

  /**
   * Ensure recording URLs are backfilled for the given call SIDs (for current page prefetch).
   * @param {string[]} callSids - Call SIDs for the current page
   * @returns {Promise<{ensured: number}>}
   */
  async ensureRecordings(callSids) {
    if (!Array.isArray(callSids) || callSids.length === 0) return { ensured: 0 };
    const response = await this.post('/ensure-recordings', { callSids });
    return response?.data ?? response ?? { ensured: 0 };
  }
}

// Export singleton instance
const transcriptService = new TranscriptService();
export default transcriptService;
