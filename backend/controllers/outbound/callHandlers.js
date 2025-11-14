import client from "../../utils/twilioClient.js";
import { conversations } from "./sharedState.js";

// ✅ Make outbound calls
export const makeCall = async (req, res) => {
    const { toNumbers } = req.body;
    if (!Array.isArray(toNumbers) || toNumbers.length === 0)
        return res.status(400).json({ error: "Provide toNumbers array" });

    try {
        const results = [];
        for (const to of toNumbers) {
            console.log(`📞 Initiating call: to=${to}, from=${process.env.TWILIO_NUMBER}`);
            
            const call = await client.calls.create({
                to,
                from: process.env.TWILIO_NUMBER,
                url: `${process.env.BASE_URL}/api/outbound/ai-intro`,
                statusCallback: `${process.env.BASE_URL}/api/outbound/call-status`,
                statusCallbackEvent: ["initiated", "ringing", "answered", "completed", "no-answer", "busy", "failed"],
                statusCallbackMethod: "POST",
                record: true,
                recordingStatusCallback: `${process.env.BASE_URL}/api/outbound/recording-status`,
                recordingStatusCallbackMethod: "POST",
            });

            console.log(`✅ Call created: SID=${call.sid}, Status=${call.status}, To=${call.to}`);
            conversations[call.sid] = { transcript: [] };
            results.push({ callSid: call.sid, to });
        }

        return res.json({ success: true, calls: results });
    } catch (err) {
        console.error("❌ make-call error:", err);
        return res.status(500).json({ error: err.message });
    }
};

// ✅ AI Intro (first agent message) - Updated for Media Streams
export const aiIntro = async (req, res) => {
    const { CallSid } = req.body;
    const twilio = await import("twilio");
    const VoiceResponse = twilio.twiml.VoiceResponse;
    
    if (!conversations[CallSid]) {
        conversations[CallSid] = { 
            transcript: [], 
            language: 'en-US',
            realtimeWs: null 
        };
    }

    // Record call start
    const observabilityService = (await import("../../services/observabilityService.js")).default;
    observabilityService.incrementMetric('app.total_calls');
    observabilityService.incrementMetric('telephony.outbound_calls');
    
    // Record consent for GDPR
    const gdprService = (await import("../../services/gdprService.js")).default;
    await gdprService.recordConsent(CallSid, 'recording', true);
    await gdprService.recordConsent(CallSid, 'processing', true);

    const twiml = new VoiceResponse();

    // Start Media Stream FIRST (before any Say commands)
    // Determine WebSocket URL - use wss:// for production, ws:// for local
    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const wsUrl = `${wsProtocol}://${wsHost}/api/outbound/media-stream?callSid=${CallSid}`;
    
    const start = twiml.start();
    const stream = start.stream({
        url: wsUrl,
        track: 'both_tracks'
    });
    
    // CRITICAL: Add a long pause to keep call alive while Media Stream takes over
    // The Media Stream will handle all audio from here, so OpenAI will provide the greeting
    twiml.pause({ length: 3600 }); // 1 hour pause (call will be handled by Media Stream)

    res.type("text/xml").send(twiml.toString());
};

// ✅ Get all calls
export const getAllCalls = async (req, res) => {
    const CallRecord = (await import("../../models/CallRecord.js")).default;
    const records = await CallRecord.find().sort({ createdAt: -1 });
    res.json(records);
};

