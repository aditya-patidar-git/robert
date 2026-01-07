import client from "../utils/twilioClient.js";
import { conversations } from "../shared/state.js";
import configManager from "../agent/configManager.js";
import sipService from "../services/sipService.js";
import sipCallRouter from "../services/sip/sipCallRouter.js";
import abusePreventionService from "../services/abusePreventionService.js";
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { recordCallMetrics, incrementActiveCalls, decrementActiveCalls, recordSIPMetrics } from '../services/metricsService.js';
import dotenv from "dotenv";

dotenv.config();

const tracer = trace.getTracer('robert-agent-service', '1.0.0');

// Make outbound calls
export const makeCall = async (req, res) => {
    const { toNumbers } = req.body;
    if (!Array.isArray(toNumbers) || toNumbers.length === 0) {
        return res.status(400).json({ error: "Provide toNumbers array" });
    }

    try {
        const results = [];
        const telephonyConfig = configManager.getTelephonyConfig();
        
        // Use agent service domain for WebSocket URL
        const baseUrl = process.env.TUNNEL_DOMAIN ? `https://${process.env.TUNNEL_DOMAIN}` : process.env.BASE_URL || 'http://localhost:3002';
        
        for (const to of toNumbers) {
            console.log(`📞 Initiating call: to=${to}, from=${process.env.TWILIO_NUMBER}`);
            
            // Prepare Media Streams options (used as fallback or primary)
            const mediaStreamsOptions = {
                to,
                from: process.env.TWILIO_NUMBER,
                url: `${baseUrl}/api/outbound/ai-intro`,
                statusCallback: `${baseUrl}/api/outbound/call-status`,
                statusCallbackEvent: ["initiated", "ringing", "answered", "completed", "no-answer", "busy", "failed"],
                statusCallbackMethod: "POST",
                record: true, // Start recording - consent will be checked in recording handler
                recordingStatusCallback: `${baseUrl}/api/outbound/recording-status`,
                recordingStatusCallbackMethod: "POST",
            };

            // Route call (SIP with fallback to Media Streams)
            const { call, method } = await sipCallRouter.routeCall(
                client,
                to,
                process.env.TWILIO_NUMBER,
                telephonyConfig,
                mediaStreamsOptions
            );

            if (!call) {
                console.error(`❌ Failed to create call to ${to}`);
                results.push({ callSid: null, to, method: 'failed', error: 'Call creation failed' });
                continue;
            }

            console.log(`✅ Call created: SID=${call.sid}, Status=${call.status}, To=${call.to}, Method=${method}`);
            
            // Initialize conversation state
            const sessionManagementService = (await import('../services/sessionManagementService.js')).default;
            if (!conversations[call.sid]) {
                sessionManagementService.initializeSession(call.sid, {
                    transcript: [],
                    callType: method,
                    from: process.env.TWILIO_NUMBER,
                    to: to
                });
            }

            // Track SIP status if using SIP
            if (method === 'SIP') {
                sipService.trackStatus(call.sid, 'initiated');
                sipService.createSession(call.sid, {
                    from: process.env.TWILIO_NUMBER,
                    to: to,
                    callType: 'SIP'
                });
                recordSIPMetrics({ event: 'call_started' });
            }

            // Record call metrics
            recordCallMetrics({
                status: call.status,
                entryPath: method,
                duration: undefined
            });
            incrementActiveCalls({ entry_path: method });

            results.push({ callSid: call.sid, to, method });
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
            language: 'en-GB',
            realtimeWs: null 
        };
    }

    const twiml = new VoiceResponse();

    // Start Media Stream FIRST (before any Say commands)
    // Determine WebSocket URL - use agent service domain
    const baseUrl = process.env.TUNNEL_DOMAIN ? `https://${process.env.TUNNEL_DOMAIN}` : process.env.BASE_URL || 'http://localhost:3002';
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

// Inbound call handler - SIP primary with Media Streams fallback
export const handleIncomingCall = async (req, res) => {
    const { CallSid, From, To } = req.body;
    
    // Create span for this call
    const span = tracer.startSpan('handleIncomingCall', {
        attributes: {
            'call.sid': CallSid,
            'call.from': From,
            'call.to': To,
            'call.direction': 'inbound'
        }
    });

    try {
        // Check rate limiting and abuse prevention
        const rateLimitCheck = await abusePreventionService.checkRateLimit(From);
        if (!rateLimitCheck.allowed) {
            span.setAttribute('call.blocked', true);
            span.setAttribute('call.block_reason', rateLimitCheck.reason);
            span.setStatus({ code: SpanStatusCode.ERROR, message: `Call blocked: ${rateLimitCheck.reason}` });
            console.log(`🚫 [${CallSid}] Call blocked: ${rateLimitCheck.reason}`);
            const twilio = await import("twilio");
            const VoiceResponse = twilio.twiml.VoiceResponse;
            const twiml = new VoiceResponse();
            twiml.say(`Sorry, your call cannot be completed at this time. ${rateLimitCheck.reason}. Please try again later.`);
            twiml.hangup();
            span.end();
            return res.type("text/xml").send(twiml.toString());
        }

        // Check if caller is blocked
        if (abusePreventionService.isBlocked(From)) {
            span.setAttribute('call.blocked', true);
            span.setAttribute('call.block_reason', 'caller_blocked');
            span.setStatus({ code: SpanStatusCode.ERROR, message: 'Caller is on block list' });
            console.log(`🚫 [${CallSid}] Call blocked: Caller is on block list`);
            const twilio = await import("twilio");
            const VoiceResponse = twilio.twiml.VoiceResponse;
            const twiml = new VoiceResponse();
            twiml.say('Sorry, your call cannot be completed at this time. Please contact us through other channels.');
            twiml.hangup();
            span.end();
            return res.type("text/xml").send(twiml.toString());
        }

        // Record call for monitoring
        abusePreventionService.recordCall(From, CallSid, {
            direction: 'inbound',
            timestamp: new Date()
        });
        
        // Initialize conversation state using session management service
        const sessionManagementService = (await import('../services/sessionManagementService.js')).default;
        
        // Check if SIP should be used (primary path)
        const telephonyConfig = configManager.getTelephonyConfig();
        const shouldUseSip = sipCallRouter.shouldUseSip(telephonyConfig) && sipService.isSipEnabled();
        
        let entryPath = 'Streams';
        let callType = 'Twilio';
        
        span.setAttribute('call.entry_path', shouldUseSip ? 'SIP' : 'Media Streams');
        
        if (shouldUseSip) {
            // For SIP, OpenAI will handle the call directly via SIP endpoint
            // We'll receive call.accept webhook from OpenAI
            // For now, we still need to return TwiML, but SIP routing happens at Twilio level
            // If SIP is configured in Twilio console to route to OpenAI, this webhook may not be called
            // But if it is called, we should still initialize the session
            entryPath = 'SIP';
            callType = 'SIP';
            
            // Create SIP session
            sipService.createSession(CallSid, {
                from: From,
                to: To,
                callType: 'SIP'
            });
            sipService.trackStatus(CallSid, 'initiated', { from: From, to: To });
            
            // Record SIP metrics
            recordSIPMetrics({ event: 'call_started' });
            
            console.log(`📞 [${CallSid}] Inbound call will be routed via SIP`);
            
            // For SIP, we might return a simple response or redirect
            // The actual SIP routing is configured in Twilio console
            // If SIP fails, Twilio will fallback to this webhook
            // So we still need Media Streams as fallback
        }
        
        if (!conversations[CallSid]) {
            sessionManagementService.initializeSession(CallSid, {
                from: From,
                to: To,
                language: 'en-GB',
                callType: callType,
                entryPath: entryPath,
                realtimeWs: null
            });
            
            // Record call metrics
            recordCallMetrics({
                status: 'ringing',
                entryPath: entryPath,
                duration: undefined
            });
            incrementActiveCalls({ entry_path: entryPath });
        }

        // If SIP is enabled but we're here, it might mean SIP routing failed or wasn't configured in Twilio
        // Fallback to Media Streams
        const twilio = await import("twilio");
        const VoiceResponse = twilio.twiml.VoiceResponse;
        const twiml = new VoiceResponse();

        // Start Media Stream (used as fallback or if SIP not configured)
        // Determine WebSocket URL - use agent service domain
        const baseUrl = process.env.TUNNEL_DOMAIN ? `https://${process.env.TUNNEL_DOMAIN}` : process.env.BASE_URL || 'http://localhost:3002';
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

        if (shouldUseSip) {
            span.addEvent('sip_fallback_to_media_streams', {
                reason: 'SIP enabled but using Media Streams fallback'
            });
            console.log(`⚠️ [${CallSid}] SIP enabled but using Media Streams fallback - check Twilio SIP trunk configuration`);
        }

        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        res.type("text/xml").send(twiml.toString());
    } catch (error) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        span.end();
        console.error(`❌ [${CallSid}] Error in handleIncomingCall:`, error);
        res.status(500).type("text/xml").send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred. Please try again later.</Say><Hangup/></Response>');
    }
};

// Get all calls
export const getAllCalls = async (req, res) => {
    const CallRecord = (await import("../database/models/CallRecord.js")).default;
    const records = await CallRecord.find().sort({ createdAt: -1 });
    res.json(records);
};

