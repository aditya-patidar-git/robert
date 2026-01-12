import client from "../utils/twilioClient.js";
import { conversations } from "../shared/state.js";
import configManager from "../agent/configManager.js";
import sipService from "../services/sipService.js";
import sipCallRouter from "../services/sip/sipCallRouter.js";
import abusePreventionService from "../services/abusePreventionService.js";
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { recordCallMetrics, incrementActiveCalls, decrementActiveCalls, recordSIPMetrics } from '../services/metricsService.js';
import { 
    generateSipRoutingTwiML, 
    generateMediaStreamsTwiML, 
    generateBlockedCallTwiML, 
    generateErrorTwiML,
    buildMediaStreamsWsUrl
} from '../utils/twimlGenerator.js';
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
    
    if (!conversations[CallSid]) {
        conversations[CallSid] = { 
            transcript: [], 
            language: 'en-GB',
            realtimeWs: null 
        };
    }

    // Generate Media Streams TwiML using reusable utility
    const wsUrl = buildMediaStreamsWsUrl(CallSid);
    const twiml = generateMediaStreamsTwiML(wsUrl);

    res.type("text/xml").send(twiml);
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
            const twiml = generateBlockedCallTwiML(`Sorry, your call cannot be completed at this time. ${rateLimitCheck.reason}. Please try again later.`);
            span.end();
            return res.type("text/xml").send(twiml);
        }

        // Check if caller is blocked
        if (abusePreventionService.isBlocked(From)) {
            span.setAttribute('call.blocked', true);
            span.setAttribute('call.block_reason', 'caller_blocked');
            span.setStatus({ code: SpanStatusCode.ERROR, message: 'Caller is on block list' });
            console.log(`🚫 [${CallSid}] Call blocked: Caller is on block list`);
            const twiml = generateBlockedCallTwiML('Sorry, your call cannot be completed at this time. Please contact us through other channels.');
            span.end();
            return res.type("text/xml").send(twiml);
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
        
        let entryPath = 'Media Streams';
        let callType = 'Twilio';
        
        span.setAttribute('call.entry_path', shouldUseSip ? 'SIP' : 'Media Streams');
        
        // Try SIP routing first if enabled
        if (shouldUseSip) {
            const sipEndpoint = sipService.getSipEndpoint();
            
            if (sipEndpoint) {
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
                
                // Initialize session for SIP call
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
                
                console.log(`📞 [${CallSid}] Inbound call routed via SIP to: ${sipEndpoint}`);
                
                // Return TwiML with SIP routing
                const twiml = generateSipRoutingTwiML(sipEndpoint);
                span.setStatus({ code: SpanStatusCode.OK });
                span.end();
                return res.type("text/xml").send(twiml);
            } else {
                console.warn(`⚠️ [${CallSid}] SIP enabled but endpoint not configured - falling back to Media Streams`);
                span.addEvent('sip_fallback_to_media_streams', {
                    reason: 'SIP endpoint not configured'
                });
            }
        }
        
        // Fallback to Media Streams (if SIP not enabled or failed)
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

        // Generate Media Streams TwiML
        const wsUrl = buildMediaStreamsWsUrl(CallSid);
        const twiml = generateMediaStreamsTwiML(wsUrl);

        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        res.type("text/xml").send(twiml);
    } catch (error) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        span.end();
        console.error(`❌ [${CallSid}] Error in handleIncomingCall:`, error);
        const errorTwiml = generateErrorTwiML('An error occurred. Please try again later.');
        res.status(500).type("text/xml").send(errorTwiml);
    }
};

// Get all calls
export const getAllCalls = async (req, res) => {
    const CallRecord = (await import("../database/models/CallRecord.js")).default;
    const records = await CallRecord.find().sort({ createdAt: -1 });
    res.json(records);
};

