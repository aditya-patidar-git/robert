import twilio from "twilio";
import CallRecord from "../models/CallRecord.js";
import { getAIResponse } from "../utils/ai.js";
import { io } from "../server.js";

const inboundConversations = {}; // in-memory storage
const VoiceResponse = twilio.twiml.VoiceResponse;

// ✅ Entry point for inbound calls
export const handleIncomingCall = async (req, res) => {
    const { CallSid, From, To } = req.body;
    if (!inboundConversations[CallSid]) {
        inboundConversations[CallSid] = { 
            transcript: [], 
            from: From, 
            to: To, 
            startTime: Date.now() 
        };
    }

    // Initial AI greeting
    const aiReply = await getAIResponse(
        "The user has called in. Start with a polite greeting and ask how you can help."
    );
    inboundConversations[CallSid].transcript.push({ role: "agent", text: aiReply });

    const twiml = new VoiceResponse();

    // ✅ Low-latency gather for user input
    const gatherAttributes = {
        input: ["speech"],
        language: "en-US",
        bargeIn: true,           // Stop AI if user speaks
        speechTimeout: "auto",   // Detect end of user speech
        timeout: 2,         // Max wait for user response
        enhanced: true,          // Better recognition accuracy
        hints: "support, sales, pricing, feature, interested, follow-up, issue, complaint",
        action: `${process.env.BASE_URL}/api/inbound/handle-response?callSid=${CallSid}`,
        method: "POST",
        profanityFilter: true,
    };

    const gather = twiml.gather(gatherAttributes);
    gather.say(aiReply);

    res.type("text/xml").send(twiml.toString());
};

// ✅ Handle user responses
export const handleResponse = async (req, res) => {
    const { callSid } = req.query;
    const userAnswer = req.body.SpeechResult || "";

    if (!inboundConversations[callSid]) inboundConversations[callSid] = { transcript: [] };
    inboundConversations[callSid].transcript.push({ role: "user", text: userAnswer });

    // Generate AI reply based on full conversation
    const conversationText = inboundConversations[callSid].transcript
        .map(t => `${t.role === "agent" ? "AI" : "User"}: ${t.text}`)
        .join("\n");

    const aiReply = await getAIResponse(conversationText);
    inboundConversations[callSid].transcript.push({ role: "agent", text: aiReply });

    const twiml = new VoiceResponse();

    // End call if AI says goodbye
    if (/thank you|goodbye|have a nice day/i.test(aiReply)) {
        twiml.say(aiReply);
        twiml.hangup();
    } else {
        // Prepare next gather
        const gatherAttributes = {
            input: ["speech"],
            language: "en-US",
            bargeIn: true,
            speechTimeout: "auto",
            timeout: 2,
            enhanced: true,
            hints: "support, sales, pricing, feature, interested, follow-up, issue, complaint",
            action: `${process.env.BASE_URL}/api/inbound/handle-response?callSid=${callSid}`,
            method: "POST",
            profanityFilter: true,
        };
        const gather = twiml.gather(gatherAttributes);
        gather.say(aiReply);
        twiml.pause({ length: 0.2 }); // Short pause for natural feel
    }

    res.type("text/xml").send(twiml.toString());
};

// ✅ Call status updates (live feed + memory cleanup)
export const handleCallStatus = async (req, res) => {
    const { CallSid, CallStatus, From, To } = req.body;

    if (!inboundConversations[CallSid]) inboundConversations[CallSid] = { transcript: [] };
    inboundConversations[CallSid].from = From;
    inboundConversations[CallSid].to = To;

    io.emit("call-status", { callSid: CallSid, status: CallStatus });

    if (CallStatus === "completed") {
        const records = await CallRecord.find().sort({ createdAt: -1 });
        io.emit("all-calls", records);
    }

    // ✅ Cleanup memory for terminal states
    if (["failed", "busy", "no-answer"].includes(CallStatus)) {
        if (inboundConversations[CallSid]) delete inboundConversations[CallSid];
    }

    res.sendStatus(200);
};

// ✅ Recording status (save + summary)
export const handleRecordingStatus = async (req, res) => {
    const { RecordingUrl, CallSid } = req.body;

    try {
        if (inboundConversations[CallSid]) {
            let summary = "Summary not available";

            try {
                const transcriptText = inboundConversations[CallSid].transcript
                    .map(t => `${t.role === "agent" ? "Agent" : "User"}: ${t.text}`)
                    .join("\n");

                summary = await getAIResponse(
                    `Summarize the following inbound call in 2-3 sentences. 
                    Clearly mention the outcome (support resolved, sales lead, follow-up needed, complaint logged, etc.). 
                    Keep it short and professional.

                    Transcript:
                    ${transcriptText}`
                );
            } catch (err) {
                console.error("Inbound summary generation failed:", err.message);
            }

            const rec = new CallRecord({
                callSid: CallSid,
                from: inboundConversations[CallSid].from || "Unknown",
                to: inboundConversations[CallSid].to || "Unknown",
                transcript: inboundConversations[CallSid].transcript,
                recordingUrl: RecordingUrl,
                summary,
                entryPath: 'SIP', // Default for inbound calls
                result: 'resolved', // Default, can be updated based on call outcome
                confidenceScores: {
                    overall: 0.8, // Default confidence
                    transcription: 0.9,
                    understanding: 0.7
                },
                language: 'en-GB',
                duration: Date.now() - new Date(inboundConversations[CallSid].startTime || Date.now())
            });

            await rec.save();
            delete inboundConversations[CallSid];

            const records = await CallRecord.find().sort({ createdAt: -1 });
            io.emit("all-calls", records);
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("inbound-recording-status error:", err);
        res.sendStatus(500);
    }
};
