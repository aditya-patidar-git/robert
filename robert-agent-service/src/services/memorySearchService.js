/**
 * Memory Search Service
 * Provides search functionality for call memories
 */

import CallMemory from '../database/models/CallMemory.js';

class MemorySearchService {
  /**
   * Search memories by keywords
   * @param {string|Array<string>} keywords - Keywords to search for
   * @param {string} callerId - Optional caller ID to filter by
   * @param {number} limit - Maximum number of results (default: 10)
   * @returns {Promise<Array>} Array of matching CallMemory documents
   */
  async searchByKeywords(keywords, callerId = null, limit = 10) {
    try {
      const keywordArray = Array.isArray(keywords) ? keywords : [keywords];
      const now = new Date();

      // Build search query
      const query = {
        expiresAt: { $gt: now }, // Only non-expired memories
        $or: []
      };

      // Add caller filter if provided
      if (callerId) {
        query.callerId = callerId;
      }

      // Search in summary fields and keyFacts
      keywordArray.forEach(keyword => {
        const regex = new RegExp(keyword, 'i'); // Case-insensitive
        query.$or.push(
          { 'summary.purpose': regex },
          { 'summary.outcome': regex },
          { 'summary.nextSteps': regex },
          { keyFacts: regex }
        );
      });

      const memories = await CallMemory.find(query)
        .sort({ createdAt: -1 }) // Most recent first
        .limit(limit)
        .lean();

      // Calculate relevance scores (simple keyword match count)
      const scoredMemories = memories.map(memory => {
        let score = 0;
        const text = `${memory.summary.purpose} ${memory.summary.outcome} ${memory.summary.nextSteps} ${memory.keyFacts.join(' ')}`.toLowerCase();
        
        keywordArray.forEach(keyword => {
          const matches = (text.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
          score += matches;
        });

        return {
          ...memory,
          relevanceScore: score
        };
      });

      // Sort by relevance score (highest first)
      scoredMemories.sort((a, b) => b.relevanceScore - a.relevanceScore);

      console.log(`🔍 [MEMORY SEARCH] Found ${scoredMemories.length} memories matching keywords: ${keywordArray.join(', ')}`);
      
      return scoredMemories;
    } catch (error) {
      console.error('❌ [MEMORY SEARCH] Error searching by keywords:', error);
      throw error;
    }
  }

  /**
   * Search memories by date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} callerId - Optional caller ID to filter by
   * @param {number} limit - Maximum number of results (default: 10)
   * @returns {Promise<Array>} Array of matching CallMemory documents
   */
  async searchByDateRange(startDate, endDate, callerId = null, limit = 10) {
    try {
      const now = new Date();

      const query = {
        expiresAt: { $gt: now },
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      };

      if (callerId) {
        query.callerId = callerId;
      }

      const memories = await CallMemory.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      console.log(`🔍 [MEMORY SEARCH] Found ${memories.length} memories between ${startDate.toISOString()} and ${endDate.toISOString()}`);
      
      return memories;
    } catch (error) {
      console.error('❌ [MEMORY SEARCH] Error searching by date range:', error);
      throw error;
    }
  }

  /**
   * Search memories by outcome
   * @param {string} outcome - Outcome to search for (resolved, escalated, needs-follow-up, voicemail, error)
   * @param {string} callerId - Optional caller ID to filter by
   * @param {number} limit - Maximum number of results (default: 10)
   * @returns {Promise<Array>} Array of matching CallMemory documents
   */
  async searchByOutcome(outcome, callerId = null, limit = 10) {
    try {
      const now = new Date();

      const query = {
        expiresAt: { $gt: now },
        'summary.outcome': outcome
      };

      if (callerId) {
        query.callerId = callerId;
      }

      const memories = await CallMemory.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      console.log(`🔍 [MEMORY SEARCH] Found ${memories.length} memories with outcome: ${outcome}`);
      
      return memories;
    } catch (error) {
      console.error('❌ [MEMORY SEARCH] Error searching by outcome:', error);
      throw error;
    }
  }

  /**
   * Combined search with multiple criteria
   * @param {Object} criteria - Search criteria
   * @param {string|Array<string>} criteria.keywords - Optional keywords
   * @param {Date} criteria.startDate - Optional start date
   * @param {Date} criteria.endDate - Optional end date
   * @param {string} criteria.outcome - Optional outcome
   * @param {string} criteria.callerId - Optional caller ID
   * @param {number} criteria.limit - Maximum results (default: 10)
   * @returns {Promise<Array>} Array of matching CallMemory documents
   */
  async search(criteria = {}) {
    try {
      const {
        keywords,
        startDate,
        endDate,
        outcome,
        callerId,
        limit = 10
      } = criteria;

      const now = new Date();
      const query = {
        expiresAt: { $gt: now }
      };

      // Add caller filter
      if (callerId) {
        query.callerId = callerId;
      }

      // Add date range filter
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = startDate;
        if (endDate) query.createdAt.$lte = endDate;
      }

      // Add outcome filter
      if (outcome) {
        query['summary.outcome'] = outcome;
      }

      // Add keyword search
      if (keywords) {
        const keywordArray = Array.isArray(keywords) ? keywords : [keywords];
        query.$or = [];
        
        keywordArray.forEach(keyword => {
          const regex = new RegExp(keyword, 'i');
          query.$or.push(
            { 'summary.purpose': regex },
            { 'summary.outcome': regex },
            { 'summary.nextSteps': regex },
            { keyFacts: regex }
          );
        });
      }

      const memories = await CallMemory.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      // Calculate relevance scores if keywords provided
      let scoredMemories = memories;
      if (keywords) {
        const keywordArray = Array.isArray(keywords) ? keywords : [keywords];
        scoredMemories = memories.map(memory => {
          let score = 0;
          const text = `${memory.summary.purpose} ${memory.summary.outcome} ${memory.summary.nextSteps} ${memory.keyFacts.join(' ')}`.toLowerCase();
          
          keywordArray.forEach(keyword => {
            const matches = (text.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
            score += matches;
          });

          return {
            ...memory,
            relevanceScore: score
          };
        });

        // Sort by relevance score
        scoredMemories.sort((a, b) => b.relevanceScore - a.relevanceScore);
      }

      console.log(`🔍 [MEMORY SEARCH] Combined search found ${scoredMemories.length} memories`);
      
      return scoredMemories;
    } catch (error) {
      console.error('❌ [MEMORY SEARCH] Error in combined search:', error);
      throw error;
    }
  }
}

export default new MemorySearchService();

