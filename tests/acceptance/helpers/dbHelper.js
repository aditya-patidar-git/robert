/**
 * Database Helper
 * Provides utilities for querying CallRecord and other database models
 * Single responsibility: database queries only
 */

import mongoose from 'mongoose';
import testConfig from '../config/testConfig.js';

class DBHelper {
  /**
   * Get CallRecord model (dynamically imported)
   */
  async getCallRecordModel() {
    if (mongoose.models.CallRecord) {
      return mongoose.models.CallRecord;
    }
    
    // Import CallRecord model dynamically
    const CallRecordModule = await import('../../robert-agent-service/src/database/models/CallRecord.js');
    return CallRecordModule.default;
  }

  /**
   * Get CallRecord by callSid
   * @param {string} callSid - Twilio Call SID
   * @returns {Promise<Object|null>} CallRecord document or null
   */
  async getCallRecord(callSid) {
    try {
      const CallRecord = await this.getCallRecordModel();
      const callRecord = await CallRecord.findOne({ callSid }).lean();
      return callRecord;
    } catch (error) {
      console.error(`[DBHelper] Error fetching CallRecord for ${callSid}:`, error.message);
      throw error;
    }
  }

  /**
   * Wait for transcript entries to appear in CallRecord
   * @param {string} callSid - Twilio Call SID
   * @param {number} timeout - Maximum time to wait (ms)
   * @param {number} minEntries - Minimum number of transcript entries to wait for
   * @returns {Promise<Array>} Array of transcript entries
   */
  async waitForTranscript(callSid, timeout = testConfig.transcriptWaitTimeout || 10000, minEntries = 1) {
    const startTime = Date.now();
    const pollInterval = testConfig.pollInterval || 500;

    while (Date.now() - startTime < timeout) {
      const callRecord = await this.getCallRecord(callSid);
      
      if (callRecord && callRecord.transcript && callRecord.transcript.length >= minEntries) {
        return callRecord.transcript;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    const callRecord = await this.getCallRecord(callSid);
    const transcript = callRecord?.transcript || [];
    
    if (transcript.length < minEntries) {
      throw new Error(
        `Transcript did not reach ${minEntries} entries within ${timeout}ms. ` +
        `Found ${transcript.length} entries.`
      );
    }

    return transcript;
  }

  /**
   * Get all agent transcript entries from CallRecord
   * @param {string} callSid - Twilio Call SID
   * @returns {Promise<Array>} Array of agent transcript entries
   */
  async getAgentTranscripts(callSid) {
    try {
      const callRecord = await this.getCallRecord(callSid);
      
      if (!callRecord || !callRecord.transcript) {
        return [];
      }

      return callRecord.transcript.filter(entry => entry.role === 'agent');
    } catch (error) {
      console.error(`[DBHelper] Error fetching agent transcripts for ${callSid}:`, error.message);
      throw error;
    }
  }

  /**
   * Get first agent transcript entry (greeting)
   * @param {string} callSid - Twilio Call SID
   * @returns {Promise<Object|null>} First agent transcript entry or null
   */
  async getFirstAgentTranscript(callSid) {
    const agentTranscripts = await this.getAgentTranscripts(callSid);
    return agentTranscripts.length > 0 ? agentTranscripts[0] : null;
  }

  /**
   * Get language field from CallRecord
   * @param {string} callSid - Twilio Call SID
   * @returns {Promise<string|null>} Language code (e.g., 'en-GB', 'fr', 'fr-FR') or null
   */
  async getCallLanguage(callSid) {
    try {
      const callRecord = await this.getCallRecord(callSid);
      return callRecord?.language || null;
    } catch (error) {
      console.error(`[DBHelper] Error fetching language for ${callSid}:`, error.message);
      throw error;
    }
  }

  /**
   * Wait for language field to change to a specific value
   * @param {string} callSid - Twilio Call SID
   * @param {string} expectedLanguage - Expected language code (e.g., 'fr', 'fr-FR')
   * @param {number} timeout - Maximum time to wait (ms)
   * @returns {Promise<string>} Final language value
   */
  async waitForLanguageChange(callSid, expectedLanguage, timeout = 5000) {
    const startTime = Date.now();
    const pollInterval = testConfig.pollInterval || 500;

    while (Date.now() - startTime < timeout) {
      const language = await this.getCallLanguage(callSid);
      
      // Check if language matches (support both 'fr' and 'fr-FR' formats)
      if (language && (
        language === expectedLanguage ||
        language.startsWith(expectedLanguage) ||
        expectedLanguage.startsWith(language)
      )) {
        return language;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    const finalLanguage = await this.getCallLanguage(callSid);
    throw new Error(
      `Language did not change to ${expectedLanguage} within ${timeout}ms. ` +
      `Current language: ${finalLanguage || 'null'}`
    );
  }

  /**
   * Get call creation timestamp from CallRecord
   * @param {string} callSid - Twilio Call SID
   * @returns {Promise<Date|null>} Call creation timestamp or null
   */
  async getCallCreatedAt(callSid) {
    try {
      const callRecord = await this.getCallRecord(callSid);
      return callRecord?.createdAt || null;
    } catch (error) {
      console.error(`[DBHelper] Error fetching createdAt for ${callSid}:`, error.message);
      throw error;
    }
  }

  /**
   * Get live transcript from agent service diagnostic endpoint
   * Reusable method for all tests needing real-time transcript access
   * @param {string} callSid - Twilio Call SID
   * @returns {Promise<Array>} Array of transcript entries
   */
  async getLiveTranscript(callSid) {
    try {
      // Use TUNNEL_DOMAIN if available, otherwise fallback to AGENT_SERVICE_URL or localhost
      const agentServiceUrl = process.env.TUNNEL_DOMAIN 
        ? `https://${process.env.TUNNEL_DOMAIN}` 
        : (process.env.AGENT_SERVICE_URL || 'http://localhost:3002');
      
      const diagnosticUrl = `${agentServiceUrl}/api/diagnostic/call/${callSid}`;
      const response = await fetch(diagnosticUrl);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        throw new Error(`Failed to fetch live transcript: ${response.status} ${response.statusText}. Response: ${errorText.substring(0, 200)}`);
      }
      
      const data = await response.json();
      const transcript = data.transcript || [];
      
      // Log diagnostic info if available
      if (data.hasConversation !== undefined) {
        console.log(`[DBHelper] Diagnostic endpoint response: hasConversation=${data.hasConversation}, transcript.length=${transcript.length}`);
      }
      
      return transcript;
    } catch (error) {
      // Enhanced error logging
      if (error.message.includes('Failed to fetch')) {
        const agentServiceUrl = process.env.TUNNEL_DOMAIN 
          ? `https://${process.env.TUNNEL_DOMAIN}` 
          : (process.env.AGENT_SERVICE_URL || 'http://localhost:3002');
        console.error(`[DBHelper] Network error fetching live transcript for ${callSid}`);
        console.error(`[DBHelper] Diagnostic URL: ${agentServiceUrl}/api/diagnostic/call/${callSid}`);
        console.error(`[DBHelper] Error: ${error.message}`);
      } else {
        console.error(`[DBHelper] Error fetching live transcript for ${callSid}:`, error.message);
      }
      throw error;
    }
  }

  /**
   * Get first agent transcript entry from live transcript
   * @param {string} callSid - Twilio Call SID
   * @returns {Promise<Object|null>} First agent transcript entry or null
   */
  async getFirstAgentLiveTranscript(callSid) {
    const transcript = await this.getLiveTranscript(callSid);
    const agentTranscripts = transcript.filter(entry => entry.role === 'agent');
    return agentTranscripts.length > 0 ? agentTranscripts[0] : null;
  }

  /**
   * Wait for live transcript entries to appear
   * Reusable polling utility with configurable timeout and min entries
   * @param {string} callSid - Twilio Call SID
   * @param {number} timeout - Maximum time to wait (ms)
   * @param {number} minEntries - Minimum number of transcript entries to wait for
   * @returns {Promise<Array>} Array of transcript entries
   */
  async waitForLiveTranscript(callSid, timeout = testConfig.transcriptWaitTimeout || 10000, minEntries = 1) {
    const startTime = Date.now();
    const pollInterval = testConfig.pollInterval || 500;
    let pollCount = 0;

    console.log(`[DBHelper] Polling diagnostic endpoint for call ${callSid}...`);
    console.log(`[DBHelper] Waiting for at least ${minEntries} transcript entry/entries (timeout: ${timeout}ms)`);

    while (Date.now() - startTime < timeout) {
      pollCount++;
      const elapsed = Date.now() - startTime;
      
      try {
        const transcript = await this.getLiveTranscript(callSid);
        
        // Log progress every 2 seconds (every 4 polls) or when entries found
        if (pollCount % 4 === 0 || transcript.length >= minEntries) {
          console.log(`[DBHelper] Poll #${pollCount} (${elapsed}ms elapsed): Found ${transcript.length} transcript entries`);
          if (transcript.length > 0) {
            const agentEntries = transcript.filter(e => e.role === 'agent').length;
            const userEntries = transcript.filter(e => e.role === 'user').length;
            console.log(`[DBHelper]   - Agent entries: ${agentEntries}, User entries: ${userEntries}`);
          }
        }
        
        if (transcript.length >= minEntries) {
          const totalTime = Date.now() - startTime;
          console.log(`[DBHelper] ✓ Transcript ready after ${totalTime}ms (${pollCount} polls)`);
          return transcript;
        }
      } catch (error) {
        // If endpoint not available yet, continue polling
        if (error.message.includes('Failed to fetch')) {
          if (pollCount % 4 === 0) {
            const elapsed = Date.now() - startTime;
            console.log(`[DBHelper] Poll #${pollCount} (${elapsed}ms elapsed): Endpoint not available yet, continuing...`);
          }
        } else {
          console.error(`[DBHelper] Error during polling (poll #${pollCount}):`, error.message);
          throw error;
        }
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // Final attempt
    console.log(`[DBHelper] Timeout reached, making final attempt...`);
    const finalTranscript = await this.getLiveTranscript(callSid);
    console.log(`[DBHelper] Final transcript count: ${finalTranscript.length} entries`);
    
    if (finalTranscript.length < minEntries) {
      console.error(`[DBHelper] ✗ Transcript did not reach ${minEntries} entries within ${timeout}ms`);
      console.error(`[DBHelper] Found ${finalTranscript.length} entries after ${pollCount} polls`);
      if (finalTranscript.length > 0) {
        console.error(`[DBHelper] Available entries:`, finalTranscript.map(e => ({ role: e.role, text: e.text?.substring(0, 50) || 'N/A' })));
      }
      throw new Error(
        `Live transcript did not reach ${minEntries} entries within ${timeout}ms. ` +
        `Found ${finalTranscript.length} entries after ${pollCount} polls.`
      );
    }

    return finalTranscript;
  }
}

export const dbHelper = new DBHelper();
export default dbHelper;
