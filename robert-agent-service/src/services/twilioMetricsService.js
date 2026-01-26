/**
 * TwilioMetricsService - Fetches call quality metrics from Twilio Voice Insights API
 * and saves them to CallRecord documents
 */

import twilio from 'twilio';
import CallRecord from '../database/models/CallRecord.js';
import Alert from '../database/models/Alert.js';

class TwilioMetricsService {
  constructor() {
    // Lazy-initialized Twilio client to avoid ES module import hoisting issues
    // where env vars might not be loaded yet at module evaluation time
    this._client = null;
    // Track if we've detected basic Voice Insights plan (no API access)
    this.basicPlanDetected = false;
  }

  /**
   * Get the Twilio client instance.
   * Creates the client on first access when env vars are guaranteed to be loaded.
   */
  get client() {
    if (!this._client) {
      this._client = twilio(
        process.env.TWILIO_SID || process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }
    return this._client;
  }

  /**
   * Fetch and save call quality metrics for a completed call
   * Hybrid approach: Try Voice Insights API first, fallback to WebSocket metrics
   * @param {string} callSid - Twilio Call SID
   * @param {Object} options - Options for fetching metrics
   * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
   * @param {number} options.initialDelay - Initial delay in ms before first retry (default: 2000)
   * @returns {Promise<Object|null>} Metrics object or null if unavailable
   */
  async fetchAndSaveCallQualityMetrics(callSid, options = {}) {
    // If we've already detected basic plan, skip Voice Insights API and use WebSocket metrics
    if (this.basicPlanDetected) {
      console.log(`ℹ️ [${callSid}] Basic plan detected - using WebSocket metrics instead of Voice Insights API`);
      return await this.calculateMetricsFromWebSocket(callSid);
    }

    // Try Voice Insights API first (if Advanced Features enabled)
    const insightsMetrics = await this.tryVoiceInsightsAPI(callSid, options);
    if (insightsMetrics) {
      return insightsMetrics;
    }

    // Fallback: Calculate metrics from WebSocket connection data
    console.log(`🔄 [${callSid}] Falling back to WebSocket metrics calculation`);
    return await this.calculateMetricsFromWebSocket(callSid);
  }

  /**
   * Try to fetch metrics from Voice Insights API
   * @private
   * @param {string} callSid - Twilio Call SID
   * @param {Object} options - Retry options
   * @returns {Promise<Object|null>} Metrics or null if unavailable
   */
  async tryVoiceInsightsAPI(callSid, options = {}) {
    const { maxRetries = 6, initialDelay = 5000 } = options;
    
    try {
      let metrics = null;
      let retries = maxRetries;
      let delay = initialDelay;
      let lastError = null;
      let consecutive404s = 0;

      console.log(`🔍 [${callSid}] Attempting Voice Insights API (max ${maxRetries} retries, initial delay ${initialDelay}ms)`);

      // Retry logic: Twilio metrics may take up to 90 seconds to be available
      while (retries > 0 && !metrics) {
        try {
          // Fetch call data from Twilio Voice Insights (metrics are included in the call object)
          const callInsights = await this.client.insights.v1.calls(callSid).fetch();
          
          console.log(`📊 [${callSid}] Twilio API response received, checking for metrics...`);
          
          // Metrics are available in the call object's metrics property
          if (callInsights && callInsights.metrics) {
            metrics = this._extractMetrics(callInsights.metrics);
            
            console.log(`📊 [${callSid}] Extracted metrics:`, {
              latency: metrics.latency,
              jitter: metrics.jitter,
              packetLoss: metrics.packetLoss
            });
            
            // Only proceed if we have at least one metric
            if (metrics.latency !== null || metrics.jitter !== null || metrics.packetLoss !== null) {
              console.log(`✅ [${callSid}] Found valid metrics from Voice Insights API`);
              break;
            } else {
              console.log(`⚠️ [${callSid}] Metrics object exists but all values are null`);
            }
          } else {
            console.log(`⚠️ [${callSid}] Call insights received but no metrics property found`);
          }
        } catch (error) {
          lastError = error;
          consecutive404s++;
          
          // If metrics aren't available yet (404), check if it's a plan limitation
          if (error.status === 404 || error.code === 20404) {
            // After 2 consecutive 404s, likely a plan limitation - stop retrying
            if (consecutive404s >= 2) {
              this.basicPlanDetected = true;
              console.warn(`⚠️ [${callSid}] Voice Insights API returning 404 - Basic plan detected`);
              console.warn(`⚠️ [${callSid}] Call Metrics & Events API requires Voice Insights Advanced Features (paid plan)`);
              console.warn(`⚠️ [${callSid}] Basic Voice Insights plan includes dashboard access but NOT API access`);
              console.warn(`⚠️ [${callSid}] Falling back to WebSocket metrics calculation`);
              console.warn(`⚠️ [${callSid}] Skipping future Voice Insights API calls to avoid unnecessary retries`);
              break; // Exit retry loop
            }
            
            if (retries > 1) {
              console.log(`⏳ [${callSid}] Call metrics not available yet (404), retrying in ${delay}ms... (${retries - 1} retries left)`);
              await new Promise(resolve => setTimeout(resolve, delay));
              delay = Math.min(delay * 1.5, 30000); // Exponential backoff, max 30s delay
              retries--;
            } else {
              // Final attempt failed - likely basic plan
              this.basicPlanDetected = true;
              console.warn(`⚠️ [${callSid}] Voice Insights API unavailable (404) - Basic plan detected`);
              break;
            }
          } else {
            // Reset 404 counter for non-404 errors
            consecutive404s = 0;
            // Log other errors but continue retrying (might be temporary network issues)
            console.warn(`⚠️ [${callSid}] Error fetching metrics (status: ${error.status}, code: ${error.code}):`, error.message);
            if (retries > 1) {
              await new Promise(resolve => setTimeout(resolve, delay));
              delay = Math.min(delay * 1.5, 30000);
              retries--;
            } else {
              throw error;
            }
          }
        }
      }

      // If we have metrics, calculate MOS and save to CallRecord
      if (metrics && (metrics.latency !== null || metrics.jitter !== null || metrics.packetLoss !== null)) {
        return await this._saveMetrics(callSid, metrics, 'voice_insights');
      } else {
        if (this.basicPlanDetected) {
          console.log(`ℹ️ [${callSid}] Voice Insights API not available - Basic plan detected`);
        } else if (lastError && (lastError.status === 404 || lastError.code === 20404)) {
          console.warn(`⚠️ [${callSid}] Voice Insights API unavailable (404) after ${maxRetries} retries`);
        } else if (lastError) {
          console.error(`❌ [${callSid}] No call quality metrics available from Twilio after ${maxRetries} retries. Last error:`, lastError.message);
        } else {
          console.log(`⚠️ [${callSid}] No call quality metrics available from Twilio after ${maxRetries} retries (metrics object was null or empty)`);
        }
        return null;
      }
    } catch (error) {
      console.error(`❌ [${callSid}] Error in tryVoiceInsightsAPI:`, error.message);
      // Don't throw - fallback to WebSocket metrics
      return null;
    }
  }

  /**
   * Calculate metrics from WebSocket connection quality data
   * @private
   * @param {string} callSid - Twilio Call SID
   * @returns {Promise<Object|null>} Metrics object or null if unavailable
   */
  async calculateMetricsFromWebSocket(callSid) {
    try {
      const callRecord = await CallRecord.findOne({ callSid });
      if (!callRecord || !callRecord.websocketMetrics) {
        console.log(`ℹ️ [${callSid}] No WebSocket metrics available in CallRecord`);
        return null;
      }

      const wsMetrics = callRecord.websocketMetrics;
      
      // Extract metrics from WebSocket data
      const latency = wsMetrics.avgLatency !== null && wsMetrics.avgLatency !== undefined 
        ? wsMetrics.avgLatency 
        : null;
      
      // Estimate jitter from latency variance (standard deviation)
      const jitter = wsMetrics.latencyVariance !== null && wsMetrics.latencyVariance !== undefined
        ? Math.sqrt(wsMetrics.latencyVariance) // Standard deviation approximates jitter
        : null;
      
      const packetLoss = wsMetrics.packetLoss !== null && wsMetrics.packetLoss !== undefined
        ? wsMetrics.packetLoss
        : null;

      // Only proceed if we have at least one metric
      if (latency === null && jitter === null && packetLoss === null) {
        console.log(`⚠️ [${callSid}] All WebSocket metrics are null, cannot calculate MOS`);
        return null;
      }

      console.log(`📊 [${callSid}] Calculated metrics from WebSocket:`, {
        latency,
        jitter,
        packetLoss
      });

      return await this._saveMetrics(callSid, { latency, jitter, packetLoss }, 'websocket');
    } catch (error) {
      console.error(`❌ [${callSid}] Error calculating metrics from WebSocket:`, error.message);
      return null;
    }
  }

  /**
   * Save metrics to CallRecord
   * @private
   * @param {string} callSid - Call SID
   * @param {Object} metrics - Metrics object with latency, jitter, packetLoss
   * @param {string} source - Source of metrics ('voice_insights', 'websocket', 'annotations')
   * @returns {Promise<Object>} Saved metrics
   */
  async _saveMetrics(callSid, metrics, source = 'websocket') {
    // Only use actual values, don't default to 0 (which would skew averages)
    const latency = metrics.latency !== null ? metrics.latency : null;
    const jitter = metrics.jitter !== null ? metrics.jitter : null;
    const packetLoss = metrics.packetLoss !== null ? metrics.packetLoss : null;
    
    // Calculate MOS only if we have at least one metric
    if (latency === null && jitter === null && packetLoss === null) {
      console.log(`⚠️ [${callSid}] All metrics are null, cannot calculate MOS`);
      return null;
    }

    // Calculate MOS score (use 0 for null values in calculation, but don't save nulls)
    const mosScore = this._calculateMOS(latency || 0, jitter || 0, packetLoss || 0);
    const callQuality = this._getQualityCategory(mosScore);

    // Build update object - only include fields that have values
    const updateFields = {
      'audioQuality.mosScore': mosScore,
      'audioQuality.callQuality': callQuality,
      'audioQuality.measuredAt': new Date(),
      'audioQuality.source': source
    };
    
    if (latency !== null) updateFields['audioQuality.latency'] = latency;
    if (jitter !== null) updateFields['audioQuality.jitter'] = jitter;
    if (packetLoss !== null) updateFields['audioQuality.packetLoss'] = packetLoss;

    // Update CallRecord with audio quality metrics
    await CallRecord.findOneAndUpdate(
      { callSid: callSid },
      { $set: updateFields },
      { upsert: false } // Don't create if doesn't exist (should already exist)
    );

    console.log(`✅ [${callSid}] Call quality metrics saved (source: ${source}): MOS=${mosScore.toFixed(2)}, Latency=${latency || 'N/A'}ms, Jitter=${jitter || 'N/A'}ms, PacketLoss=${packetLoss !== null ? packetLoss.toFixed(2) : 'N/A'}%`);
    
    // Check for alerts (async, don't wait)
    this.checkAndTriggerAlerts(callSid, {
      latency,
      jitter,
      packetLoss,
      mosScore,
      callQuality
    }).catch(err => {
      console.warn(`⚠️ [${callSid}] Failed to check alerts:`, err.message);
    });
    
    // Auto-tag call with quality annotations (async, don't wait)
    this.autoTagCallQuality(callSid, {
      latency,
      jitter,
      packetLoss,
      mosScore,
      callQuality
    }).catch(err => {
      console.warn(`⚠️ [${callSid}] Failed to auto-tag call quality:`, err.message);
    });
    
    return {
      latency,
      jitter,
      packetLoss,
      mosScore,
      callQuality,
      source
    };
  }

  /**
   * Extract audio quality metrics from Twilio Voice Insights response
   * @private
   * @param {Object} twilioMetrics - Metrics object from Twilio API
   * @returns {Object} Extracted metrics with latency, jitter, packetLoss
   */
  _extractMetrics(twilioMetrics) {
    const metrics = {
      latency: null,
      jitter: null,
      packetLoss: null
    };

    // Extract latency (one-way delay)
    // Twilio may provide this in different formats
    if (twilioMetrics.oneWayLatency) {
      if (typeof twilioMetrics.oneWayLatency === 'object' && twilioMetrics.oneWayLatency.avg) {
        metrics.latency = parseFloat(twilioMetrics.oneWayLatency.avg);
      } else if (typeof twilioMetrics.oneWayLatency === 'number') {
        metrics.latency = twilioMetrics.oneWayLatency;
      }
    } else if (twilioMetrics.latency) {
      if (typeof twilioMetrics.latency === 'object' && twilioMetrics.latency.avg) {
        metrics.latency = parseFloat(twilioMetrics.latency.avg);
      } else if (typeof twilioMetrics.latency === 'number') {
        metrics.latency = twilioMetrics.latency;
      }
    }

    // Extract jitter
    if (twilioMetrics.jitter) {
      if (typeof twilioMetrics.jitter === 'object' && twilioMetrics.jitter.avg) {
        metrics.jitter = parseFloat(twilioMetrics.jitter.avg);
      } else if (typeof twilioMetrics.jitter === 'number') {
        metrics.jitter = parseFloat(twilioMetrics.jitter);
      }
    }

    // Extract packet loss (convert to percentage if needed)
    if (twilioMetrics.packetLoss) {
      if (typeof twilioMetrics.packetLoss === 'object' && twilioMetrics.packetLoss.avg) {
        const value = parseFloat(twilioMetrics.packetLoss.avg);
        // If value is less than 1, assume it's already a percentage; otherwise convert from decimal
        metrics.packetLoss = value < 1 ? value * 100 : value;
      } else if (typeof twilioMetrics.packetLoss === 'number') {
        const value = parseFloat(twilioMetrics.packetLoss);
        metrics.packetLoss = value < 1 ? value * 100 : value;
      }
    } else if (twilioMetrics.packetLossPercent) {
      metrics.packetLoss = parseFloat(twilioMetrics.packetLossPercent);
    }

    return metrics;
  }

  /**
   * Calculate MOS score using E-model approximation
   * Based on latency, jitter, and packet loss
   * @private
   * @param {number} latency - Latency in ms
   * @param {number} jitter - Jitter in ms
   * @param {number} packetLoss - Packet loss percentage
   * @returns {number} MOS score (1-5)
   */
  _calculateMOS(latency, jitter, packetLoss) {
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
   * @private
   * @param {number} mosScore - MOS score (1-5)
   * @returns {string} Quality category
   */
  _getQualityCategory(mosScore) {
    if (mosScore >= 4.0) return 'excellent';
    if (mosScore >= 3.5) return 'good';
    if (mosScore >= 3.0) return 'fair';
    return 'poor';
  }

  /**
   * Tag a call with quality issues using Call Annotations API
   * Available in both Basic and Advanced Voice Insights plans
   * @param {string} callSid - Twilio Call SID
   * @param {Object} options - Annotation options
   * @param {string[]} options.qualityIssues - Array of quality issues (e.g., ['low_volume', 'choppy_audio'])
   * @param {number} options.callScore - Call quality score (1-5)
   * @param {boolean} options.spam - Whether call is spam
   * @param {string} options.comment - Custom comment
   * @returns {Promise<boolean>} True if annotation was successful
   */
  async tagCallWithAnnotation(callSid, options = {}) {
    try {
      const {
        qualityIssues = [],
        callScore = null,
        spam = false,
        comment = null
      } = options;

      // Build annotation payload - only include non-empty values
      const annotationPayload = {};
      
      if (qualityIssues.length > 0) {
        annotationPayload.qualityIssues = qualityIssues;
      }
      
      if (callScore !== null && callScore >= 1 && callScore <= 5) {
        annotationPayload.callScore = callScore;
      }
      
      if (spam) {
        annotationPayload.spam = true;
      }
      
      if (comment) {
        annotationPayload.comment = comment;
      }

      // Skip if no annotations to add
      if (Object.keys(annotationPayload).length === 0) {
        console.log(`ℹ️ [${callSid}] No annotations to add`);
        return false;
      }

      await this.client.insights.v1.calls(callSid)
        .annotations
        .create(annotationPayload);

      console.log(`✅ [${callSid}] Call annotated:`, annotationPayload);
      return true;
    } catch (error) {
      // Don't fail if annotations API is unavailable (might be basic plan limitation)
      if (error.status === 404 || error.code === 20404) {
        console.warn(`⚠️ [${callSid}] Call Annotations API unavailable (404) - may require Advanced Features for some operations`);
      } else {
        console.warn(`⚠️ [${callSid}] Failed to annotate call:`, error.message);
      }
      return false;
    }
  }

  /**
   * Check for alert conditions and trigger alerts if needed
   * @private
   * @param {string} callSid - Twilio Call SID
   * @param {Object} metrics - Metrics object with latency, jitter, packetLoss, mosScore, callQuality
   * @returns {Promise<void>}
   */
  async checkAndTriggerAlerts(callSid, metrics) {
    try {
      const { latency, jitter, packetLoss, mosScore, callQuality } = metrics;
      const alerts = [];

      // Check for critical quality issues
      if (mosScore !== null && mosScore < 2.5) {
        alerts.push({
          title: 'Poor Call Quality Detected',
          message: `Call quality is poor (MOS: ${mosScore.toFixed(2)})`,
          severity: 'warning',
          callerId: callSid,
          reason: 'poor_call_quality',
          component: 'voice-insights',
          source: 'agent-service',
          metadata: { mosScore, callQuality, callSid }
        });
      }

      if (latency !== null && latency > 500) {
        alerts.push({
          title: 'High Latency Detected',
          message: `Call latency is ${latency}ms, exceeding threshold (500ms)`,
          severity: 'warning',
          callerId: callSid,
          reason: 'high_latency',
          component: 'voice-insights',
          source: 'agent-service',
          metadata: { latency, callSid }
        });
      }

      if (packetLoss !== null && packetLoss > 10) {
        alerts.push({
          title: 'High Packet Loss Detected',
          message: `Packet loss is ${packetLoss.toFixed(2)}%, exceeding threshold (10%)`,
          severity: 'critical',
          callerId: callSid,
          reason: 'high_packet_loss',
          component: 'voice-insights',
          source: 'agent-service',
          metadata: { packetLoss, callSid }
        });
      }

      // Save alerts to database
      for (const alertData of alerts) {
        try {
          const alert = new Alert(alertData);
          await alert.save();
          console.log(`📢 [${callSid}] Alert created: ${alertData.title}`);
        } catch (error) {
          console.warn(`⚠️ [${callSid}] Failed to save alert:`, error.message);
        }
      }
    } catch (error) {
      console.warn(`⚠️ [${callSid}] Error checking alerts:`, error.message);
    }
  }

  /**
   * Automatically tag call with quality issues based on metrics
   * @param {string} callSid - Twilio Call SID
   * @param {Object} metrics - Metrics object with latency, jitter, packetLoss, mosScore, callQuality
   * @returns {Promise<void>}
   */
  async autoTagCallQuality(callSid, metrics) {
    if (!metrics) return;

    const qualityIssues = [];
    const { latency, jitter, packetLoss, mosScore, callQuality } = metrics;

    // Detect quality issues based on metrics
    if (latency !== null && latency > 300) {
      qualityIssues.push('latency');
    }
    
    if (jitter !== null && jitter > 50) {
      qualityIssues.push('choppy_audio');
    }
    
    if (packetLoss !== null && packetLoss > 5) {
      qualityIssues.push('static_noise');
    }
    
    if (mosScore !== null && mosScore < 3.0) {
      qualityIssues.push('low_volume');
    }

    // Map call quality to call score
    const callScoreMap = {
      'excellent': 5,
      'good': 4,
      'fair': 3,
      'poor': 2
    };
    const callScore = callQuality ? callScoreMap[callQuality] || 3 : null;

    // Only tag if there are issues or score is low
    if (qualityIssues.length > 0 || (callScore !== null && callScore <= 3)) {
      await this.tagCallWithAnnotation(callSid, {
        qualityIssues,
        callScore,
        comment: `Auto-tagged: MOS=${mosScore?.toFixed(2) || 'N/A'}, Quality=${callQuality || 'unknown'}`
      });
    }
  }
}

export default new TwilioMetricsService();

