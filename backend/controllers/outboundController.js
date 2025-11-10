import twilio from "twilio";
import axios from "axios";
import CallRecord from "../models/CallRecord.js";
import client from "../utils/twilioClient.js";
import { getAIResponse, executeToolCall } from "../utils/ai.js";
import observabilityService from "../services/observabilityService.js";
import multilingualService from "../services/multilingualService.js";
import gdprService from "../services/gdprService.js";
import { io } from "../server.js";
import { WebSocketServer, WebSocket } from "ws";

const conversations = {}; // in-memory storage
const realtimeClients = {}; // Store active Realtime API connections
const VoiceResponse = twilio.twiml.VoiceResponse;

// ✅ Make outbound calls
export const makeCall = async (req, res) => {
    const { toNumbers } = req.body;
    if (!Array.isArray(toNumbers) || toNumbers.length === 0)
        return res.status(400).json({ error: "Provide toNumbers array" });

    try {
        const results = [];
        for (const to of toNumbers) {
            const call = await client.calls.create({
                to,
                from: process.env.TWILIO_NUMBER,
                url: `${process.env.BASE_URL}/api/outbound/ai-intro`,
                statusCallback: `${process.env.BASE_URL}/api/outbound/call-status`,
                statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
                statusCallbackMethod: "POST",
                record: true,
                recordingStatusCallback: `${process.env.BASE_URL}/api/outbound/recording-status`,
                recordingStatusCallbackMethod: "POST",
            });

            conversations[call.sid] = { transcript: [] }; // array now
            results.push({ callSid: call.sid, to });
        }

        return res.json({ success: true, calls: results });
    } catch (err) {
        console.error("make-call error:", err);
        return res.status(500).json({ error: err.message });
    }
};

// ✅ AI Intro (first agent message) - Updated for Media Streams
export const aiIntro = async (req, res) => {
    const { CallSid } = req.body;
    
    if (!conversations[CallSid]) {
        conversations[CallSid] = { 
            transcript: [], 
            language: 'en-US',
            realtimeWs: null 
        };
    }

    // Record call start
    observabilityService.incrementMetric('app.total_calls');
    observabilityService.incrementMetric('telephony.outbound_calls');
    
    // Record consent for GDPR
    await gdprService.recordConsent(CallSid, 'recording', true);
    await gdprService.recordConsent(CallSid, 'processing', true);

    const twiml = new VoiceResponse();

    // Start Media Stream
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

    // Optional: Say intro while connecting
    twiml.say({ voice: 'Polly.Joanna' }, "Hello! Connecting you to our AI assistant...");

    res.type("text/xml").send(twiml.toString());
};

// ✅ Media Stream WebSocket Handler for Realtime API
export const mediaStream = async (req, res) => {
    const { callSid } = req.query;
    
    if (!callSid) {
        return res.status(400).send('Missing callSid parameter');
    }

    // Check if this is a WebSocket upgrade request
    const upgrade = req.headers.upgrade;
    if (upgrade !== 'websocket') {
        return res.status(400).send('Expected WebSocket upgrade');
    }

    // The WebSocket upgrade will be handled by the server.js upgrade handler
    // This endpoint just validates the request
    res.status(101).end();
};

