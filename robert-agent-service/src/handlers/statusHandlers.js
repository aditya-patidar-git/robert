import CallRecord from "../database/models/CallRecord.js";
import { conversations } from "../shared/state.js";
import summaryService from "../services/summaryService.js";
import crossCallMemoryService from "../services/crossCallMemoryService.js";
import twilioMetricsService from "../services/twilioMetricsService.js";

// Call status with live updates (no Socket.IO in agent service)
export const callStatus = async (req, res) => {
    // Twilio sends form-encoded data, handle safely
    const CallSid = req.body?.CallSid;
    const CallStatus = req.body?.CallStatus;
    const From = req.body?.From;
    const To = req.body?.To;
    
    if (!CallSid) {
        console.error('❌ [CALL STATUS] Missing CallSid in request');
        console.error('❌ [CALL STATUS] Request body:', req.body);
        console.error('❌ [CALL STATUS] Request query:', req.query);
        return res.status(400).send('Missing CallSid');
    }
    
    console.log(`\n📞 [CALL STATUS] Call ${CallSid}: ${CallStatus}`);
    console.log(`📞 [CALL STATUS] From: ${From}, To: ${To}`);
    
    // Log when call is answered - this is when WebSocket should connect
    if (CallStatus === 'in-progress' || CallStatus === 'ringing') {
        console.log(`📞 [CALL STATUS] Call ${CallSid} is ${CallStatus} - WebSocket should connect soon...`);
    }

    // Initialize or update conversation state using session management service
    const sessionManagementService = (await import('../services/sessionManagementService.js')).default;
    if (!conversations[CallSid]) {
        sessionManagementService.initializeSession(CallSid, {
            from: From,
            to: To,
            language: 'en-US',
            callType: 'Twilio'
        });
    } else {
        sessionManagementService.updateSession(CallSid, {
            from: From,
            to: To
        });
    }

    // Update CallRecord
    try {
        await CallRecord.findOneAndUpdate(
            { callSid: CallSid },
            {
                callSid: CallSid,
                callStatus: CallStatus,
                from: From,
                to: To
            },
            { upsert: true, new: true }
        );
    } catch (err) {
        console.error('Error updating CallRecord:', err);
    }

    // Generate and store call summary on completion
    if (CallStatus === "completed" && conversations[CallSid]) {
        try {
            const conversation = conversations[CallSid];
            const callerId = From || conversation.from;
            
            if (callerId && conversation.transcript && conversation.transcript.length > 0) {
                // Generate structured summary
                const summary = await summaryService.generateCallSummary(
                    conversation.transcript,
                    { callSid: CallSid, from: From, to: To }
                );
                
                // Store in CallMemory for cross-call context
                await crossCallMemoryService.storeCallSummary(
                    CallSid,
                    callerId,
                    summary,
                    {
                        language: conversation.language || 'en-GB',
                        consentGiven: conversation.memoryConsent?.given || false
                    }
                );
                
                console.log(`✅ [${CallSid}] Call summary stored for caller ${callerId}`);
            }
        } catch (error) {
            console.error(`❌ [${CallSid}] Error storing call summary:`, error);
            // Don't block call completion if summary storage fails
        }

        // Fetch and save audio quality metrics from Twilio
        // This runs asynchronously and won't block call completion
        twilioMetricsService.fetchAndSaveCallQualityMetrics(CallSid, {
            maxRetries: 3,
            initialDelay: 2000
        }).catch(error => {
            console.error(`❌ [${CallSid}] Error fetching call quality metrics:`, error);
            // Error is already logged in the service, just catch to prevent unhandled rejection
        });
    }

    // Cleanup memory for terminal states
    if (["failed", "busy", "no-answer", "completed"].includes(CallStatus)) {
        if (conversations[CallSid]) {
            delete conversations[CallSid];
        }
    }

    res.sendStatus(200);
};

