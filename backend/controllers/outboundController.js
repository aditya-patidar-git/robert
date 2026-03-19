import CallRecord from "../models/CallRecord.js";
import axios from "axios";
import twilio from "twilio";

// Constants for recording fetch configuration
const TWILIO_FETCH_TIMEOUT_MS = 10000; // 10 seconds timeout for Twilio API
const RECORDING_CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes before re-checking "not_found" status

/**
 * Fetch recording URL from Twilio with timeout
 * @param {object} twilioClient - Initialized Twilio client
 * @param {string} callSid - The call SID to fetch recording for
 * @returns {Promise<{success: boolean, url?: string, status: string, error?: string}>}
 */
const fetchRecordingFromTwilio = async (twilioClient, callSid) => {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.warn(`⏱️ [${callSid}] Twilio API timeout after ${TWILIO_FETCH_TIMEOUT_MS}ms`);
      resolve({ success: false, status: 'error', error: 'Twilio API timeout' });
    }, TWILIO_FETCH_TIMEOUT_MS);

    twilioClient.recordings.list({ callSid, limit: 1 })
      .then((recordings) => {
        clearTimeout(timeoutId);
        
        if (recordings && recordings.length > 0) {
          const recording = recordings[0];
          let url = recording.uri.replace('.json', '');
          if (url && !url.startsWith('http')) {
            url = (url.startsWith('/') ? '' : '/') + url;
            url = 'https://api.twilio.com' + url;
          }
          resolve({ success: true, url, status: 'available' });
        } else {
          resolve({ success: false, status: 'not_found', error: 'No recording found on Twilio' });
        }
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        console.error(`❌ [${callSid}] Twilio API error:`, error.message);
        resolve({ success: false, status: 'error', error: error.message });
      });
  });
};

/**
 * Check if we should re-check Twilio for a recording
 * @param {object} callRecord - The call record from database
 * @returns {boolean} - true if we should check Twilio again
 */
const shouldRecheckTwilio = (callRecord) => {
  // Always check if status is unknown or we have no checked timestamp
  if (callRecord.recordingStatus === 'unknown' || !callRecord.recordingCheckedAt) {
    return true;
  }
  
  // If recording is available and we have a URL, no need to check
  if (callRecord.recordingStatus === 'available' && callRecord.recordingUrl) {
    return false;
  }
  
  // For "not_found" or "processing" status, re-check after cache duration
  const timeSinceLastCheck = Date.now() - new Date(callRecord.recordingCheckedAt).getTime();
  return timeSinceLastCheck > RECORDING_CACHE_DURATION_MS;
};

/**
 * Update recording status in database
 * @param {string} callSid - The call SID
 * @param {object} updates - Fields to update
 */
const updateRecordingStatus = async (callSid, updates) => {
  try {
    await CallRecord.findOneAndUpdate(
      { callSid },
      { $set: { ...updates, recordingCheckedAt: new Date() } }
    );
  } catch (error) {
    console.error(`❌ [${callSid}] Failed to update recording status:`, error.message);
  }
};

/**
 * Proxy recording from Twilio
 * Fetches the recording URL from CallRecord and streams it from Twilio
 */