// ✅ Handle WebSocket connection for Media Streams
export const handleMediaStreamConnection = (ws, req) => {
    const { callSid } = req.query || {};
    const streamSid = req.query.streamSid || '';

    if (!callSid) {
        console.error('❌ Missing callSid in WebSocket connection');
        ws.close();
        return;
    }

    console.log(`🔌 Media Stream WebSocket connected for call: ${callSid}`);

    let openaiWs = null;

    try {
        // Connect to OpenAI Realtime API via WebSocket
        const openaiUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
        const authHeader = Buffer.from(`${process.env.OPENAI_API_KEY}:`).toString('base64');
        
        openaiWs = new WebSocket(openaiUrl, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'OpenAI-Beta': 'realtime=v1'
            }
        });

        // Store connections
        realtimeClients[callSid] = { 
            twilioWs: ws, 
            openaiWs,
            streamSid 
        };

        if (!conversations[callSid]) {
            conversations[callSid] = { 
                transcript: [], 
                language: 'en-US',
                realtimeWs: ws 
            };
        }

        // Track if OpenAI connection is ready
        let openaiReady = false;
        let streamStarted = false;

        // Helper function to initialize OpenAI response
        const initializeOpenAIResponse = () => {
            if (openaiWs && openaiReady) {
                openaiWs.send(JSON.stringify({
                    type: 'response.create',
                    response: {
                        modalities: ['text', 'audio'],
                        instructions: `You are "Robert", Universal Motorcycle Training's AI phone agent. 
                        Speak in clear, calm, polite British English. 
                        Greet the caller warmly and ask how you can help them today.
                        Keep responses concise and natural.`,
                        voice: 'alloy',
                        temperature: 0.4
                    }
                }));
            }
        };

        // === Forward Twilio Audio → OpenAI ===
        ws.on('message', async (data) => {
            try {
                const json = JSON.parse(data.toString());
                
                // Capture streamSid from start event
                if (json.event === 'start' && json.start?.streamSid) {
                    realtimeClients[callSid].streamSid = json.start.streamSid;
                }
                
                // Handle media payload
                if (json.event === 'media' && json.media?.payload) {
                    const audioBase64 = json.media.payload;
                    
                    // Send audio to OpenAI Realtime API
                    if (openaiWs && openaiReady) {
                        openaiWs.send(JSON.stringify({
                            type: 'input_audio_buffer.append',
                            audio: audioBase64
                        }));
                    }
                }

                // Handle stream start
                if (json.event === 'start') {
                    console.log(`🎬 Twilio stream started for call: ${callSid}`);
                    streamStarted = true;
                    
                    // Initialize OpenAI Realtime response once connection is ready
                    if (openaiReady) {
                        initializeOpenAIResponse();
                    }
                }

                // Handle stream stop
                if (json.event === 'stop') {
                    console.log(`🛑 Twilio stream stopped for call: ${callSid}`);
                    if (openaiWs && openaiReady) {
                        openaiWs.send(JSON.stringify({ type: 'response.cancel' }));
                    }
                }

            } catch (err) {
                console.error('❌ Error processing Twilio message:', err);
            }
        });

        // === Forward OpenAI Audio → Twilio ===
        openaiWs.on('message', async (data) => {
            try {
                const event = JSON.parse(data.toString());
                
                // Handle audio deltas
                if (event.type === 'response.audio.delta' && event.delta) {
                    const audioBase64 = event.delta;
                    
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            event: 'media',
                            streamSid: streamSid,
                            media: { 
                                payload: audioBase64 
                            }
                        }));
                    }
                }

                // Handle response done
                if (event.type === 'response.done') {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            event: 'mark',
                            streamSid: streamSid,
                            mark: { name: 'end-of-response' }
                        }));
                    }
                }

                // Capture transcript events
                if (event.type === 'conversation.item.created') {
                    const item = event.item;
                    if (item.role === 'assistant' || item.role === 'user') {
                        const textContent = item.content?.find(c => c.type === 'text')?.text || '';
                        if (textContent && conversations[callSid]) {
                            conversations[callSid].transcript.push({
                                role: item.role === 'assistant' ? 'agent' : 'user',
                                text: textContent
                            });
                        }
                    }
                }

            } catch (err) {
                console.error('❌ Error processing OpenAI event:', err);
            }
        });

        // Handle OpenAI WebSocket open
        openaiWs.on('open', () => {
            console.log(`✅ OpenAI Realtime API connected for call: ${callSid}`);
            openaiReady = true;
            
            // If stream already started, initialize response now
            if (streamStarted) {
                initializeOpenAIResponse();
            }
        });

        // Handle errors
        openaiWs.on('error', (error) => {
            console.error('❌ OpenAI Realtime API error:', error);
        });

        ws.on('error', (error) => {
            console.error('❌ Twilio WebSocket error:', error);
        });

        // Cleanup on close
        ws.on('close', () => {
            console.log(`🔌 Media Stream WebSocket closed for call: ${callSid}`);
            if (openaiWs) {
                openaiWs.close();
            }
            delete realtimeClients[callSid];
        });

        openaiWs.on('close', () => {
            console.log(`🔌 OpenAI Realtime WebSocket closed for call: ${callSid}`);
        });

    } catch (err) {
        console.error('❌ Failed to setup OpenAI Realtime connection:', err);
        ws.close();
        if (openaiWs) {
            openaiWs.close();
        }
        delete realtimeClients[callSid];
    }
};

