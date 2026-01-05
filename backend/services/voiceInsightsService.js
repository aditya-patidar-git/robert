/**
 * Voice Insights Service
 * Aggregates and analyzes call quality metrics from Twilio Voice Insights
 * Provides data for dashboard visualization, SLO tracking, and alerting
 */

import CallRecord from '../models/CallRecord.js';

class VoiceInsightsService {
  /**
   * Get aggregated voice insights metrics for a date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} groupBy - 'hour' or 'day'
   * @param {object} filters - Optional filters (phoneNumber, entryPath, etc.)
   * @returns {Promise<object>} Aggregated metrics
   */
  async getAggregatedMetrics(startDate, endDate, groupBy = 'hour', filters = {}) {
    try {
      const matchStage = {
        createdAt: {
          $gte: startDate,
          $lte: endDate
        },
        'audioQuality.mosScore': { $exists: true, $ne: null }
      };

      // Apply filters
      if (filters.phoneNumber) {
        matchStage.$or = [
          { from: filters.phoneNumber },
          { to: filters.phoneNumber }
        ];
      }

      if (filters.entryPath) {
        matchStage.entryPath = filters.entryPath;
      }

      // Determine group format based on groupBy
      const groupFormat = groupBy === 'day' 
        ? { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
        : { $dateToString: { format: '%Y-%m-%d %H:00', date: '$createdAt' } };

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: groupFormat,
            count: { $sum: 1 },
            avgMOS: { $avg: '$audioQuality.mosScore' },
            avgLatency: { $avg: '$audioQuality.latency' },
            avgJitter: { $avg: '$audioQuality.jitter' },
            avgPacketLoss: { $avg: '$audioQuality.packetLoss' },
            minMOS: { $min: '$audioQuality.mosScore' },
            maxMOS: { $max: '$audioQuality.mosScore' },
            p50Latency: { $percentile: { input: '$audioQuality.latency', p: [0.5], method: 'approximate' } },
            p95Latency: { $percentile: { input: '$audioQuality.latency', p: [0.95], method: 'approximate' } },
            p99Latency: { $percentile: { input: '$audioQuality.latency', p: [0.99], method: 'approximate' } },
            qualityDistribution: {
              $push: '$audioQuality.callQuality'
            }
          }
        },
        {
          $project: {
            _id: 0,
            period: '$_id',
            count: 1,
            avgMOS: { $round: ['$avgMOS', 2] },
            avgLatency: { $round: ['$avgLatency', 2] },
            avgJitter: { $round: ['$avgJitter', 2] },
            avgPacketLoss: { $round: ['$avgPacketLoss', 2] },
            minMOS: { $round: ['$minMOS', 2] },
            maxMOS: { $round: ['$maxMOS', 2] },
            p50Latency: { $ifNull: [{ $arrayElemAt: ['$p50Latency', 0] }, null] },
            p95Latency: { $ifNull: [{ $arrayElemAt: ['$p95Latency', 0] }, null] },
            p99Latency: { $ifNull: [{ $arrayElemAt: ['$p99Latency', 0] }, null] },
            qualityDistribution: 1
          }
        },
        { $sort: { period: 1 } }
      ];

      const results = await CallRecord.aggregate(pipeline);

      // Calculate quality distribution percentages
      const processedResults = results.map(result => {
        const distribution = result.qualityDistribution || [];
        const total = distribution.length;
        const qualityCounts = {
          excellent: distribution.filter(q => q === 'excellent').length,
          good: distribution.filter(q => q === 'good').length,
          fair: distribution.filter(q => q === 'fair').length,
          poor: distribution.filter(q => q === 'poor').length
        };

        return {
          ...result,
          qualityDistribution: {
            excellent: total > 0 ? Math.round((qualityCounts.excellent / total) * 100) : 0,
            good: total > 0 ? Math.round((qualityCounts.good / total) * 100) : 0,
            fair: total > 0 ? Math.round((qualityCounts.fair / total) * 100) : 0,
            poor: total > 0 ? Math.round((qualityCounts.poor / total) * 100) : 0
          }
        };
      });