export const proxyRecording = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { callSid } = req.params;

    if (!callSid) {
      return res.status(400).json({ error: 'Call SID is required' });
    }

    // Find the call record
    const callRecord = await CallRecord.findOne({ callSid });
    
    if (!callRecord) {
      return res.status(404).json({ error: 'Call record not found' });
    }

    // Require explicit agreed consent (true); declined or not recorded block playback
    if (callRecord.recordingConsent?.given !== true) {
      return res.status(403).json({
        error: 'Recording not available - recording consent not agreed',
        message: 'Recording is only available when the caller agreed to recording.'
      });
    }

    // Check if recording was previously marked as not found (cached negative result)
    if (callRecord.recordingStatus === 'not_found' && !shouldRecheckTwilio(callRecord)) {
      console.log(`📋 [${callSid}] Recording previously marked as not found (cached)`);
      return res.status(404).json({ 
        error: 'Recording not available',
        message: 'No recording exists for this call. The call may not have been recorded.',
        cached: true
      });
    }

    // If recordingUrl is not set, try fetching from Twilio API
    if (!callRecord.recordingUrl && shouldRecheckTwilio(callRecord)) {
      // Check Twilio credentials
      const accountSid = process.env.TWILIO_SID || process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      
      if (!accountSid || !authToken) {
        console.error(`❌ [${callSid}] Twilio credentials not configured`);
        return res.status(500).json({ error: 'Recording service not configured' });
      }

      console.log(`🔍 [${callSid}] Fetching recording from Twilio (timeout: ${TWILIO_FETCH_TIMEOUT_MS}ms)...`);
      
      const twilioClient = twilio(accountSid, authToken);
      const result = await fetchRecordingFromTwilio(twilioClient, callSid);
      
      const elapsed = Date.now() - startTime;
      
      if (result.success && result.url) {
        // Recording found - update database
        await updateRecordingStatus(callSid, {
          recordingUrl: result.url,
          recordingStatus: 'available'
        });
        callRecord.recordingUrl = result.url;
        console.log(`✅ [${callSid}] Recording URL fetched and saved (${elapsed}ms)`);
      } else {
        // Recording not found or error - cache the result
        await updateRecordingStatus(callSid, {
          recordingStatus: result.status
        });
        
        console.log(`⚠️ [${callSid}] Recording ${result.status}: ${result.error} (${elapsed}ms)`);
        
        if (result.status === 'not_found') {
          return res.status(404).json({ 
            error: 'Recording not available',
            message: 'No recording exists for this call. The call may not have been recorded.'
          });
        } else {
          return res.status(503).json({ 
            error: 'Recording temporarily unavailable',
            message: 'Unable to fetch recording from Twilio. Please try again in a moment.',
            retryAfter: 30
          });
        }
      }
    }

    if (!callRecord.recordingUrl) {
      return res.status(404).json({ error: 'Recording not available for this call' });
    }

    let twilioUrl = callRecord.recordingUrl.endsWith('.mp3')
      ? callRecord.recordingUrl
      : `${callRecord.recordingUrl}.mp3`;
    if (typeof twilioUrl === 'string' && twilioUrl.startsWith('/')) {
      twilioUrl = 'https://api.twilio.com' + twilioUrl;
    }

    const response = await axios.get(twilioUrl, {
      auth: {
        username: process.env.TWILIO_SID || process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN
      },
      responseType: 'stream',
      timeout: 30000,
      validateStatus: () => true
    });

    // Check for non-2xx response from Twilio
    if (response.status >= 400) {
      console.error(`❌ [${callSid}] Twilio returned ${response.status} for recording`);
      
      // If Twilio says 404, the recording might have been deleted
      if (response.status === 404) {
        await updateRecordingStatus(callSid, {
          recordingStatus: 'not_found',
          recordingUrl: null
        });
        return res.status(404).json({ 
          error: 'Recording no longer available',
          message: 'The recording may have been deleted from Twilio.'
        });
      }
      
      return res.status(response.status).json({ 
        error: 'Failed to fetch recording from Twilio'
      });
    }

    // Set response headers
    const contentType = response.headers['content-type'] || 'audio/mpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="recording-${callSid}.mp3"`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // Handle stream errors
    response.data.on('error', (error) => {
      console.error(`❌ [${callSid}] Stream error:`, error.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error streaming recording' });
      }
    });

    // Pipe the audio stream to the response
    response.data.pipe(res);

  } catch (error) {
    console.error('Recording proxy error:', error.message);
    
    if (error.response) {
      if (error.response.status === 404) {
        return res.status(404).json({ error: 'Recording not found on Twilio' });
      }
      return res.status(error.response.status).json({ 
        error: 'Failed to fetch recording from Twilio',
        details: error.response.statusText
      });
    }
    
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Request timeout while fetching recording' });
    }

    res.status(500).json({ 
      error: 'Error fetching recording',
      details: error.message
    });
  }
};

const ENSURE_RECORDINGS_MAX = 20;
const ENSURE_RECORDINGS_CONCURRENCY = 5;

/**
 * Ensure recording URLs are present and absolute for given call SIDs (for current page prefetch).
 * POST body: { callSids: string[] }. Auth required.
 */
export const ensureRecordings = async (req, res) => {
  try {
    const { callSids } = req.body || {};
    if (!Array.isArray(callSids) || callSids.length === 0) {
      return res.status(200).json({ ensured: 0 });
    }
    const accountSid = process.env.TWILIO_SID || process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      return res.status(200).json({ ensured: 0 });
    }
    const twilioClient = twilio(accountSid, authToken);
    const toProcess = callSids.slice(0, ENSURE_RECORDINGS_MAX);

    const processOne = async (callSid) => {
      const callRecord = await CallRecord.findOne({ callSid }).lean();
      if (!callRecord || callRecord.recordingConsent?.given !== true) return 0;
      const url = callRecord.recordingUrl;
      if (url && !url.startsWith('/')) return 0;
      const result = await fetchRecordingFromTwilio(twilioClient, callSid);
      if (result.success && result.url) {
        await updateRecordingStatus(callSid, { recordingUrl: result.url, recordingStatus: 'available' });
        return 1;
      }
      return 0;
    };

    let ensured = 0;
    for (let i = 0; i < toProcess.length; i += ENSURE_RECORDINGS_CONCURRENCY) {
      const chunk = toProcess.slice(i, i + ENSURE_RECORDINGS_CONCURRENCY);
      const counts = await Promise.all(chunk.map(processOne));
      ensured += counts.reduce((a, b) => a + b, 0);
    }
    res.status(200).json({ ensured });
  } catch (error) {
    console.error('ensureRecordings error:', error.message);
    res.status(500).json({ error: 'Failed to ensure recordings', details: error.message });
  }
};
