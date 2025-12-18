/**
 * Memory Analytics Service
 * Tracks memory usage, consent rates, and effectiveness
 */

import CallMemory from '../database/models/CallMemory.js';

class MemoryAnalyticsService {
  /**
   * Get overall memory statistics
   * @returns {Promise<Object>} Memory statistics
   */
  async getMemoryStats() {
    try {
      const now = new Date();

      // Total memories (non-expired)
      const totalMemories = await CallMemory.countDocuments({
        expiresAt: { $gt: now }
      });

      // Total memories (all time)
      const totalMemoriesAllTime = await CallMemory.countDocuments();

      // Memories with consent
      const memoriesWithConsent = await CallMemory.countDocuments({
        expiresAt: { $gt: now },
        consentGiven: true
      });

      // Memories by outcome
      const outcomeStats = await CallMemory.aggregate([
        {
          $match: {
            expiresAt: { $gt: now }
          }
        },
        {
          $group: {
            _id: '$summary.outcome',
            count: { $sum: 1 }
          }
        }
      ]);

      // Memories by language
      const languageStats = await CallMemory.aggregate([
        {
          $match: {
            expiresAt: { $gt: now }
          }
        },
        {
          $group: {
            _id: '$language',
            count: { $sum: 1 }
          }
        }
      ]);

      // Average key facts per memory
      const avgKeyFacts = await CallMemory.aggregate([
        {
          $match: {
            expiresAt: { $gt: now }
          }
        },
        {
          $project: {
            keyFactsCount: { $size: { $ifNull: ['$keyFacts', []] } }
          }
        },
        {
          $group: {
            _id: null,
            avg: { $avg: '$keyFactsCount' }
          }
        }
      ]);

      const stats = {
        totalMemories,
        totalMemoriesAllTime,
        memoriesWithConsent,
        consentRate: totalMemories > 0 ? (memoriesWithConsent / totalMemories) * 100 : 0,
        outcomeDistribution: outcomeStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        languageDistribution: languageStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        avgKeyFactsPerMemory: avgKeyFacts[0]?.avg || 0,
        timestamp: new Date().toISOString()
      };

      return stats;
    } catch (error) {
      console.error('❌ [MEMORY ANALYTICS] Error getting memory stats:', error);
      throw error;
    }
  }

  /**
   * Get consent rate
   * @param {string} callerId - Optional caller ID to filter by
   * @returns {Promise<number>} Consent rate as percentage
   */
  async getConsentRate(callerId = null) {
    try {
      const now = new Date();
      const query = {
        expiresAt: { $gt: now }
      };

      if (callerId) {
        query.callerId = callerId;
      }

      const total = await CallMemory.countDocuments(query);
      const withConsent = await CallMemory.countDocuments({
        ...query,
        consentGiven: true
      });

      return total > 0 ? (withConsent / total) * 100 : 0;
    } catch (error) {
      console.error('❌ [MEMORY ANALYTICS] Error getting consent rate:', error);
      throw error;
    }
  }

  /**
   * Get usage rate (how often memories are retrieved)
   * Note: This requires tracking retrieval events, which can be added later
   * For now, we'll estimate based on memory age and expiration
   * @param {string} callerId - Optional caller ID to filter by
   * @returns {Promise<Object>} Usage statistics
   */
  async getUsageRate(callerId = null) {
    try {
      const now = new Date();
      const query = {
        expiresAt: { $gt: now }
      };

      if (callerId) {
        query.callerId = callerId;
      }

      // Get memories created in the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentMemories = await CallMemory.countDocuments({
        ...query,
        createdAt: { $gte: thirtyDaysAgo }
      });

      const totalMemories = await CallMemory.countDocuments(query);

      // Calculate average memory age
      const ageStats = await CallMemory.aggregate([
        {
          $match: query
        },
        {
          $project: {
            ageInDays: {
              $divide: [
                { $subtract: [now, '$createdAt'] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            avgAge: { $avg: '$ageInDays' },
            maxAge: { $max: '$ageInDays' },
            minAge: { $min: '$ageInDays' }
          }
        }
      ]);

      return {
        totalMemories,
        recentMemories,
        recentMemoryRate: totalMemories > 0 ? (recentMemories / totalMemories) * 100 : 0,
        avgMemoryAge: ageStats[0]?.avgAge || 0,
        maxMemoryAge: ageStats[0]?.maxAge || 0,
        minMemoryAge: ageStats[0]?.minAge || 0
      };
    } catch (error) {
      console.error('❌ [MEMORY ANALYTICS] Error getting usage rate:', error);
      throw error;
    }
  }

  /**
   * Get effectiveness metrics
   * Measures how effective memory is (e.g., memories that lead to resolved outcomes)
   * @returns {Promise<Object>} Effectiveness metrics
   */
  async getEffectivenessMetrics() {
    try {
      const now = new Date();

      // Memories with resolved outcomes
      const resolvedMemories = await CallMemory.countDocuments({
        expiresAt: { $gt: now },
        'summary.outcome': 'resolved',
        consentGiven: true
      });

      // Total memories with consent
      const totalWithConsent = await CallMemory.countDocuments({
        expiresAt: { $gt: now },
        consentGiven: true
      });

      // Memories that led to escalation
      const escalatedMemories = await CallMemory.countDocuments({
        expiresAt: { $gt: now },
        'summary.outcome': 'escalated',
        consentGiven: true
      });

      return {
        resolvedRate: totalWithConsent > 0 ? (resolvedMemories / totalWithConsent) * 100 : 0,
        escalationRate: totalWithConsent > 0 ? (escalatedMemories / totalWithConsent) * 100 : 0,
        resolvedCount: resolvedMemories,
        escalatedCount: escalatedMemories,
        totalWithConsent
      };
    } catch (error) {
      console.error('❌ [MEMORY ANALYTICS] Error getting effectiveness metrics:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive analytics report
   * @returns {Promise<Object>} Complete analytics report
   */
  async getAnalyticsReport() {
    try {
      const [stats, consentRate, usageRate, effectiveness] = await Promise.all([
        this.getMemoryStats(),
        this.getConsentRate(),
        this.getUsageRate(),
        this.getEffectivenessMetrics()
      ]);

      return {
        stats,
        consentRate,
        usageRate,
        effectiveness,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ [MEMORY ANALYTICS] Error generating analytics report:', error);
      throw error;
    }
  }
}

export default new MemoryAnalyticsService();