      return {
        success: true,
        data: processedResults,
        summary: this.calculateSummary(processedResults)
      };
    } catch (error) {
      console.error('Error getting aggregated voice insights:', error);
      throw error;
    }
  }

  /**
   * Calculate summary statistics
   * @param {Array} results - Aggregated results
   * @returns {object} Summary statistics
   */
  calculateSummary(results) {
    if (!results || results.length === 0) {
      return {
        totalCalls: 0,
        avgMOS: 0,
        avgLatency: 0,
        avgJitter: 0,
        avgPacketLoss: 0
      };
    }

    const totalCalls = results.reduce((sum, r) => sum + (r.count || 0), 0);
    const totalMOS = results.reduce((sum, r) => sum + ((r.avgMOS || 0) * (r.count || 0)), 0);
    const totalLatency = results.reduce((sum, r) => sum + ((r.avgLatency || 0) * (r.count || 0)), 0);
    const totalJitter = results.reduce((sum, r) => sum + ((r.avgJitter || 0) * (r.count || 0)), 0);
    const totalPacketLoss = results.reduce((sum, r) => sum + ((r.avgPacketLoss || 0) * (r.count || 0)), 0);

    return {
      totalCalls,
      avgMOS: totalCalls > 0 ? Math.round((totalMOS / totalCalls) * 100) / 100 : 0,
      avgLatency: totalCalls > 0 ? Math.round((totalLatency / totalCalls) * 100) / 100 : 0,
      avgJitter: totalCalls > 0 ? Math.round((totalJitter / totalCalls) * 100) / 100 : 0,
      avgPacketLoss: totalCalls > 0 ? Math.round((totalPacketLoss / totalCalls) * 100) / 100 : 0
    };
  }

  /**
   * Get SLO compliance data
   * @param {string} period - '1h', '24h', '7d', '30d'
   * @returns {Promise<object>} SLO compliance metrics
   */
  async getSLOCompliance(period = '24h') {
    try {
      const now = new Date();
      let startDate;

      switch (period) {
        case '1h':
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const matchStage = {
        createdAt: { $gte: startDate },
        'audioQuality.mosScore': { $exists: true, $ne: null }
      };

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalCalls: { $sum: 1 },
            // SLO: MOS > 3.5
            mosCompliant: {
              $sum: {
                $cond: [{ $gt: ['$audioQuality.mosScore', 3.5] }, 1, 0]
              }
            },
            // SLO: Latency < 200ms
            latencyCompliant: {
              $sum: {
                $cond: [{ $lt: ['$audioQuality.latency', 200] }, 1, 0]
              }
            },
            // SLO: Packet loss < 5%
            packetLossCompliant: {
              $sum: {
                $cond: [{ $lt: ['$audioQuality.packetLoss', 5] }, 1, 0]
              }
            },
            avgMOS: { $avg: '$audioQuality.mosScore' },
            avgLatency: { $avg: '$audioQuality.latency' },
            avgPacketLoss: { $avg: '$audioQuality.packetLoss' }
          }
        }
      ];

      const results = await CallRecord.aggregate(pipeline);
      const result = results[0] || {};

      const totalCalls = result.totalCalls || 0;
      const mosCompliance = totalCalls > 0 ? (result.mosCompliant / totalCalls) * 100 : 0;
      const latencyCompliance = totalCalls > 0 ? (result.latencyCompliant / totalCalls) * 100 : 0;
      const packetLossCompliance = totalCalls > 0 ? (result.packetLossCompliant / totalCalls) * 100 : 0;

      // Calculate error budget (assuming 99.9% SLO target)
      const sloTarget = 99.9;
      const errorBudget = sloTarget - Math.min(mosCompliance, latencyCompliance, packetLossCompliance);

      return {
        success: true,
        period,
        totalCalls,
        slos: {
          mos: {
            target: 3.5,
            compliance: Math.round(mosCompliance * 100) / 100,
            compliant: result.mosCompliant || 0,
            total: totalCalls,
            avgValue: Math.round((result.avgMOS || 0) * 100) / 100
          },
          latency: {
            target: 200, // ms
            compliance: Math.round(latencyCompliance * 100) / 100,
            compliant: result.latencyCompliant || 0,
            total: totalCalls,
            avgValue: Math.round((result.avgLatency || 0) * 100) / 100
          },
          packetLoss: {
            target: 5, // %
            compliance: Math.round(packetLossCompliance * 100) / 100,
            compliant: result.packetLossCompliant || 0,
            total: totalCalls,
            avgValue: Math.round((result.avgPacketLoss || 0) * 100) / 100
          }
        },
        errorBudget: {
          target: sloTarget,
          current: Math.round((100 - errorBudget) * 100) / 100,
          remaining: Math.round(errorBudget * 100) / 100
        }
      };
    } catch (error) {
      console.error('Error getting SLO compliance:', error);
      throw error;
    }
  }

  /**
   * Get metrics for a specific call
   * @param {string} callSid - Call SID
   * @returns {Promise<object>} Call metrics
   */
  async getCallMetrics(callSid) {
    try {
      const callRecord = await CallRecord.findOne({ callSid });

      if (!callRecord || !callRecord.audioQuality) {
        return {
          success: false,
          error: 'Call record or audio quality data not found'
        };
      }

      return {
        success: true,
        callSid,
        metrics: {
          mosScore: callRecord.audioQuality.mosScore,
          latency: callRecord.audioQuality.latency,
          jitter: callRecord.audioQuality.jitter,
          packetLoss: callRecord.audioQuality.packetLoss,
          callQuality: callRecord.audioQuality.callQuality,
          measuredAt: callRecord.audioQuality.measuredAt
        },
        callInfo: {
          from: callRecord.from,
          to: callRecord.to,
          duration: callRecord.duration,
          entryPath: callRecord.entryPath,
          createdAt: callRecord.createdAt
        }
      };
    } catch (error) {
      console.error('Error getting call metrics:', error);
      throw error;
    }
  }

  /**
   * Get quality trends over time
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<object>} Trend data
   */
  async getQualityTrends(startDate, endDate) {
    try {
      const metrics = await this.getAggregatedMetrics(startDate, endDate, 'hour');
      
      return {
        success: true,
        trends: {
          mos: metrics.data.map(m => ({ period: m.period, value: m.avgMOS })),
          latency: metrics.data.map(m => ({ period: m.period, value: m.avgLatency })),
          jitter: metrics.data.map(m => ({ period: m.period, value: m.avgJitter })),
          packetLoss: metrics.data.map(m => ({ period: m.period, value: m.avgPacketLoss }))
        },
        summary: metrics.summary
      };
    } catch (error) {
      console.error('Error getting quality trends:', error);
      throw error;
    }
  }
}

export default new VoiceInsightsService();

