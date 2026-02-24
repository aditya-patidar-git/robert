/**
 * Groundedness KPI Service
 * Calculates groundedness metrics for AI responses based on KB usage and citations
 */

import CallRecord from '../models/CallRecord.js';

/**
 * Groundedness KPI Service
 * Measures how well AI responses are grounded in knowledge base
 */
class GroundednessKPIService {
  /**
   * Calculate groundedness score for a call
   * @param {string} callSid - Call SID
   * @returns {Promise<Object>} Groundedness metrics
   */
  async calculateCallGroundedness(callSid) {
    try {
      const callRecord = await CallRecord.findOne({ callSid });
      if (!callRecord) {
        return null;
      }

      const metrics = {
        callSid,
        groundednessScore: 0,
        kbUsageRate: 0,
        averageSimilarityScore: 0,
        citationsCount: 0,
        ungroundedResponses: 0,
        totalResponses: 0,
        provenanceCount: callRecord.provenance?.length || 0
      };

      // Count KB queries (provenance entries)
      if (callRecord.provenance && callRecord.provenance.length > 0) {
        metrics.citationsCount = callRecord.provenance.length;
        
        // Calculate average similarity score
        const similarityScores = callRecord.provenance
          .map(p => p.similarityScore)
          .filter(score => score !== null && score !== undefined);
        
        if (similarityScores.length > 0) {
          metrics.averageSimilarityScore = 
            similarityScores.reduce((sum, score) => sum + score, 0) / similarityScores.length;
        }
      }

      // Count transcript entries to estimate total responses
      if (callRecord.transcript && callRecord.transcript.length > 0) {
        metrics.totalResponses = callRecord.transcript.filter(
          entry => entry.role === 'agent'
        ).length;
      }

      // Calculate KB usage rate
      if (metrics.totalResponses > 0) {
        metrics.kbUsageRate = metrics.citationsCount / metrics.totalResponses;
      } else if (metrics.citationsCount > 0) {
        // If we have citations but no transcript, assume KB was used
        metrics.kbUsageRate = 1.0;
      }

      // Calculate groundedness score (0-1)
      // Based on: KB usage rate (40%), similarity scores (40%), citation quality (20%)
      const kbUsageWeight = 0.4;
      const similarityWeight = 0.4;
      const citationQualityWeight = 0.2;

      const kbUsageScore = Math.min(metrics.kbUsageRate, 1.0);
      const similarityScore = metrics.averageSimilarityScore;
      const citationQualityScore = metrics.citationsCount > 0 ? 
        Math.min(metrics.citationsCount / 5, 1.0) : 0; // Normalize to max 5 citations

      metrics.groundednessScore = 
        (kbUsageScore * kbUsageWeight) +
        (similarityScore * similarityWeight) +
        (citationQualityScore * citationQualityWeight);

      metrics.ungroundedResponses = Math.max(0, metrics.totalResponses - metrics.citationsCount);

      return metrics;
    } catch (error) {
      console.error('Error calculating call groundedness:', error);
      throw error;
    }
  }

