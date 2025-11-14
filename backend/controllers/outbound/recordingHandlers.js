import axios from "axios";
import CallRecord from "../../models/CallRecord.js";
import { conversations } from "./sharedState.js";
import { getAIResponse } from "../../utils/ai.js";

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
                        Be concise and factual.\n\n${transcriptText}`,
                        null,
                        { callSid: CallSid }
                    );
                    summary = summaryResponse.content || summary;
            } catch (err) {
                console.error("Summary generation error:", err);
            }

            await CallRecord.findOneAndUpdate(
                { callSid: CallSid },
                {
                    callSid: CallSid,
                    recordingUrl: RecordingUrl,
                    transcript: conversations[CallSid].transcript,
                    summary: summary,
                    from: conversations[CallSid].from,
                    to: conversations[CallSid].to,
                },
                { upsert: true, new: true }
            );

            // Emit to Socket.IO
            const { io } = await import("../../server.js");
            const records = await CallRecord.find().sort({ createdAt: -1 });
            io.emit("all-calls", records);
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("Recording status error:", err);
        res.sendStatus(500);
    }
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

