import axios from "axios";
import CallRecord from "../database/models/CallRecord.js";
import { conversations } from "../shared/state.js";
import twilioClient from "../utils/twilioClient.js";
import gdprService from "../services/gdprService.js";
import piiDetectionService from "../services/piiDetectionService.js";
// dotenv is already loaded in index.js, no need to reload here

/**
 * Get recording consent from conversation state or CallRecord
 * Handles cases where conversation might be cleaned up before webhook arrives
 */
async function getRecordingConsent(callSid) {
    // First try to get from conversation state
    if (conversations[callSid]?.recordingConsent) {
        return {
            consent: conversations[callSid].recordingConsent,
            from: conversations[callSid].from,
            to: conversations[callSid].to,
            transcript: conversations[callSid].transcript
        };
    }
    
    // Fallback: check CallRecord if conversation was cleaned up
    try {
        const existingRecord = await CallRecord.findOne({ callSid }).lean();
        if (existingRecord) {
            // If recordingConsent exists, use it (even if given is null - that means opt-in)
            // If recordingConsent doesn't exist, default to opt-in (given: true)
            const consent = existingRecord.recordingConsent || {
                requested: false,
                given: null, // null means opt-in by default
                requestedAt: null,
                respondedAt: null,
                optOutReason: null
            };
            
            return {
                consent: consent,
                from: existingRecord.from,
                to: existingRecord.to,
                transcript: existingRecord.transcript || []
            };
        }
    } catch (err) {
        console.error(`❌ [${callSid}] Error fetching consent from CallRecord:`, err);
    }
    
    // If no record found, default to opt-in
    return {
        consent: {
            requested: false,
            given: null, // null means opt-in by default
            requestedAt: null,
            respondedAt: null,
            optOutReason: null
        },
        from: null,
        to: null,
        transcript: []
    };
}

// Recording status
export const recordingStatus = async (req, res) => {
    const { RecordingUrl, CallSid } = req.body;
    try {
        // Get consent from conversation state or CallRecord
        const consentData = await getRecordingConsent(CallSid);
        
        if (!consentData) {
            console.log(`⚠️ [${CallSid}] No consent data found - storing minimal record`);
            await CallRecord.findOneAndUpdate(
                { callSid: CallSid },
                { 
                    $set: {
                        recordingUrl: null,
                        recordingStatus: 'error',
                        'recordingConsent.requested': false,
                        'recordingConsent.given': false,
                        'recordingConsent.optOutReason': "Consent data unavailable"
                    }
                },
                { upsert: true, new: true }
            );
            res.sendStatus(200);
            return;
        }
        
        const { consent, from, to, transcript } = consentData;
        // Default is opt-in: null/undefined means consent given, only false means denied
        const consentGiven = consent?.given !== false;
        
        if (!consentGiven) {
            // Consent was denied - do not store recording OR transcript (GDPR compliance)
            console.log(`🚫 [${CallSid}] Recording consent not given - not storing recording URL or transcript`);
            
            // Use $set to only update consent-related fields
            // Clear any existing recording/transcript data for GDPR compliance
            const updateFields = {
                recordingUrl: null,
                recordingStatus: 'not_found',
                transcript: [],
                summary: "Recording and transcript not stored - consent not given",
                'recordingConsent.requested': consent?.requested || false,
                'recordingConsent.given': false,
                'recordingConsent.requestedAt': consent?.requestedAt || null,
                'recordingConsent.respondedAt': consent?.respondedAt || null,
                'recordingConsent.optOutReason': consent?.optOutReason || "Consent not given"
            };
            
            if (from) updateFields.from = from;
            if (to) updateFields.to = to;
            
            await CallRecord.findOneAndUpdate(
                { callSid: CallSid },
                { $set: updateFields },
                { upsert: true, new: true }
            );
            
            res.sendStatus(200);
            return;
        }
        
        // Consent given - process recording normally
        console.log(`✅ [${CallSid}] Recording consent given - storing recording URL`);
        
        // Build update object - only set recording-related fields
        // IMPORTANT: Don't overwrite transcript/summary - they may be saved by cleanup() later
        const updateFields = {
            recordingUrl: RecordingUrl,
            recordingStatus: 'available',
            afterCallTranscriptionPending: true,
            'recordingConsent.requested': consent?.requested || false,
            'recordingConsent.given': consent?.given !== false ? true : false,
            'recordingConsent.requestedAt': consent?.requestedAt || null,
            'recordingConsent.respondedAt': consent?.respondedAt || null,
            'recordingConsent.optOutReason': null
        };
        
        // Only set from/to if we have values (don't overwrite existing)
        if (from) updateFields.from = from;
        if (to) updateFields.to = to;

        await CallRecord.findOneAndUpdate(
            { callSid: CallSid },
            { $set: updateFields },
            { upsert: true, new: true }
        );

        res.sendStatus(200);
    } catch (err) {
        console.error("Recording status error:", err);
        res.sendStatus(500);
    }
};

