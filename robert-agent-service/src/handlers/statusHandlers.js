import CallRecord from "../database/models/CallRecord.js";
import { conversations } from "../shared/state.js";
import summaryService from "../services/summaryService.js";
import crossCallMemoryService from "../services/crossCallMemoryService.js";
import twilioMetricsService from "../services/twilioMetricsService.js";
import voicemailEmailService from "../services/voicemailEmailService.js";
import twilioClient from "../utils/twilioClient.js";

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
            language: 'en-GB',
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
    if (CallStatus === "completed") {
        try {
            // Get conversation data - may be cleaned up, so check CallRecord as fallback
            let conversation = conversations[CallSid];
            let consent = conversation?.recordingConsent;
            // Default is opt-in: null/undefined means consent given, only false means denied
            let consentGiven = consent?.given !== false;
            
            // If conversation cleaned up, try to get consent from CallRecord
            if (!conversation || !consent) {
                try {
                    const existingRecord = await CallRecord.findOne({ callSid: CallSid }).lean();
                    if (existingRecord?.recordingConsent) {
                        consent = existingRecord.recordingConsent;
                        // Default is opt-in: null/undefined means consent given, only false means denied
                        consentGiven = consent.given !== false;
                        // Use existing record data if conversation is gone
                        if (!conversation && existingRecord) {
                            conversation = {
                                transcript: existingRecord.transcript || [],
                                from: existingRecord.from,
                                to: existingRecord.to,
                                duration: existingRecord.duration,
                                language: existingRecord.language || 'en-GB'
                            };
                        }
                    }
                } catch (dbError) {
                    console.error(`❌ [${CallSid}] Error fetching consent from CallRecord:`, dbError);
                }
            }
            
            if (!conversation) {
                console.log(`⚠️ [${CallSid}] No conversation data found on call completion`);
                res.sendStatus(200);
                return;
            }
            
            const callerId = From || conversation.from;
            
            // CRITICAL: Save transcript AND consent to CallRecord BEFORE cleanup
            // This ensures data is persisted and available when recording webhook arrives
            // BUT only if recording consent was given (GDPR compliance)
            
            if (conversation.transcript && conversation.transcript.length > 0) {
                if (consentGiven) {
                    // Consent given - store transcript and ensure consent is saved
                    try {
                        await CallRecord.findOneAndUpdate(
                            { callSid: CallSid },
                            {
                                $set: {
                                    transcript: conversation.transcript,
                                    from: conversation.from || From,
                                    to: conversation.to || To,
                                    duration: conversation.duration || null,
                                    language: conversation.language || 'en-GB',
                                    // Ensure consent is saved (may have been set earlier, but ensure it's persisted)
                                    recordingConsent: {
                                        requested: consent?.requested || false,
                                        given: true,
                                        requestedAt: consent?.requestedAt || null,
                                        respondedAt: consent?.respondedAt || new Date(),
                                        optOutReason: null
                                    }
                                }
                            },
                            { upsert: true }
                        );
                        console.log(`✅ [${CallSid}] Transcript and consent saved to CallRecord (${conversation.transcript.length} entries) - consent given`);
                    } catch (transcriptError) {
                        console.error(`❌ [${CallSid}] Error saving transcript to CallRecord:`, transcriptError);
                        // Continue with other operations even if transcript save fails
                    }
                } else {
                    // Consent not given - do not store transcript (GDPR compliance)
                    console.log(`🚫 [${CallSid}] Recording consent not given - transcript will not be stored`);
                    try {
                        await CallRecord.findOneAndUpdate(
                            { callSid: CallSid },
                            {
                                $set: {
                                    transcript: [], // Explicitly set to empty array
                                    from: conversation.from || From,
                                    to: conversation.to || To,
                                    duration: conversation.duration || null,
                                    language: conversation.language || 'en-GB',
                                    recordingConsent: {
                                        requested: consent?.requested || false,
                                        given: false,
                                        requestedAt: consent?.requestedAt || null,
                                        respondedAt: consent?.respondedAt || null,
                                        optOutReason: consent?.optOutReason || "Consent not given"
                                    }
                                }
                            },
                            { upsert: true }
                        );
                        console.log(`✅ [${CallSid}] CallRecord updated without transcript (consent not given)`);
                    } catch (updateError) {
                        console.error(`❌ [${CallSid}] Error updating CallRecord without transcript:`, updateError);
                    }
                }
            }
            
            // Only generate and store summary if consent was given (transcript contains personal data)
            if (callerId && conversation.transcript && conversation.transcript.length > 0 && consentGiven) {
                // Generate structured summary
                const summary = await summaryService.generateCallSummary(
                    conversation.transcript,
                    { callSid: CallSid, from: From, to: To }
                );
                
                // Update CallRecord with summary
                try {
                    await CallRecord.findOneAndUpdate(
                        { callSid: CallSid },
                        { $set: { summary: summary } },
                        { upsert: true }
                    );
                } catch (summaryUpdateError) {
                    console.error(`❌ [${CallSid}] Error updating CallRecord with summary:`, summaryUpdateError);
                }
                
                // Store in CallMemory for cross-call context (only if memory consent also given)
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
            } else if (!consentGiven) {
                console.log(`🚫 [${CallSid}] Summary not generated - recording consent not given`);
            }
        } catch (error) {
            console.error(`❌ [${CallSid}] Error storing call summary:`, error);
            // Don't block call completion if summary storage fails
        }

        // Check if this was a voicemail call and send notification email
        try {
            const callRecord = await CallRecord.findOne({ callSid: CallSid }).lean();
            if (callRecord && callRecord.result === 'voicemail') {
                console.log(`📧 [${CallSid}] Voicemail detected, sending notification email...`);
                
                const conversation = conversations[CallSid] || {};
                // Only include transcript summary if consent was given
                const consent = conversation.recordingConsent;
                // Default is opt-in: null/undefined means consent given, only false means denied
                const consentGiven = consent?.given !== false;
                const transcriptSummary = (consentGiven && conversation.transcript)
                    ? conversation.transcript
                        .filter(t => t.role === 'user')
                        .map(t => t.text)
                        .join(' ')
                        .substring(0, 500) // Limit transcript length
                    : null;

                // Send voicemail notification email
                voicemailEmailService.sendVoicemailNotification({
                    callSid: CallSid,
                    callerId: From || conversation.from || 'Unknown',
                    recordingUrl: callRecord.recordingUrl,
                    transcript: transcriptSummary,
                    duration: callRecord.duration ? `${Math.round(callRecord.duration / 60)} minutes` : null,
                    timestamp: callRecord.createdAt || new Date()
                }).catch(error => {
                    console.error(`❌ [${CallSid}] Error sending voicemail notification:`, error);
                    // Don't block call completion if email fails
                });
            }
        } catch (error) {
            console.error(`❌ [${CallSid}] Error checking voicemail status:`, error);
            // Don't block call completion if voicemail check fails
        }

        // Fetch and save audio quality metrics from Twilio
        // This runs asynchronously and won't block call completion
        // Increased retries (6) and initial delay (5s) since Twilio metrics can take up to 90 seconds
        twilioMetricsService.fetchAndSaveCallQualityMetrics(CallSid, {
            maxRetries: 6,
            initialDelay: 5000
        }).catch(error => {
            console.error(`❌ [${CallSid}] Error fetching call quality metrics:`, error);
            // Error is already logged in the service, just catch to prevent unhandled rejection
        });

        // Fetch recording URL from Twilio if consent was given but recordingUrl is missing
        // This ensures recordings are available when consent is given, even if webhook is delayed
        (async () => {
            try {
                const conversation = conversations[CallSid] || {};
                const consent = conversation.recordingConsent;
                
                // Default is opt-in: null/undefined means consent given, only false means denied
                // Only skip fetch if consent was explicitly denied
                if (consent?.given === false) {
                    console.log(`ℹ️ [${CallSid}] Recording consent explicitly denied, skipping recording fetch`);
                    return;
                }

                // Check if recording URL already exists
                const existingRecord = await CallRecord.findOne({ callSid: CallSid }).lean();
                if (existingRecord?.recordingUrl) {
                    console.log(`✅ [${CallSid}] Recording URL already exists, skipping fetch`);
                    return;
                }

                console.log(`🔍 [${CallSid}] Consent given but recording URL missing - fetching from Twilio API...`);

                // Wait a bit for Twilio to process the recording (recordings may take a few seconds)
                await new Promise(resolve => setTimeout(resolve, 5000));

                // Fetch recordings from Twilio API with retries
                let recordingUrl = null;
                let retries = 3;
                let delay = 3000;

                while (retries > 0 && !recordingUrl) {
                    try {
                        const recordings = await twilioClient.recordings.list({
                            callSid: CallSid,
                            limit: 1
                        });

                        if (recordings && recordings.length > 0) {
                            const recording = recordings[0];
                            recordingUrl = recording.uri.replace('.json', ''); // Remove .json extension
                            break;
                        }
                    } catch (error) {
                        if (error.status === 404 || error.code === 20404) {
                            // Recording not yet available, retry
                            console.log(`⏳ [${CallSid}] Recording not yet available, retrying in ${delay}ms... (${retries} retries left)`);
                            retries--;
                            if (retries > 0) {
                                await new Promise(resolve => setTimeout(resolve, delay));
                                delay *= 2; // Exponential backoff
                            }
                        } else {
                            throw error;
                        }
                    }
                }

                if (recordingUrl) {
                    // Update CallRecord with recording URL and consent info
                    await CallRecord.findOneAndUpdate(
                        { callSid: CallSid },
                        {
                            $set: {
                                recordingUrl: recordingUrl,
                                recordingConsent: {
                                    requested: consent?.requested || false,
                                    given: true,
                                    requestedAt: consent?.requestedAt || null,
                                    respondedAt: consent?.respondedAt || null,
                                    optOutReason: null
                                }
                            }
                        },
                        { upsert: true }
                    );
                    
                    console.log(`✅ [${CallSid}] Recording URL fetched from Twilio API and saved (consent was given)`);
                } else {
                    console.warn(`⚠️ [${CallSid}] Consent was given but recording not found in Twilio after retries - may still be processing`);
                }
            } catch (error) {
                console.error(`❌ [${CallSid}] Error fetching recording from Twilio:`, error.message);
                // Don't block call completion if recording fetch fails
            }
        })();
    }

    // CRITICAL: Delay cleanup for completed calls to allow recording webhook to arrive
    // Only cleanup immediately for failed/busy/no-answer (these won't have recordings)
    // For completed calls, cleanup happens after a delay or when recording webhook arrives
    if (["failed", "busy", "no-answer"].includes(CallStatus)) {
        if (conversations[CallSid]) {
            delete conversations[CallSid];
        }
    } else if (CallStatus === "completed") {
        // For completed calls, delay cleanup to allow recording webhook to process
        // Recording webhooks typically arrive within 5-30 seconds after call completion
        setTimeout(() => {
            if (conversations[CallSid]) {
                console.log(`🧹 [${CallSid}] Cleaning up conversation state after delay (recording webhook should have arrived)`);
                delete conversations[CallSid];
            }
        }, 60000); // 60 second delay - should be enough for recording webhook
    }

    res.sendStatus(200);
};

