import CallRecord from "../../models/CallRecord.js";
import { conversations } from "./sharedState.js";
import { getAIResponse } from "../../utils/ai.js";
import multilingualService from "../../services/multilingualService.js";

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
        // Get or create conversation context for token management
        const ConversationContext = (await import('../../models/ConversationContext.js')).default;
        const tokenManagementService = (await import('../../services/tokenManagementService.js')).default;
        
        let contextDoc = await ConversationContext.findOne({ callSid });
        if (!contextDoc) {
            const AIConfig = (await import('../../models/AIConfig.js')).default;
            const modelDiscoveryService = (await import('../../services/modelDiscoveryService.js')).default;
            const globalConfig = await AIConfig.findOne({ isActive: true });
            const modelId = globalConfig?.model?.id || 'gpt-4o';
            const contextLimit = modelDiscoveryService.getContextLimit(modelId);
            
            contextDoc = new ConversationContext({
                callSid,
                modelId,
                contextLimit,
                currentTokens: 0,
                messages: []
            });
        }

        // Add user message to context
        const userMessage = {
            role: 'user',
            content: userAnswer,
            timestamp: new Date(),
            tokenCount: tokenManagementService.countMessageTokens({ role: 'user', content: userAnswer }, contextDoc.modelId)
        };
        contextDoc.messages.push(userMessage);
        contextDoc.currentTokens += userMessage.tokenCount;
        await contextDoc.save();

        // Prepare call context
        const callContext = {
            callSid,
            transcript: conversations[callSid].transcript,
            messages: contextDoc.messages
        };

        // Generate AI reply - getAIResponse will handle token management
        const aiResponse = await getAIResponse(contextDoc.messages, null, callContext);
        aiReply = aiResponse.content || "I understand. How else can I help?";
        
        // Add AI response to transcript
        conversations[callSid].transcript.push({ role: "agent", text: aiReply });
        
        // Store token usage
        if (aiResponse.tokenUsage && contextDoc) {
            contextDoc.currentTokens = aiResponse.tokenUsage.totalTokens || aiResponse.tokenUsage.after;
            await contextDoc.save();
        }
        
        console.log(`🤖 AI replied: "${aiReply}"`);
        
    } catch (error) {
        console.error("AI response error:", error);
        aiReply = "I'm sorry, I didn't catch that. Could you please repeat?";
        conversations[callSid].transcript.push({ role: "agent", text: aiReply });
    }

    // Generate TwiML response
    const twilio = await import("twilio");
    const VoiceResponse = twilio.twiml.VoiceResponse;
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

    const { io } = await import("../../server.js");
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

