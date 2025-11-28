import client from "../utils/twilioClient.js";
import { conversations } from "../shared/state.js";
import dotenv from "dotenv";

dotenv.config();

// Make outbound calls
export const makeCall = async (req, res) => {
    const { toNumbers } = req.body;
    if (!Array.isArray(toNumbers) || toNumbers.length === 0) {
        return res.status(400).json({ error: "Provide toNumbers array" });
    }

    try {
        const results = [];
        for (const to of toNumbers) {
            console.log(`📞 Initiating call: to=${to}, from=${process.env.TWILIO_NUMBER}`);
            
            // Use agent service domain for WebSocket URL
            const baseUrl = process.env.DOMAIN ? `https://${process.env.DOMAIN}` : process.env.BASE_URL || 'http://localhost:3002';
            const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
            const wsHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
            
            const call = await client.calls.create({
                to,
                from: process.env.TWILIO_NUMBER,
                url: `${baseUrl}/api/outbound/ai-intro`,
                statusCallback: `${baseUrl}/api/outbound/call-status`,
                statusCallbackEvent: ["initiated", "ringing", "answered", "completed", "no-answer", "busy", "failed"],
                statusCallbackMethod: "POST",
                record: true,
                recordingStatusCallback: `${baseUrl}/api/outbound/recording-status`,
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

// AI Intro (first agent message) - Updated for Media Streams
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

    const twiml = new VoiceResponse();

    // Start Media Stream FIRST (before any Say commands)
    // Determine WebSocket URL - use agent service domain
    const baseUrl = process.env.DOMAIN ? `https://${process.env.DOMAIN}` : process.env.BASE_URL || 'http://localhost:3002';
    const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const wsUrl = `${wsProtocol}://${wsHost}/media-stream?callSid=${CallSid}`;
    
    const start = twiml.start();
    const stream = start.stream({
        url: wsUrl,
        track: 'both_tracks'
    });
    
    // Add a long pause to keep call alive while Media Stream takes over
    twiml.pause({ length: 3600 }); // 1 hour pause

    res.type("text/xml").send(twiml.toString());
};

// Inbound call handler - Updated for Media Streams
export const handleIncomingCall = async (req, res) => {
    const { CallSid, From, To } = req.body;
    
    if (!conversations[CallSid]) {
        conversations[CallSid] = { 
            transcript: [], 
            from: From, 
            to: To,
            startTime: Date.now(),
            language: 'en-US',
            realtimeWs: null 
        };
    }

    const twilio = await import("twilio");
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    // Start Media Stream FIRST (before any Say commands)
    // Determine WebSocket URL - use agent service domain
    const baseUrl = process.env.DOMAIN ? `https://${process.env.DOMAIN}` : process.env.BASE_URL || 'http://localhost:3002';
    const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const wsUrl = `${wsProtocol}://${wsHost}/media-stream?callSid=${CallSid}`;
    
    const start = twiml.start();
    const stream = start.stream({
        url: wsUrl,
        track: 'both_tracks'
    });
    
    // Add a long pause to keep call alive while Media Stream takes over
    twiml.pause({ length: 3600 }); // 1 hour pause

    res.type("text/xml").send(twiml.toString());
};

// Get all calls
export const getAllCalls = async (req, res) => {
    const CallRecord = (await import("../database/models/CallRecord.js")).default;
    const records = await CallRecord.find().sort({ createdAt: -1 });
    res.json(records);
};

