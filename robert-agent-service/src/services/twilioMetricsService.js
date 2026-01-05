/**
 * TwilioMetricsService - Fetches call quality metrics from Twilio Voice Insights API
 * and saves them to CallRecord documents
 */

import twilio from 'twilio';
import CallRecord from '../database/models/CallRecord.js';
import Alert from '../database/models/Alert.js';

class TwilioMetricsService {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_SID || process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }

  /**
   * Fetch and save call quality metrics for a completed call
   * @param {string} callSid - Twilio Call SID
   * @param {Object} options - Options for fetching metrics
   * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
   * @param {number} options.initialDelay - Initial delay in ms before first retry (default: 2000)
   * @returns {Promise<Object|null>} Metrics object or null if unavailable
   */
  async fetchAndSaveCallQualityMetrics(callSid, options = {}) {
    const { maxRetries = 3, initialDelay = 2000 } = options;
    
    try {
      let metrics = null;
      let retries = maxRetries;
      let delay = initialDelay;

      // Retry logic: Twilio metrics may take up to 90 seconds to be available
      while (retries > 0 && !metrics) {
        try {
          // Fetch call data from Twilio Voice Insights (metrics are included in the call object)
          const callInsights = await this.client.insights.v1.calls(callSid).fetch();
          
          // Metrics are available in the call object's metrics property
          if (callInsights && callInsights.metrics) {
            metrics = this._extractMetrics(callInsights.metrics);
            
            // Only proceed if we have at least one metric
            if (metrics.latency !== null || metrics.jitter !== null || metrics.packetLoss !== null) {
              break;
            }
          }
        } catch (error) {
          // If metrics aren't available yet (404), retry with exponential backoff
          if (error.status === 404 || error.code === 20404) {
            console.log(`⏳ [${callSid}] Call metrics not available yet, retrying in ${delay}ms... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
            retries--;
          } else {
            // Other errors should be thrown
            throw error;
          }
        }
      }

      // If we have metrics, calculate MOS and save to CallRecord
      if (metrics && (metrics.latency !== null || metrics.jitter !== null || metrics.packetLoss !== null)) {
        // Use default values if some metrics are missing
        const latency = metrics.latency || 0;
        const jitter = metrics.jitter || 0;
        const packetLoss = metrics.packetLoss || 0;

        // Calculate MOS score
        const mosScore = this._calculateMOS(latency, jitter, packetLoss);
        const callQuality = this._getQualityCategory(mosScore);

        // Update CallRecord with audio quality metrics
        await CallRecord.findOneAndUpdate(
          { callSid: callSid },
          {
            $set: {
              'audioQuality.latency': latency,
              'audioQuality.jitter': jitter,
              'audioQuality.packetLoss': packetLoss,
              'audioQuality.mosScore': mosScore,
              'audioQuality.callQuality': callQuality,
              'audioQuality.measuredAt': new Date()
            }
          }
        );

        console.log(`✅ [${callSid}] Call quality metrics saved: MOS=${mosScore.toFixed(2)}, Latency=${latency}ms, Jitter=${jitter}ms, PacketLoss=${packetLoss.toFixed(2)}%`);
        
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
        
        return {
          latency,
          jitter,
          packetLoss,
          mosScore,
          callQuality
        };
      } else {
        console.log(`⚠️ [${callSid}] No call quality metrics available from Twilio after ${maxRetries} retries`);
        return null;
      }
    } catch (error) {
      console.error(`❌ [${callSid}] Error in fetchAndSaveCallQualityMetrics:`, error);
      // Don't throw - we don't want to block call completion if metrics fail
      return null;
    }
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
}

export default new TwilioMetricsService();

