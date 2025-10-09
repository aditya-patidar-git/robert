import twilio from "twilio";
import axios from "axios";
import CallRecord from "../models/CallRecord.js";
import client from "../utils/twilioClient.js";
import { getAIResponse, executeToolCall } from "../utils/ai.js";
import observabilityService from "../services/observabilityService.js";
import multilingualService from "../services/multilingualService.js";
import gdprService from "../services/gdprService.js";
import { io } from "../server.js";

const conversations = {}; // in-memory storage
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

// ✅ AI Intro (first agent message)
export const aiIntro = async (req, res) => {
    const { CallSid } = req.body;
    if (!conversations[CallSid]) conversations[CallSid] = { transcript: [] };

    // Record call start
    observabilityService.incrementMetric('app.total_calls');
    observabilityService.incrementMetric('telephony.outbound_calls');
    
    // Record consent for GDPR
    await gdprService.recordConsent(CallSid, 'recording', true);
    await gdprService.recordConsent(CallSid, 'processing', true);

    // Generate AI greeting with multilingual support
    const language = multilingualService.getCurrentLanguage();
    const greeting = multilingualService.getGreetingMessage(language);
    
    const aiReply = await getAIResponse(
        `The user picked up the call. Start the conversation with: ${greeting}`
    );
    
    conversations[CallSid].transcript.push({ role: "agent", text: aiReply });
    conversations[CallSid].language = language;

    const twiml = new VoiceResponse();

    // Gather configuration for low-latency
    const gatherAttributes = {
        input: ["speech"],
        language: multilingualService.getLanguageConfig(language).code,
        bargeIn: true,                     // Stop AI speech if user starts talking
        speechTimeout: "auto",                // Short silence threshold
        timeout: 3,                        // Max wait for user response
        enhanced: true,                     // Better recognition accuracy
        hints: "website, app, pricing, feature, interested, follow-up",
        action: `${process.env.BASE_URL}/api/outbound/handle-response?callSid=${CallSid}`,
        method: "POST",
        profanityFilter: true,
    };

    const gather = twiml.gather(gatherAttributes);
    gather.say(aiReply); // Play AI greeting

    res.type("text/xml").send(twiml.toString());
};

// ✅ Handle user responses (AI-driven)
export const handleResponse = async (req, res) => {
    const { callSid } = req.query;
    const userAnswer = req.body.SpeechResult || "";

    if (!conversations[callSid]) conversations[callSid] = { transcript: [] };
    
    // Detect language from user input
    const detectedLanguage = multilingualService.detectLanguage(userAnswer);
    if (detectedLanguage !== conversations[callSid].language) {
        multilingualService.switchLanguage(detectedLanguage);
        conversations[callSid].language = detectedLanguage;
    }
    
    conversations[callSid].transcript.push({ role: "user", text: userAnswer });

    // Start performance trace
    const traceId = observabilityService.startTrace('ai_response', { callSid, userAnswer });

    try {
        // Generate AI reply with tool execution capability
        const conversationText = conversations[callSid].transcript
            .map(t => `${t.role === "agent" ? "AI" : "User"}: ${t.text}`)
            .join("\n");

        const callContext = {
            callSid,
            language: conversations[callSid].language,
            userAnswer
        };

        const aiResponse = await getAIResponse(conversationText, null, callContext);
        
        let aiReply = aiResponse.content;
        
        // Handle tool execution if required
        if (aiResponse.requires_tool_execution && aiResponse.tool_calls) {
            for (const toolCall of aiResponse.tool_calls) {
                const toolResult = await executeToolCall(toolCall, callContext);
                
                if (toolResult.success) {
                    // Add tool result to conversation context
                    aiReply += ` [Tool result: ${JSON.stringify(toolResult.result)}]`;
                } else {
                    aiReply += ` [Tool error: ${toolResult.error}]`;
                }
            }
        }
        
        conversations[callSid].transcript.push({ role: "agent", text: aiReply });
        
        // Record successful AI response
        observabilityService.incrementMetric('ai.successful_requests');
        observabilityService.endTrace(traceId, { success: true });
        
    } catch (error) {
        observabilityService.error('AI response error', { callSid, error: error.message });
        observabilityService.incrementMetric('ai.failed_requests');
        observabilityService.endTrace(traceId, { success: false, error: error.message });
        
        aiReply = "I'm sorry, I'm having trouble understanding. Could you please repeat that?";
        conversations[callSid].transcript.push({ role: "agent", text: aiReply });
    }

    const twiml = new VoiceResponse();

    // Check if conversation should end
    if (/\b(thank(s| you)|goodbye|bye|have a nice day)\b/i.test(aiReply)) {
        twiml.say(aiReply);
        twiml.hangup();
    } else {
        // Prepare next gather for user input
        const language = conversations[callSid].language || 'en';
        const gatherAttributes = {
            input: ["speech"],
            language: multilingualService.getLanguageConfig(language).code,
            bargeIn: true,
            speechTimeout: "auto",
            timeout: 3,
            enhanced: true,
            hints: "website, app, pricing, feature, interested, follow-up",
            action: `${process.env.BASE_URL}/api/outbound/handle-response?callSid=${callSid}`,
            method: "POST",
            profanityFilter: true,
        };

        const gather = twiml.gather(gatherAttributes);
        gather.say(aiReply);
        twiml.pause({ length: 0.2 }); // Short pause for natural feel
    }

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

                summary = await getAIResponse(
                    `Summarize the following sales call in 2-3 sentences. 
                    Clearly mention the outcome (e.g., user interested, not interested, wants follow-up, unsure). 
                    Keep it short and professional.

                    Transcript:
                    ${transcriptText}`
                );
            } catch (err) {
                console.error("Summary generation failed:", err.message);
            }

            // Mask PII in transcript for GDPR compliance
            const maskedTranscript = conversations[CallSid].transcript.map(entry => ({
                ...entry,
                text: gdprService.maskPII(entry.text, 'partial')
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
