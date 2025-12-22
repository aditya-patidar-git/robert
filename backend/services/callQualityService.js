/**
 * CallQualityService - Aggregates and calculates call quality metrics
 * Provides methods to aggregate audio quality metrics from CallRecord documents
 * with time-range filtering and statistical calculations
 */

import CallRecord from '../models/callRecord.js';

class CallQualityService {
  /**
   * Calculate MOS score using E-model approximation
   * Based on latency, jitter, and packet loss
   * @param {number} latency - Latency in ms
   * @param {number} jitter - Jitter in ms
   * @param {number} packetLoss - Packet loss percentage
   * @returns {number} MOS score (1-5)
   */
  calculateMOS(latency, jitter, packetLoss) {
    // E-model approximation
    // R-factor calculation (simplified)
    const R0 = 93.2; // Base factor
    const Id = this._calculateId(latency, jitter); // Delay impairment
    const Ie = this._calculateIe(packetLoss); // Equipment impairment
    const R = R0 - Id - Ie;
    
    // Convert R-factor to MOS (1-5 scale)
    if (R < 0) return 1.0;
    if (R > 100) return 4.5;
    
    // MOS calculation from R-factor
    if (R < 6.5) {
      return 1.0;
    } else if (R < 17) {
      return 1 + 0.035 * R + (7 * Math.pow(10, -6)) * R * (R - 60) * (100 - R);
    } else if (R < 50) {
      return 1 + 0.035 * R + (7 * Math.pow(10, -6)) * R * (R - 60) * (100 - R);
    } else {
      return 4.5;
    }
  }

  /**
   * Calculate delay impairment factor
   * @private
   */
  _calculateId(latency, jitter) {
    // One-way delay impairment
    const Ta = latency + jitter; // Total delay
    if (Ta < 100) return 0;
    if (Ta < 200) return (Ta - 100) * 0.1;
    if (Ta < 300) return 10 + (Ta - 200) * 0.2;
    return 30 + (Ta - 300) * 0.3;
  }

  /**
   * Calculate equipment impairment factor
   * @private
   */
  _calculateIe(packetLoss) {
    // Packet loss impairment (simplified)
    if (packetLoss < 0.1) return 0;
    if (packetLoss < 1) return packetLoss * 10;
    if (packetLoss < 5) return 10 + (packetLoss - 1) * 5;
    return 30 + (packetLoss - 5) * 10;
  }

  /**
   * Determine call quality category from MOS score
   * @param {number} mosScore - MOS score (1-5)
   * @returns {string} Quality category
   */
  getQualityCategory(mosScore) {
    if (mosScore >= 4.0) return 'excellent';
    if (mosScore >= 3.5) return 'good';
    if (mosScore >= 3.0) return 'fair';
    return 'poor';
  }

  /**
   * Get time range filter for MongoDB query
   * @param {string} timeRange - Time range ('1h', '24h', '7d', '30d')
   * @returns {Date} Start date
   */
  getTimeRangeFilter(timeRange = '24h') {
    const now = new Date();
    let hours;
    
    switch (timeRange) {
      case '1h':
        hours = 1;
        break;
      case '24h':
        hours = 24;
        break;
      case '7d':
        hours = 24 * 7;
        break;
      case '30d':
        hours = 24 * 30;
        break;
      default:
        hours = 24;
    }
    
    return new Date(now.getTime() - hours * 60 * 60 * 1000);
  }