  /**
   * Get aggregated groundedness metrics
   * @param {Object} filters - Filter criteria (dateRange, status)
   * @returns {Promise<Object>} Aggregated groundedness metrics
   */
  async getAggregatedGroundedness(filters = {}) {
    try {
      const query = {};

      if (filters.dateRange) {
        query.createdAt = {
          $gte: new Date(filters.dateRange.start),
          $lte: new Date(filters.dateRange.end)
        };
      }

      if (filters.status) {
        query.callStatus = filters.status;
      }

      const callRecords = await CallRecord.find(query)
        .select('callSid transcript provenance result escalation');

      const aggregated = {
        totalCalls: callRecords.length,
        averageGroundednessScore: 0,
        averageKBUsageRate: 0,
        averageSimilarityScore: 0,
        totalCitations: 0,
        totalUngroundedResponses: 0,
        totalResponses: 0,
        callsWithKB: 0,
        callsWithoutKB: 0,
        escalatedCalls: 0,
        escalationRate: 0
      };

      let totalGroundedness = 0;
      let totalKBUsage = 0;
      let totalSimilarity = 0;
      let similarityCount = 0;

      for (const record of callRecords) {
        const callMetrics = await this.calculateCallGroundedness(record.callSid);
        if (!callMetrics) continue;

        totalGroundedness += callMetrics.groundednessScore;
        totalKBUsage += callMetrics.kbUsageRate;
        aggregated.totalCitations += callMetrics.citationsCount;
        aggregated.totalUngroundedResponses += callMetrics.ungroundedResponses;
        aggregated.totalResponses += callMetrics.totalResponses;

        if (callMetrics.averageSimilarityScore > 0) {
          totalSimilarity += callMetrics.averageSimilarityScore;
          similarityCount++;
        }

        if (callMetrics.citationsCount > 0) {
          aggregated.callsWithKB++;
        } else {
          aggregated.callsWithoutKB++;
        }

        // Track escalations (calls transferred to human)
        if (record.result === 'escalated' || 
            record.result === 'transferred' || 
            (record.escalation && record.escalation.escalated)) {
          aggregated.escalatedCalls++;
        }
      }

      if (callRecords.length > 0) {
        aggregated.averageGroundednessScore = totalGroundedness / callRecords.length;
        aggregated.averageKBUsageRate = totalKBUsage / callRecords.length;
        aggregated.escalationRate = aggregated.escalatedCalls / callRecords.length;
      }

      if (similarityCount > 0) {
        aggregated.averageSimilarityScore = totalSimilarity / similarityCount;
      }

      return aggregated;
    } catch (error) {
      console.error('Error getting aggregated groundedness:', error);
      throw error;
    }
  }

  /**
   * Get RAG (Retrieval-Augmented Generation) analytics
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} RAG analytics
   */
  async getRAGAnalytics(filters = {}) {
    try {
      const query = {};

      if (filters.dateRange) {
        query.createdAt = {
          $gte: new Date(filters.dateRange.start),
          $lte: new Date(filters.dateRange.end)
        };
      }

      const callRecords = await CallRecord.find(query)
        .select('provenance transcript callSid createdAt');

      const analytics = {
        totalCalls: callRecords.length,
        callsWithKB: 0,
        callsWithoutKB: 0,
        totalKBQueries: 0,
        averageSimilarityScore: 0,
        similarityDistribution: {
          high: 0,    // > 0.8
          medium: 0,  // 0.5 - 0.8
          low: 0      // < 0.5
        },
        topFiles: [],
        averageResultsPerQuery: 0,
        queriesWithResults: 0,
        queriesWithoutResults: 0
      };

      const fileUsage = new Map();
      let totalSimilarity = 0;
      let similarityCount = 0;
      let totalResults = 0;

      for (const record of callRecords) {
        if (record.provenance && record.provenance.length > 0) {
          analytics.callsWithKB++;
          analytics.totalKBQueries += record.provenance.length;
          analytics.queriesWithResults += record.provenance.length > 0 ? 1 : 0;

          record.provenance.forEach(prov => {
            totalResults++;
            
            // Track file usage
            const fileKey = prov.fileId || prov.fileName || 'unknown';
            fileUsage.set(fileKey, (fileUsage.get(fileKey) || 0) + 1);

            // Track similarity scores
            if (prov.similarityScore !== null && prov.similarityScore !== undefined) {
              totalSimilarity += prov.similarityScore;
              similarityCount++;

              if (prov.similarityScore > 0.8) {
                analytics.similarityDistribution.high++;
              } else if (prov.similarityScore >= 0.5) {
                analytics.similarityDistribution.medium++;
              } else {
                analytics.similarityDistribution.low++;
              }
            }
          });
        } else {
          analytics.callsWithoutKB++;
          analytics.queriesWithoutResults++;
        }
      }

      if (similarityCount > 0) {
        analytics.averageSimilarityScore = totalSimilarity / similarityCount;
      }

      if (analytics.totalKBQueries > 0) {
        analytics.averageResultsPerQuery = totalResults / analytics.totalKBQueries;
      }

      // Get top files
      analytics.topFiles = Array.from(fileUsage.entries())
        .map(([file, count]) => ({ file, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return analytics;
    } catch (error) {
      console.error('Error getting RAG analytics:', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new GroundednessKPIService();