// ✅ Handle user responses (AI-driven)
// ✅ Handle user responses (AI-driven)
// ✅ Handle user responses (AI-driven) - SIMPLIFIED VERSION
export const handleResponse = async (req, res) => {
    const { callSid } = req.query;
    const userAnswer = req.body.SpeechResult || "";

    console.log(`🔍 User said: "${userAnswer}"`);

    if (!conversations[callSid]) conversations[callSid] = { transcript: [] };
    
    // Add user response to transcript
    conversations[callSid].transcript.push({ role: "user", text: userAnswer });

    // Simple AI response (no complex processing)
    let aiReply = "Thank you for your message. How can I help you further?";

    try {
        // Generate AI reply
        const conversationText = conversations[callSid].transcript
            .map(t => `${t.role === "agent" ? "AI" : "User"}: ${t.text}`)
            .join("\n");

        const aiResponse = await getAIResponse(conversationText, null, { callSid });
        aiReply = aiResponse.content || "I understand. How else can I help?";
        
        // Add AI response to transcript
        conversations[callSid].transcript.push({ role: "agent", text: aiReply });
        
        console.log(`🤖 AI replied: "${aiReply}"`);
        
    } catch (error) {
        console.error("AI response error:", error);
        aiReply = "I'm sorry, I didn't catch that. Could you please repeat?";
        conversations[callSid].transcript.push({ role: "agent", text: aiReply });
    }

    // Generate TwiML response
    const twiml = new VoiceResponse();

    // Check if conversation should end
    if (/\b(thank(s| you)|goodbye|bye|have a nice day)\b/i.test(aiReply)) {
        twiml.say(aiReply);
        twiml.hangup();
    } else {
        // Continue conversation
        const language = conversations[callSid].language || 'en';
        const gatherAttributes = {
            input: ["speech"],
            language: multilingualService.getLanguageConfig(language).code,
            bargeIn: true,
            speechTimeout: "auto",
            timeout: 5, // Increased timeout
            enhanced: true,
            hints: "website, app, pricing, feature, interested, follow-up",
            action: `${process.env.BASE_URL}/api/outbound/handle-response?callSid=${callSid}`,
            method: "POST",
            profanityFilter: true,
        };

        const gather = twiml.gather(gatherAttributes);
        gather.say(aiReply);
    }

    console.log(`📞 Sending TwiML: ${twiml.toString()}`);
    res.type("text/xml").send(twiml.toString());
};
// ✅ Call status with live updates
export const callStatus = async (req, res) => {
    const { CallSid, CallStatus, From, To } = req.body;
    console.log(`Call Status for ${CallSid}: ${CallStatus}`);

    if (!conversations[CallSid]) conversations[CallSid] = { transcript: [] };
    conversations[CallSid].from = From;
    conversations[CallSid].to = To;

    io.emit("call-status", { callSid: CallSid, status: CallStatus });

    if (CallStatus === "completed") {
        const records = await CallRecord.find().sort({ createdAt: -1 });
        io.emit("all-calls", records);
    }

    // If the call is completed/failed/busy, cleanup memory
    if (["failed", "busy", "no-answer"].includes(CallStatus)) {
        if (conversations[CallSid]) {
            delete conversations[CallSid];
        }
    }

    res.sendStatus(200);
};


// ✅ Recording
export const recordingStatus = async (req, res) => {
    const { RecordingUrl, CallSid } = req.body;
    try {
        if (conversations[CallSid]) {
            // Generate a short summary using AI
            let summary = "Summary not available";
            try {
                const transcriptText = conversations[CallSid].transcript
                    .map(t => `${t.role === "agent" ? "Agent" : "User"}: ${t.text}`)
                    .join("\n");

                    const summaryResponse = await getAIResponse(
                        `Summarize the following sales call in 2-3 sentences. 
                        Clearly mention the outcome (e.g., user interested, not interested, wants follow-up, unsure). 
                        Keep it short and professional.
                    
                        Transcript:
                        ${transcriptText}`
                    );
                    summary = summaryResponse.content;
            } catch (err) {
                console.error("Summary generation failed:", err.message);
            }

            // Mask PII in transcript for GDPR compliance
            const maskedTranscript = conversations[CallSid].transcript.map(entry => ({
                ...entry,
                text: gdprService.maskPII(entry.text || '', 'partial')
            }));

            const rec = new CallRecord({
                callSid: CallSid,
                from: conversations[CallSid].from || "Unknown",
                to: conversations[CallSid].to || "Unknown",
                transcript: maskedTranscript,
                recordingUrl: RecordingUrl,
                summary,
                language: conversations[CallSid].language || 'en',
                piiDetected: gdprService.detectPII(conversations[CallSid].transcript.map(t => t.text).join(' ')),
                gdprCompliant: true
            });
            await rec.save();
            
            // Log GDPR compliance
            await gdprService.logAuditEvent('call_recorded', {
                callSid: CallSid,
                recordingUrl: RecordingUrl,
                piiDetected: rec.piiDetected,
                language: rec.language
            });
            
            delete conversations[CallSid];

            const records = await CallRecord.find().sort({ createdAt: -1 });
            io.emit("all-calls", records);
        }
        res.sendStatus(200);
    } catch (err) {
        console.error("recording-status error:", err);
        res.sendStatus(500);
    }
};

// ✅ Get all calls
export const getAllCalls = async (req, res) => {
    const records = await CallRecord.find().sort({ createdAt: -1 });
    res.json(records);
};

// ✅ Proxy recording
export const proxyRecording = async (req, res) => {
    try {
        const rec = await CallRecord.findOne({ callSid: req.params.callSid });
        if (!rec || !rec.recordingUrl) return res.status(404).send("Recording not found");

        const twilioUrl = rec.recordingUrl + ".mp3";
        const response = await axios.get(twilioUrl, {
            auth: { username: process.env.TWILIO_SID, password: process.env.TWILIO_AUTH_TOKEN },
            responseType: "stream",
        });

        res.setHeader("Content-Type", "audio/mpeg");
        response.data.pipe(res);
    } catch (err) {
        console.error("recording proxy error:", err.message);
        res.status(500).send("Error fetching recording");
    }
};
