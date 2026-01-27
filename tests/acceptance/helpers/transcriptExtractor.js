/**
 * Transcript Extractor
 * Reusable utility for extracting transcripts from CallRecord
 * Single responsibility: transcript extraction only
 */

import mongoose from 'mongoose';

class TranscriptExtractor {
  /**
   * Extract transcript text from CallRecord
   * @param {string} callSid - Call SID
   * @param {Object} options - Options
   * @param {number} options.timeout - Max time to wait for transcript (default: 10000ms)
   * @param {number} options.retryInterval - Retry interval in ms (default: 500ms)
   * @returns {Promise<string>} - Transcript text
   */
  async extractTranscript(callSid, options = {}) {
    const timeout = options.timeout || 10000;
    const retryInterval = options.retryInterval || 500;
    const startTime = Date.now();

    const CallRecord = mongoose.models.CallRecord || 
      (await import('../../robert-agent-service/src/database/models/CallRecord.js')).default;

    while (Date.now() - startTime < timeout) {
      const callRecord = await CallRecord.findOne({ callSid }).lean();
      
      if (callRecord && callRecord.transcript && callRecord.transcript.length > 0) {
        return this.formatTranscript(callRecord.transcript);
      }
      
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }

    throw new Error(`Transcript not available for call ${callSid} within ${timeout}ms`);
  }

  /**
   * Format transcript array into text string
   * @param {Array} transcript - Transcript array from CallRecord
   * @returns {string} - Formatted transcript text
   */
  formatTranscript(transcript) {
    if (!Array.isArray(transcript)) {
      return '';
    }

    return transcript
      .map(segment => {
        if (typeof segment === 'string') {
          return segment;
        }
        if (segment.text) {
          return segment.text;
        }
        if (segment.content) {
          return segment.content;
        }
        return '';
      })
      .filter(text => text.trim().length > 0)
      .join(' ');
  }

  /**
   * Extract transcript segments with metadata
   * @param {string} callSid - Call SID
   * @returns {Promise<Array>} - Transcript segments with metadata
   */
  async extractTranscriptSegments(callSid) {
    const CallRecord = mongoose.models.CallRecord || 
      (await import('../../robert-agent-service/src/database/models/CallRecord.js')).default;

    const callRecord = await CallRecord.findOne({ callSid }).lean();
    
    if (!callRecord || !callRecord.transcript) {
      return [];
    }

    return callRecord.transcript;
  }

  /**
   * Extract transcript by role (user or assistant)
   * @param {string} callSid - Call SID
   * @param {string} role - Role to filter ('user' or 'assistant')
   * @returns {Promise<string>} - Filtered transcript text
   */
  async extractTranscriptByRole(callSid, role) {
    const segments = await this.extractTranscriptSegments(callSid);
    
    const filtered = segments.filter(segment => {
      if (typeof segment === 'string') {
        return false; // Can't determine role from string
      }
      return segment.role === role || segment.speaker === role;
    });

    return this.formatTranscript(filtered);
  }
}

export const transcriptExtractor = new TranscriptExtractor();
export default transcriptExtractor;
