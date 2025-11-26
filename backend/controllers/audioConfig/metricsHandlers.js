// Get audio quality metrics
export const getAudioMetrics = async (req, res) => {
  try {
    const timeRange = req.query.timeRange || '24h'; // Default to 24 hours
    const callQualityService = (await import('../../services/callQualityService.js')).default;
    
    const aggregatedMetrics = await callQualityService.getAggregatedMetrics(timeRange);
    
    // Format response to match expected frontend structure
    const metrics = {
      averageLatency: aggregatedMetrics.averageLatency || 0,
      packetLoss: aggregatedMetrics.averagePacketLoss || 0,
      jitter: aggregatedMetrics.averageJitter || 0,
      mosScore: aggregatedMetrics.averageMOS || 0,
      callQuality: aggregatedMetrics.averageMOS 
        ? (aggregatedMetrics.averageMOS >= 4.0 ? 'excellent' : 
           aggregatedMetrics.averageMOS >= 3.5 ? 'good' : 
           aggregatedMetrics.averageMOS >= 3.0 ? 'fair' : 'poor')
        : 'good',
      lastUpdated: aggregatedMetrics.lastUpdated,
      // Include additional statistics
      totalCalls: aggregatedMetrics.totalCalls,
      minLatency: aggregatedMetrics.minLatency,
      maxLatency: aggregatedMetrics.maxLatency,
      minJitter: aggregatedMetrics.minJitter,
      maxJitter: aggregatedMetrics.maxJitter,
      minPacketLoss: aggregatedMetrics.minPacketLoss,
      maxPacketLoss: aggregatedMetrics.maxPacketLoss,
      minMOS: aggregatedMetrics.minMOS,
      maxMOS: aggregatedMetrics.maxMOS,
      p95Latency: aggregatedMetrics.p95Latency,
      p99Latency: aggregatedMetrics.p99Latency,
      p95Jitter: aggregatedMetrics.p95Jitter,
      p99Jitter: aggregatedMetrics.p99Jitter,
      p95PacketLoss: aggregatedMetrics.p95PacketLoss,
      p99PacketLoss: aggregatedMetrics.p99PacketLoss,
      qualityDistribution: aggregatedMetrics.qualityDistribution
    };

    res.json({
      status: "success",
      metrics
    });
  } catch (err) {
    console.error("Error fetching audio metrics:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Get historical audio quality data for charts
export const getHistoricalAudioMetrics = async (req, res) => {
  try {
    const timeRange = req.query.timeRange || '24h';
    const dataPoints = parseInt(req.query.dataPoints) || 20;
    const callQualityService = (await import('../../services/callQualityService.js')).default;
    
    const historicalData = await callQualityService.getHistoricalData(timeRange, dataPoints);
    
    res.json({
      status: "success",
      data: historicalData
    });
  } catch (err) {
    console.error("Error fetching historical audio metrics:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Get recent calls with quality metrics
export const getRecentCallsWithQuality = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const qualityFilter = req.query.qualityFilter || null;
    const callQualityService = (await import('../../services/callQualityService.js')).default;
    
    const calls = await callQualityService.getRecentCallsWithQuality(limit, qualityFilter);
    
    res.json({
      status: "success",
      calls
    });
  } catch (err) {
    console.error("Error fetching recent calls with quality:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

