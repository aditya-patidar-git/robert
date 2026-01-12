import axios from "axios";
import CallRecord from "../database/models/CallRecord.js";
import { conversations } from "../shared/state.js";
import twilioClient from "../utils/twilioClient.js";
import dotenv from "dotenv";

dotenv.config();

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
        if (existingRecord?.recordingConsent) {
            return {
                consent: existingRecord.recordingConsent,
                from: existingRecord.from,
                to: existingRecord.to,
                transcript: existingRecord.transcript || []
            };
        }
    } catch (err) {
        console.error(`❌ [${callSid}] Error fetching consent from CallRecord:`, err);
    }
    
    return null;
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
                    callSid: CallSid,
                    recordingUrl: null,
                    transcript: [],
                    summary: "Recording and transcript not stored - consent data unavailable",
                    recordingConsent: {
                        requested: false,
                        given: false,
                        requestedAt: null,
                        respondedAt: null,
                        optOutReason: "Consent data unavailable"
                    }
                },
                { upsert: true, new: true }
            );
            res.sendStatus(200);
            return;
        }
        
        const { consent, from, to, transcript } = consentData;
        const consentGiven = consent?.given === true;
        
        if (!consentGiven) {
            // Consent was denied or not given - do not store recording OR transcript
            console.log(`🚫 [${CallSid}] Recording consent not given - not storing recording URL or transcript`);
            
            // Update CallRecord with consent info, but without recording URL or transcript
            // This ensures GDPR compliance - no personal data stored without consent
            await CallRecord.findOneAndUpdate(
                { callSid: CallSid },
                {
                    callSid: CallSid,
                    recordingUrl: null, // Explicitly set to null
                    transcript: [], // Do not store transcript when consent not given
                    summary: "Recording and transcript not stored - consent not given",
                    from: from || null,
                    to: to || null,
                    recordingConsent: {
                        requested: consent?.requested || false,
                        given: consent?.given || false,
                        requestedAt: consent?.requestedAt || null,
                        respondedAt: consent?.respondedAt || null,
                        optOutReason: consent?.optOutReason || "Consent not given"
                    }
                },
                { upsert: true, new: true }
            );
            
            res.sendStatus(200);
            return;
        }
        
        // Consent given - process recording normally
        console.log(`✅ [${CallSid}] Recording consent given - storing recording URL`);
        
        // Generate a short summary
        let summary = "Summary not available";
        try {
            const transcriptArray = transcript || [];
            if (transcriptArray.length > 0) {
                const transcriptText = transcriptArray
                    .map(t => `${t.role === "agent" ? "Agent" : "User"}: ${t.text}`)
                    .join("\n");

                // Simple summary generation (can be enhanced with AI later)
                if (transcriptText.length > 0) {
                    summary = `Call transcript available with ${transcriptArray.length} exchanges.`;
                }
            }
        } catch (err) {
            console.error("Summary generation error:", err);
        }

        await CallRecord.findOneAndUpdate(
            { callSid: CallSid },
            {
                callSid: CallSid,
                recordingUrl: RecordingUrl,
                transcript: transcript || [],
                summary: summary,
                from: from || null,
                to: to || null,
                recordingConsent: {
                    requested: consent?.requested || false,
                    given: consent?.given || true,
                    requestedAt: consent?.requestedAt || null,
                    respondedAt: consent?.respondedAt || null,
                    optOutReason: null
                }
            },
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

        // If recordingUrl is missing but consent was given, try fetching from Twilio
        if (!rec.recordingUrl && rec.recordingConsent?.given === true) {
            console.log(`🔍 [${req.params.callSid}] Recording URL missing but consent given - fetching from Twilio...`);
            
            try {
                const recordings = await twilioClient.recordings.list({
                    callSid: req.params.callSid,
                    limit: 1
                });

                if (recordings && recordings.length > 0) {
                    const recording = recordings[0];
                    const recordingUrl = recording.uri.replace('.json', '');
                    
                    // Update database for future requests
                    await CallRecord.findOneAndUpdate(
                        { callSid: req.params.callSid },
                        { $set: { recordingUrl: recordingUrl } }
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

        // Check consent before serving recording
        if (rec.recordingConsent?.given === false) {
            return res.status(403).json({ 
                error: 'Recording not available - consent not given',
                message: 'Recording consent was not provided for this call.'
            });
        }

        if (!rec.recordingUrl) {
            return res.status(404).json({ 
                error: 'Recording not available',
                message: 'No recording URL found for this call.'
            });
        }

        const twilioUrl = rec.recordingUrl.endsWith('.mp3') 
            ? rec.recordingUrl 
            : `${rec.recordingUrl}.mp3`;
            
        const response = await axios.get(twilioUrl, {
            auth: { 
                username: process.env.TWILIO_SID, 
                password: process.env.TWILIO_AUTH_TOKEN 
            },
            responseType: "stream",
            timeout: 30000
        });

        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Content-Disposition", `inline; filename="recording-${req.params.callSid}.mp3"`);
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

