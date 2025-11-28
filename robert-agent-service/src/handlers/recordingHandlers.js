import axios from "axios";
import CallRecord from "../database/models/CallRecord.js";
import { conversations } from "../shared/state.js";
import dotenv from "dotenv";

dotenv.config();

// Recording status
export const recordingStatus = async (req, res) => {
    const { RecordingUrl, CallSid } = req.body;
    try {
        if (conversations[CallSid]) {
            // Generate a short summary
            let summary = "Summary not available";
            try {
                const transcriptText = conversations[CallSid].transcript
                    .map(t => `${t.role === "agent" ? "Agent" : "User"}: ${t.text}`)
                    .join("\n");

                // Simple summary generation (can be enhanced with AI later)
                if (transcriptText.length > 0) {
                    summary = `Call transcript available with ${conversations[CallSid].transcript.length} exchanges.`;
                }
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
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("Recording status error:", err);
        res.sendStatus(500);
    }
};

// Proxy recording
export const proxyRecording = async (req, res) => {
    try {
        const rec = await CallRecord.findOne({ callSid: req.params.callSid });
        if (!rec || !rec.recordingUrl) {
            return res.status(404).send("Recording not found");
        }

        const twilioUrl = rec.recordingUrl + ".mp3";
        const response = await axios.get(twilioUrl, {
            auth: { 
                username: process.env.TWILIO_SID, 
                password: process.env.TWILIO_AUTH_TOKEN 
            },
            responseType: "stream",
        });

        res.setHeader("Content-Type", "audio/mpeg");
        response.data.pipe(res);
    } catch (err) {
        console.error("recording proxy error:", err.message);
        res.status(500).send("Error fetching recording");
    }
};

