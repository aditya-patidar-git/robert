import Provenance from '../models/Provenance.js';
import KnowledgeBase from '../models/KnowledgeBase.js';

class ProvenanceService {
  constructor() {
    this.retentionDays = 365; // 1 year retention
  }

  // Track file usage in a call
  async trackFileUsage(callData) {
    try {
      const {
        callId,
        sessionId,
        userId,
        query,
        results,
        model = 'gpt-realtime',
        confidence,
        response,
        metadata = {}
      } = callData;

      // Extract file information from results
      const fileIds = results.map(r => r.fileId).filter(Boolean);
      const titles = results.map(r => r.fileName).filter(Boolean);
      const similarityScores = results.map(r => r.similarityScore).filter(Boolean);

      // Create provenance record
      const provenance = new Provenance({
        callId,
        sessionId,
        userId,
        query,
        fileIds,
        titles,
        similarityScores,
        results,
        model,
        confidence,
        response,
        metadata
      });

      await provenance.save();

      console.log(`📊 Tracked file usage for call ${callId}: ${fileIds.length} files`);

      return provenance;

    } catch (error) {
      console.error('Error tracking file usage:', error);
      throw new Error(`Failed to track file usage: ${error.message}`);
    }
  }

  // Get provenance for a specific call
  async getCallProvenance(callId) {
    try {
      const provenance = await Provenance.find({ callId }).sort({ timestamp: -1 });
      return provenance;

    } catch (error) {
      console.error('Error getting call provenance:', error);
      throw new Error(`Failed to get call provenance: ${error.message}`);
    }
  }

  // Get provenance for a specific file
  async getFileProvenance(fileId) {
    try {
      const provenance = await Provenance.find({ fileIds: fileId }).sort({ timestamp: -1 });
      return provenance;

    } catch (error) {
      console.error('Error getting file provenance:', error);
      throw new Error(`Failed to get file provenance: ${error.message}`);
    }
  }

  // Get provenance analytics
  async getProvenanceAnalytics(filters = {}) {
    try {
      const {
        startDate,
        endDate,
        fileId,
        callId,
        userId
      } = filters;

      // Build query
      const query = {};
      if (startDate && endDate) {
        query.timestamp = { $gte: startDate, $lte: endDate };
      }
      if (fileId) {
        query.fileIds = fileId;
      }
      if (callId) {
        query.callId = callId;
      }
      if (userId) {
        query.userId = userId;
      }

      // Get provenance records
      const provenanceRecords = await Provenance.find(query).sort({ timestamp: -1 });

      // Calculate analytics
      const analytics = {
        totalRecords: provenanceRecords.length,
        totalCalls: new Set(provenanceRecords.map(p => p.callId)).size,
        totalFiles: new Set(provenanceRecords.flatMap(p => p.fileIds)).size,
        averageSimilarityScore: 0,
        mostUsedFiles: [],
        queryPatterns: [],
        timeDistribution: {}
      };

      if (provenanceRecords.length > 0) {
        // Calculate average similarity score
        const allScores = provenanceRecords.flatMap(p => p.similarityScores);
        analytics.averageSimilarityScore = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;

        // Find most used files
        const fileUsage = {};
        provenanceRecords.forEach(record => {
          record.fileIds.forEach((fileId, index) => {
            const title = record.titles[index] || 'Unknown';
            fileUsage[fileId] = (fileUsage[fileId] || 0) + 1;
          });
        });

        analytics.mostUsedFiles = Object.entries(fileUsage)
          .map(([fileId, count]) => ({ fileId, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        // Analyze query patterns
        const queryCounts = {};
        provenanceRecords.forEach(record => {
          queryCounts[record.query] = (queryCounts[record.query] || 0) + 1;
        });

        analytics.queryPatterns = Object.entries(queryCounts)
          .map(([query, count]) => ({ query, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        // Time distribution (by hour)
        const hourDistribution = {};
        provenanceRecords.forEach(record => {
          const hour = new Date(record.timestamp).getHours();
          hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
        });
        analytics.timeDistribution = hourDistribution;
      }

      return analytics;

    } catch (error) {
      console.error('Error getting provenance analytics:', error);
      throw new Error(`Failed to get provenance analytics: ${error.message}`);
    }
  }

  // Get file usage statistics
  async getFileUsageStats(fileId) {
    try {
      const provenance = await Provenance.find({ fileIds: fileId });
      
      const stats = {
        totalUsage: provenance.length,
        uniqueCalls: new Set(provenance.map(p => p.callId)).size,
        averageSimilarityScore: 0,
        firstUsed: null,
        lastUsed: null,
        usageByQuery: {}
      };

      if (provenance.length > 0) {
        // Calculate average similarity score for this file
        const fileScores = [];
        provenance.forEach(record => {
          record.fileIds.forEach((id, index) => {
            if (id === fileId) {
              fileScores.push(record.similarityScores[index]);
            }
          });
        });

        if (fileScores.length > 0) {
          stats.averageSimilarityScore = fileScores.reduce((sum, score => sum + score, 0) / fileScores.length);
        }

        // Get first and last usage
        const timestamps = provenance.map(p => p.timestamp).sort();
        stats.firstUsed = timestamps[0];
        stats.lastUsed = timestamps[timestamps.length - 1];

        // Usage by query
        provenance.forEach(record => {
          stats.usageByQuery[record.query] = (stats.usageByQuery[record.query] || 0) + 1;
        });
      }

      return stats;

    } catch (error) {
      console.error('Error getting file usage stats:', error);
      throw new Error(`Failed to get file usage stats: ${error.message}`);
    }
  }

  // Clean up old provenance records
  async cleanupOldRecords() {
    try {
      const cutoffDate = new Date(Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000));
      
      const result = await Provenance.deleteMany({
        timestamp: { $lt: cutoffDate }
      });

      console.log(`🧹 Cleaned up ${result.deletedCount} old provenance records`);
      return result;

    } catch (error) {
      console.error('Error cleaning up old records:', error);
      throw new Error(`Failed to cleanup old records: ${error.message}`);
    }
  }

  // Export provenance data for DSAR
  async exportProvenanceData(userId, startDate, endDate) {
    try {
      const query = {};
      // Only filter by userId if provided
      if (userId) {
        query.userId = userId;
      }
      if (startDate && endDate) {
        query.timestamp = { $gte: startDate, $lte: endDate };
      }

      const provenance = await Provenance.find(query).sort({ timestamp: -1 });
      
      return provenance.map(record => ({
        callId: record.callId,
        sessionId: record.sessionId,
        query: record.query,
        filesUsed: record.titles,
        similarityScores: record.similarityScores,
        timestamp: record.timestamp,
        model: record.model,
        confidence: record.confidence
      }));

    } catch (error) {
      console.error('Error exporting provenance data:', error);
      throw new Error(`Failed to export provenance data: ${error.message}`);
    }
  }
}

export default new ProvenanceService();





