/**
 * Recording Service
 * Handles call recording via Twilio API
 * Used for Media Streams calls where TwiML <Record> verb causes audio issues
 * 
 * @module recordingService
 */

import twilioClient from '../utils/twilioClient.js';

/**
 * Default recording configuration
 */
const DEFAULT_RECORDING_CONFIG = {
  recordingChannels: 'dual', // Separate channels for each party
  recordingTrack: 'both',    // Record both sides
  trim: 'trim-silence'       // Trim leading silence
};

/**
 * Start recording for an active call
 * @param {string} callSid - The Call SID to record
 * @param {Object} options - Recording options
 * @param {string} options.statusCallbackUrl - URL for recording status webhook
 * @param {string} options.recordingChannels - 'mono' or 'dual' (default: 'dual')
 * @param {string} options.recordingTrack - 'inbound', 'outbound', or 'both' (default: 'both')
 * @returns {Promise<Object>} - Recording object from Twilio
 */
export async function startCallRecording(callSid, options = {}) {
  const { statusCallbackUrl, ...recordingOptions } = options;
  
  const config = {
    ...DEFAULT_RECORDING_CONFIG,
    ...recordingOptions
  };

  // Add status callback if provided
  if (statusCallbackUrl) {
    config.recordingStatusCallback = statusCallbackUrl;
    config.recordingStatusCallbackMethod = 'POST';
    config.recordingStatusCallbackEvent = ['completed', 'failed'];
  }

  try {
    console.log(`🎙️ [${callSid}] Starting call recording via Twilio API...`);
    
    const recording = await twilioClient.calls(callSid).recordings.create(config);
    
    console.log(`✅ [${callSid}] Recording started: SID=${recording.sid}`);
    return {
      success: true,
      recordingSid: recording.sid,
      status: recording.status
    };
  } catch (error) {
    // Handle specific Twilio errors
    if (error.code === 20404) {
      console.warn(`⚠️ [${callSid}] Call not found or already ended - cannot start recording`);
      return { success: false, error: 'call_not_found', message: 'Call not found or already ended' };
    }
    
    if (error.code === 21220) {
      console.warn(`⚠️ [${callSid}] Recording already in progress`);
      return { success: true, error: 'already_recording', message: 'Recording already in progress' };
    }
    
    console.error(`❌ [${callSid}] Failed to start recording:`, error.message);
    return { success: false, error: 'recording_failed', message: error.message };
  }
}

/**
 * Stop recording for an active call
 * @param {string} callSid - The Call SID
 * @param {string} recordingSid - The Recording SID to stop (optional - stops all if not provided)
 * @returns {Promise<Object>} - Result object
 */
export async function stopCallRecording(callSid, recordingSid = null) {
  try {
    if (recordingSid) {
      // Stop specific recording
      await twilioClient.calls(callSid).recordings(recordingSid).update({ status: 'stopped' });
      console.log(`⏹️ [${callSid}] Recording ${recordingSid} stopped`);
    } else {
      // Stop all recordings on the call
      const recordings = await twilioClient.calls(callSid).recordings.list({ status: 'in-progress' });
      for (const recording of recordings) {
        await twilioClient.calls(callSid).recordings(recording.sid).update({ status: 'stopped' });
        console.log(`⏹️ [${callSid}] Recording ${recording.sid} stopped`);
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error(`❌ [${callSid}] Failed to stop recording:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get recording callback URL based on call type
 * @param {string} callType - 'inbound' or 'outbound'
 * @returns {string} - Full callback URL
 */
export function getRecordingCallbackUrl(callType = 'inbound') {
  const baseUrl = process.env.TUNNEL_DOMAIN 
    ? `https://${process.env.TUNNEL_DOMAIN}` 
    : process.env.BASE_URL || 'http://localhost:3002';
  
  return `${baseUrl}/api/${callType}/recording-status`;
}

/**
 * Check if call should be recorded based on consent
 * @param {Object} conversation - Conversation state object
 * @returns {boolean} - true if recording should proceed
 */
export function shouldRecordCall(conversation) {
  // Default is opt-in: record unless explicitly denied
  const consentGiven = conversation?.recordingConsent?.given;
  return consentGiven !== false;
}

export default {
  startCallRecording,
  stopCallRecording,
  getRecordingCallbackUrl,
  shouldRecordCall
};
