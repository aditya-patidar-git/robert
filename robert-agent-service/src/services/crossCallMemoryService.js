import CallMemory from "../database/models/CallMemory.js";
import summaryService from "./summaryService.js";

/**
 * Cross-Call Memory Service
 * Manages storing and retrieving call summaries for cross-call context
 */
class CrossCallMemoryService {
  /**
   * Store call summary for future reference
   * @param {string} callSid - Call SID
   * @param {string} callerId - Caller phone number
   * @param {Object} summary - Summary object from summaryService
   * @param {Object} metadata - Additional metadata (language, etc.)
   * @returns {Promise<Object>} - Stored CallMemory document
   */
  async storeCallSummary(callSid, callerId, summary, metadata = {}) {
    try {
      // Calculate expiration date (90 days from now, configurable)
      // Get retention from PrivacyConfig if available
      let retentionDays = 90; // Default
      try {
        const PrivacyConfig = (await import("../database/models/PrivacyConfig.js")).default;
        const privacyConfig = await PrivacyConfig.findOne({ isActive: true }).lean().catch(() => null);
        if (privacyConfig?.retentionSettings?.metadataRetention) {
          retentionDays = privacyConfig.retentionSettings.metadataRetention;
        }
      } catch (error) {
        // Use default if PrivacyConfig not available
      }
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + retentionDays);

      const callMemory = new CallMemory({
        callerId,
        callSid,
        summary: {
          purpose: summary.purpose,
          outcome: summary.outcome,
          nextSteps: summary.nextSteps || ''
        },
        keyFacts: summary.keyFacts || [],
        language: metadata.language || 'en-GB',
        consentGiven: metadata.consentGiven || false,
        expiresAt
      });

      await callMemory.save();
      console.log(`✅ [${callSid}] Call summary stored for caller ${callerId}`);
      
      return callMemory;
    } catch (error) {
      console.error(`❌ Error storing call summary for ${callSid}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve previous calls for a caller
   * @param {string} callerId - Caller phone number
   * @param {number} limit - Maximum number of calls to retrieve (default: 5)
   * @returns {Promise<Array>} - Array of CallMemory documents
   */
  async retrievePreviousCalls(callerId, limit = 5) {
    try {
      const now = new Date();
      
      const memories = await CallMemory.find({
        callerId,
        expiresAt: { $gt: now } // Only non-expired memories
      })
        .sort({ createdAt: -1 }) // Most recent first
        .limit(limit)
        .lean();

      console.log(`📚 Retrieved ${memories.length} previous call(s) for caller ${callerId}`);
      return memories;
    } catch (error) {
      console.error(`❌ Error retrieving previous calls for ${callerId}:`, error);
      return [];
    }
  }

  /**
   * Generate consolidated memory summary from already-retrieved calls
   * @param {Array} previousCalls - Array of CallMemory documents
   * @returns {string|null} - Consolidated summary text or null if no calls
   */
  getMemorySummaryFromCalls(previousCalls) {
    try {
      if (!previousCalls || previousCalls.length === 0) {
        return null;
      }

      // Generate a brief consolidated summary
      const summaries = previousCalls.map((memory, index) => {
        const date = new Date(memory.createdAt).toLocaleDateString('en-GB');
        return `Call ${index + 1} (${date}): ${memory.summary.purpose}. Outcome: ${memory.summary.outcome}.`;
      }).join(' ');

      return `Previous interactions with this caller: ${summaries}`;
    } catch (error) {
      console.error(`❌ Error generating memory summary from calls:`, error);
      return null;
    }
  }

  /**
   * Generate consolidated memory summary for a caller
   * @param {string} callerId - Caller phone number
   * @returns {Promise<string>} - Consolidated summary text
   */
  async getMemorySummary(callerId) {
    try {
      const previousCalls = await this.retrievePreviousCalls(callerId, 3); // Last 3 calls
      return this.getMemorySummaryFromCalls(previousCalls);
    } catch (error) {
      console.error(`❌ Error generating memory summary for ${callerId}:`, error);
      return null;
    }
  }

  /**
   * Check if consent is needed for memory recall
   * @param {string} callSid - Current call SID
   * @param {string} callerId - Caller phone number
   * @returns {Promise<boolean>} - True if previous calls exist and consent is needed
   */
  async requestConsentForMemory(callSid, callerId) {
    try {
      // Query for 3 calls (enough for both consent check and summary)
      // This avoids duplicate queries when getMemorySummary is called
      const previousCalls = await this.retrievePreviousCalls(callerId, 3);
      return previousCalls.length > 0;
    } catch (error) {
      console.error(`❌ Error checking memory consent for ${callSid}:`, error);
      return false;
    }
  }

  /**
   * Clean up expired memories (for scheduled jobs)
   * @returns {Promise<number>} - Number of deleted records
   */
  async cleanupExpiredMemories() {
    try {
      const now = new Date();
      const result = await CallMemory.deleteMany({
        expiresAt: { $lt: now }
      });
      
      console.log(`🧹 Cleaned up ${result.deletedCount} expired call memories`);
      return result.deletedCount;
    } catch (error) {
      console.error(`❌ Error cleaning up expired memories:`, error);
      return 0;
    }
  }
}

export default new CrossCallMemoryService();