  /**
   * Calculate percentile from sorted array
   * @private
   */
  _percentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return null;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  /**
   * Aggregate call quality metrics for a time range
   * @param {string} timeRange - Time range ('1h', '24h', '7d', '30d')
   * @returns {Promise<Object>} Aggregated metrics
   */
  async getAggregatedMetrics(timeRange = '24h') {
    try {
      const startDate = this.getTimeRangeFilter(timeRange);
      
      // Find all calls with audio quality data in the time range
      // Use createdAt for time filtering (more reliable) and check for any audioQuality data
      const calls = await CallRecord.find({
        'audioQuality': { $exists: true },
        $or: [
          { 'audioQuality.measuredAt': { $gte: startDate } },
          { 'audioQuality.measuredAt': { $exists: false }, createdAt: { $gte: startDate } }
        ]
      }).select('audioQuality createdAt').lean();

      if (calls.length === 0) {
        return {
          totalCalls: 0,
          averageLatency: null,
          averageJitter: null,
          averagePacketLoss: null,
          averageMOS: null,
          minLatency: null,
          maxLatency: null,
          minJitter: null,
          maxJitter: null,
          minPacketLoss: null,
          maxPacketLoss: null,
          minMOS: null,
          maxMOS: null,
          p95Latency: null,
          p99Latency: null,
          p95Jitter: null,
          p99Jitter: null,
          p95PacketLoss: null,
          p99PacketLoss: null,
          qualityDistribution: {
            excellent: 0,
            good: 0,
            fair: 0,
            poor: 0
          },
          lastUpdated: new Date()
        };
      }

      // Extract metrics arrays - use optional chaining for missing values
      const latencies = calls.map(c => c.audioQuality?.latency).filter(v => v != null && v !== undefined);
      const jitters = calls.map(c => c.audioQuality?.jitter).filter(v => v != null && v !== undefined);
      const packetLosses = calls.map(c => c.audioQuality?.packetLoss).filter(v => v != null && v !== undefined);
      const mosScores = calls.map(c => c.audioQuality?.mosScore).filter(v => v != null && v !== undefined);
      const qualityCategories = calls.map(c => c.audioQuality?.callQuality).filter(v => v != null && v !== undefined);

      // Calculate averages
      const averageLatency = latencies.length > 0 
        ? latencies.reduce((sum, val) => sum + val, 0) / latencies.length 
        : null;
      const averageJitter = jitters.length > 0 
        ? jitters.reduce((sum, val) => sum + val, 0) / jitters.length 
        : null;
      const averagePacketLoss = packetLosses.length > 0 
        ? packetLosses.reduce((sum, val) => sum + val, 0) / packetLosses.length 
        : null;
      const averageMOS = mosScores.length > 0 
        ? mosScores.reduce((sum, val) => sum + val, 0) / mosScores.length 
        : null;

      // Calculate min/max
      const minLatency = latencies.length > 0 ? Math.min(...latencies) : null;
      const maxLatency = latencies.length > 0 ? Math.max(...latencies) : null;
      const minJitter = jitters.length > 0 ? Math.min(...jitters) : null;
      const maxJitter = jitters.length > 0 ? Math.max(...jitters) : null;
      const minPacketLoss = packetLosses.length > 0 ? Math.min(...packetLosses) : null;
      const maxPacketLoss = packetLosses.length > 0 ? Math.max(...packetLosses) : null;
      const minMOS = mosScores.length > 0 ? Math.min(...mosScores) : null;
      const maxMOS = mosScores.length > 0 ? Math.max(...mosScores) : null;

      // Calculate percentiles
      const sortedLatencies = [...latencies].sort((a, b) => a - b);
      const sortedJitters = [...jitters].sort((a, b) => a - b);
      const sortedPacketLosses = [...packetLosses].sort((a, b) => a - b);

      const p95Latency = this._percentile(sortedLatencies, 95);
      const p99Latency = this._percentile(sortedLatencies, 99);
      const p95Jitter = this._percentile(sortedJitters, 95);
      const p99Jitter = this._percentile(sortedJitters, 99);
      const p95PacketLoss = this._percentile(sortedPacketLosses, 95);
      const p99PacketLoss = this._percentile(sortedPacketLosses, 99);

      // Quality distribution
      const qualityDistribution = {
        excellent: qualityCategories.filter(q => q === 'excellent').length,
        good: qualityCategories.filter(q => q === 'good').length,
        fair: qualityCategories.filter(q => q === 'fair').length,
        poor: qualityCategories.filter(q => q === 'poor').length
      };

      return {
        totalCalls: calls.length,
        averageLatency: averageLatency ? Math.round(averageLatency * 100) / 100 : null,
        averageJitter: averageJitter ? Math.round(averageJitter * 100) / 100 : null,
        averagePacketLoss: averagePacketLoss ? Math.round(averagePacketLoss * 100) / 100 : null,
        averageMOS: averageMOS ? Math.round(averageMOS * 100) / 100 : null,
        minLatency: minLatency ? Math.round(minLatency * 100) / 100 : null,
        maxLatency: maxLatency ? Math.round(maxLatency * 100) / 100 : null,
        minJitter: minJitter ? Math.round(minJitter * 100) / 100 : null,
        maxJitter: maxJitter ? Math.round(maxJitter * 100) / 100 : null,
        minPacketLoss: minPacketLoss ? Math.round(minPacketLoss * 100) / 100 : null,
        maxPacketLoss: maxPacketLoss ? Math.round(maxPacketLoss * 100) / 100 : null,
        minMOS: minMOS ? Math.round(minMOS * 100) / 100 : null,
        maxMOS: maxMOS ? Math.round(maxMOS * 100) / 100 : null,
        p95Latency: p95Latency ? Math.round(p95Latency * 100) / 100 : null,
        p99Latency: p99Latency ? Math.round(p99Latency * 100) / 100 : null,
        p95Jitter: p95Jitter ? Math.round(p95Jitter * 100) / 100 : null,
        p99Jitter: p99Jitter ? Math.round(p99Jitter * 100) / 100 : null,
        p95PacketLoss: p95PacketLoss ? Math.round(p95PacketLoss * 100) / 100 : null,
        p99PacketLoss: p99PacketLoss ? Math.round(p99PacketLoss * 100) / 100 : null,
        qualityDistribution,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error aggregating call quality metrics:', error);
      throw error;
    }
  }

  /**
   * Get historical metrics data points for charting
   * @param {string} timeRange - Time range ('1h', '24h', '7d', '30d')
   * @param {number} dataPoints - Number of data points to return
   * @returns {Promise<Array>} Array of data points with timestamps
   */
  async getHistoricalData(timeRange = '24h', dataPoints = 20) {
    try {
      const startDate = this.getTimeRangeFilter(timeRange);
      const intervalMs = (Date.now() - startDate.getTime()) / dataPoints;

      const calls = await CallRecord.find({
        'audioQuality.latency': { $exists: true, $ne: null },
        'audioQuality.measuredAt': { $gte: startDate }
      })
      .select('audioQuality measuredAt')
      .sort({ 'audioQuality.measuredAt': 1 })
      .lean();

      if (calls.length === 0) {
        return [];
      }

      // Group calls into time buckets
      const buckets = {};
      calls.forEach(call => {
        const timestamp = new Date(call.audioQuality.measuredAt || call.createdAt);
        const bucketTime = Math.floor(timestamp.getTime() / intervalMs) * intervalMs;
        
        if (!buckets[bucketTime]) {
          buckets[bucketTime] = {
            latency: [],
            jitter: [],
            packetLoss: [],
            mosScore: []
          };
        }
        
        if (call.audioQuality.latency != null) buckets[bucketTime].latency.push(call.audioQuality.latency);
        if (call.audioQuality.jitter != null) buckets[bucketTime].jitter.push(call.audioQuality.jitter);
        if (call.audioQuality.packetLoss != null) buckets[bucketTime].packetLoss.push(call.audioQuality.packetLoss);
        if (call.audioQuality.mosScore != null) buckets[bucketTime].mosScore.push(call.audioQuality.mosScore);
      });

      // Convert buckets to data points
      return Object.keys(buckets)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map(bucketTime => {
          const bucket = buckets[bucketTime];
          return {
            timestamp: parseInt(bucketTime), // Return as timestamp for chart compatibility
            latency: bucket.latency.length > 0 
              ? Math.round((bucket.latency.reduce((a, b) => a + b, 0) / bucket.latency.length) * 100) / 100 
              : null,
            jitter: bucket.jitter.length > 0 
              ? Math.round((bucket.jitter.reduce((a, b) => a + b, 0) / bucket.jitter.length) * 100) / 100 
              : null,
            packetLoss: bucket.packetLoss.length > 0 
              ? Math.round((bucket.packetLoss.reduce((a, b) => a + b, 0) / bucket.packetLoss.length) * 100) / 100 
              : null,
            mosScore: bucket.mosScore.length > 0 
              ? Math.round((bucket.mosScore.reduce((a, b) => a + b, 0) / bucket.mosScore.length) * 100) / 100 
              : null
          };
        });
    } catch (error) {
      console.error('Error getting historical data:', error);
      throw error;
    }
  }

  /**
   * Get recent calls with quality metrics
   * @param {number} limit - Number of calls to return
   * @param {string} qualityFilter - Filter by quality ('excellent', 'good', 'fair', 'poor', or null for all)
   * @returns {Promise<Array>} Array of call records with quality metrics
   */
  async getRecentCallsWithQuality(limit = 50, qualityFilter = null) {
    try {
      const query = {
        'audioQuality.latency': { $exists: true, $ne: null }
      };

      if (qualityFilter) {
        query['audioQuality.callQuality'] = qualityFilter;
      }

      const calls = await CallRecord.find(query)
        .select('callSid from to callStatus duration audioQuality createdAt')
        .sort({ 'audioQuality.measuredAt': -1, createdAt: -1 })
        .limit(limit)
        .lean();

      return calls.map(call => ({
        callSid: call.callSid,
        from: call.from,
        to: call.to,
        callStatus: call.callStatus,
        duration: call.duration,
        audioQuality: call.audioQuality,
        createdAt: call.createdAt
      }));
    } catch (error) {
      console.error('Error getting recent calls with quality:', error);
      throw error;
    }
  }
}

export default new CallQualityService();

