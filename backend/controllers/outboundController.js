import CallRecord from "../models/CallRecord.js";
import axios from "axios";

/**
 * Proxy recording from Twilio
 * Fetches the recording URL from CallRecord and streams it from Twilio
 */
export const proxyRecording = async (req, res) => {
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

    if (!callRecord.recordingUrl) {
      return res.status(404).json({ error: 'Recording not available for this call' });
    }

    // Construct Twilio recording URL (add .mp3 extension if not present)
    const twilioUrl = callRecord.recordingUrl.endsWith('.mp3') 
      ? callRecord.recordingUrl 
      : `${callRecord.recordingUrl}.mp3`;

    // Check if Twilio credentials are available
    if (!process.env.TWILIO_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.error('Twilio credentials not configured');
      return res.status(500).json({ error: 'Recording service not configured' });
    }

    // Fetch recording from Twilio with authentication
    const response = await axios.get(twilioUrl, {
      auth: {
        username: process.env.TWILIO_SID,
        password: process.env.TWILIO_AUTH_TOKEN
      },
      responseType: 'stream',
      timeout: 30000 // 30 second timeout
    });

    // Set appropriate headers for audio streaming
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `inline; filename="recording-${callSid}.mp3"`);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    // Pipe the audio stream to the response
    response.data.pipe(res);

    // Handle stream errors
    response.data.on('error', (error) => {
      console.error('Error streaming recording:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error streaming recording' });
      }
    });

  } catch (error) {
    console.error('Recording proxy error:', error.message);
    
    if (error.response) {
      // Twilio API error
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
