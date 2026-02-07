import CallRecord from "../database/models/CallRecord.js";
import ConversationContext from "../database/models/ConversationContext.js";
import { conversations } from "../shared/state.js";
import summaryService from "../services/summaryService.js";
import tokenLimitService from "../services/tokenLimitService.js";
import configManager from "../agent/configManager.js";
import crossCallMemoryService from "../services/crossCallMemoryService.js";
import twilioMetricsService from "../services/twilioMetricsService.js";
import voicemailEmailService from "../services/voicemailEmailService.js";
import twilioClient from "../utils/twilioClient.js";
import {
    buildCallerIdentityUpdate,
    ensureCallRecordCallerIdentity,
    backfillRecordingUrlIfMissing
} from "../services/callRecordPersistenceService.js";
import gdprService from "../services/gdprService.js";
import piiDetectionService from "../services/piiDetectionService.js";
import { getProvenanceForCall } from "../services/provenanceService.js";

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

    // Update CallRecord: only set from/to when present so we never overwrite with undefined
    try {
        const identitySet = buildCallerIdentityUpdate(From, To);
        await CallRecord.findOneAndUpdate(
            { callSid: CallSid },
            {
                $set: {
                    callSid: CallSid,
                    callStatus: CallStatus,
                    ...identitySet
                }
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
                await ensureCallRecordCallerIdentity(CallSid, { from: From, to: To });
                backfillRecordingUrlIfMissing(CallSid).catch(() => {});
                res.sendStatus(200);
                return;
            }
            
            const callerId = From || conversation.from;
            
            // CRITICAL: Save transcript AND consent to CallRecord BEFORE cleanup
            // This ensures data is persisted and available when recording webhook arrives
            // BUT only if recording consent was given (GDPR compliance)
            
            if (conversation.transcript && conversation.transcript.length > 0) {
                const identitySet = buildCallerIdentityUpdate(conversation.from || From, conversation.to || To);
                let transcriptToSave = conversation.transcript;
                if (consentGiven) {
                    try {
                        const privacyConfig = await gdprService.getPrivacyConfig();
                        if (privacyConfig?.transcriptRedaction?.maskPIIAtSave) {
                            transcriptToSave = piiDetectionService.redactTranscriptSegments(conversation.transcript);
                        }
                    } catch (_) {}
                    const provenance = await getProvenanceForCall(CallSid);
                    try {
                        await CallRecord.findOneAndUpdate(
                            { callSid: CallSid },
                            {
                                $set: {
                                    transcript: transcriptToSave,
                                    provenance,
                                    ...identitySet,
                                    duration: conversation.duration || null,
                                    language: conversation.language || 'en-GB',
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
                    }
                } else {
                    console.log(`🚫 [${CallSid}] Recording consent not given - transcript will not be stored`);
                    try {
                        await CallRecord.findOneAndUpdate(
                            { callSid: CallSid },
                            {
                                $set: {
                                    transcript: [],
                                    ...identitySet,
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
                
                // Update CallRecord with summary (schema expects string)
                const summaryForDb = typeof summary === 'object' && summary !== null ? JSON.stringify(summary) : summary;
                try {
                    await CallRecord.findOneAndUpdate(
                        { callSid: CallSid },
                        { $set: { summary: summaryForDb } },
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
            await ensureCallRecordCallerIdentity(CallSid, { from: From, to: To });
        } catch (error) {
            console.error(`❌ [${CallSid}] Error storing call summary:`, error);
            // Don't block call completion if summary storage fails
        }

        try {
            let totalTokens = 0;
            let maxTokensUsed = 0;
            let truncationCount = 0;
            const convContext = await ConversationContext.findOne({ callSid: CallSid }).lean();
            if (convContext && (convContext.currentTokens != null || (convContext.truncationHistory && convContext.truncationHistory.length > 0))) {
                totalTokens = convContext.currentTokens || 0;
                maxTokensUsed = totalTokens;
                truncationCount = convContext.truncationHistory?.length || 0;
            } else if (conversation?.transcript?.length > 0) {
                const messages = conversation.transcript.map(t => ({
                    role: t.role === 'agent' ? 'assistant' : 'user',
                    content: t.text || ''
                }));
                const config = configManager.getConfigForNumber(To, conversation.language || 'en');
                const modelId = config?.model?.id || 'gpt-4o-realtime-preview-2024-12-17';
                totalTokens = tokenLimitService.countTokensInMessages(messages, modelId);
                maxTokensUsed = totalTokens;
            }
            await CallRecord.findOneAndUpdate(
                { callSid: CallSid },
                {
                    $set: {
                        'metrics.totalTokens': totalTokens,
                        'metrics.maxTokensUsed': maxTokensUsed,
                        'metrics.truncationCount': truncationCount,
                        'metrics.contextOptimizationApplied': truncationCount > 0
                    }
                },
                { upsert: true }
            );
        } catch (tokenErr) {
            console.error(`❌ [${CallSid}] Error saving token metrics to CallRecord:`, tokenErr);
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

        // Backfill recording URL from Twilio when consent given and recordingUrl missing (fire-and-forget)
        backfillRecordingUrlIfMissing(CallSid).catch(() => {});
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