// Proxy recording
export const proxyRecording = async (req, res) => {
    try {
        let rec = await CallRecord.findOne({ callSid: req.params.callSid });
        
        if (!rec) {
            return res.status(404).json({ error: "Recording not found" });
        }

        // Require explicit agreed consent before streaming recording
        if (rec.recordingConsent?.given !== true) {
            return res.status(403).json({
                error: 'Recording not available - recording consent not agreed',
                message: 'Recording is only available when the caller agreed to recording.'
            });
        }

        if (!rec.recordingUrl) {
            console.log(`🔍 [${req.params.callSid}] Recording URL missing but consent given - fetching from Twilio...`);
            
            try {
                const recordings = await twilioClient.recordings.list({
                    callSid: req.params.callSid,
                    limit: 1
                });

                if (recordings && recordings.length > 0) {
                    const recording = recordings[0];
                    let recordingUrl = recording.uri.replace('.json', '');
                    if (recordingUrl && recordingUrl.startsWith('/')) {
                        recordingUrl = 'https://api.twilio.com' + recordingUrl;
                    }
                    await CallRecord.findOneAndUpdate(
                        { callSid: req.params.callSid },
                        { $set: { recordingUrl } }
                    );
                    rec.recordingUrl = recordingUrl;
                    console.log(`✅ [${req.params.callSid}] Recording URL fetched from Twilio and saved`);
                } else {
                    return res.status(404).json({ 
                        error: 'Recording not available - may still be processing',
                        message: 'The recording is being processed by Twilio. Please try again in a few moments.'
                    });
                }
            } catch (fetchError) {
                console.error(`❌ [${req.params.callSid}] Error fetching recording from Twilio:`, fetchError.message);
                return res.status(404).json({ 
                    error: 'Recording not available',
                    message: 'Unable to fetch recording from Twilio. The recording may still be processing.'
                });
            }
        }

        if (!rec.recordingUrl) {
            return res.status(404).json({ 
                error: 'Recording not available',
                message: 'No recording URL found for this call.'
            });
        }

        let twilioUrl = rec.recordingUrl.endsWith('.mp3')
            ? rec.recordingUrl
            : `${rec.recordingUrl}.mp3`;
        if (typeof twilioUrl === 'string' && twilioUrl.startsWith('/')) {
            twilioUrl = 'https://api.twilio.com' + twilioUrl;
        }
        const response = await axios.get(twilioUrl, {
            auth: { 
                username: process.env.TWILIO_SID, 
                password: process.env.TWILIO_AUTH_TOKEN 
            },
            responseType: "stream",
            timeout: 30000,
            validateStatus: () => true // Don't throw on non-2xx status
        });

        // Preserve Twilio's content-type if available, otherwise default to audio/mpeg
        const contentType = response.headers['content-type'] || 'audio/mpeg';
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Disposition", `inline; filename="recording-${req.params.callSid}.mp3"`);
        res.setHeader("Accept-Ranges", "bytes"); // Enable range requests for seeking
        res.setHeader("Cache-Control", "public, max-age=3600");

        // Handle errors before piping
        response.data.on('error', (error) => {
            console.error(`❌ [${req.params.callSid}] Stream error:`, error.message);
            if (!res.headersSent) {
                res.status(500).json({ 
                    error: 'Error streaming recording',
                    message: error.message 
                });
            }
        });

        response.data.pipe(res);
    } catch (err) {
        console.error("recording proxy error:", err.message);
        if (err.response?.status === 404) {
            return res.status(404).json({ 
                error: 'Recording not found on Twilio',
                message: 'The recording could not be found on Twilio servers.'
            });
        }
        res.status(500).json({ 
            error: 'Error fetching recording',
            message: err.message
        });
    }
};

