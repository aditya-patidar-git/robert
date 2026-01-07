import { WebSocket } from "ws";
import { conversations, realtimeClients } from "../../shared/state.js";
import { ConnectionManager } from "./connection/index.js";
import { CallStateManager } from "./state/index.js";
import { AudioProcessor } from "./audio/index.js";
import { OpenAIIntegration } from "./openai/index.js";
import { ToolCoordinator } from "./toolCoordinator.js";
import { MemoryManager } from "./utils/index.js";
import configManager from "../../agent/configManager.js";
import progressIndicatorService from "../../services/progressIndicatorService.js";
import silenceDetectionService from "../../services/silenceDetectionService.js";
import errorRecoveryService from "../../services/errorRecoveryService.js";
import adaptiveTimingService from "../../services/adaptiveTimingService.js";
import turnTakingStateMachine from "../../services/turnTakingStateMachine.js";
import proactiveAssistanceService from "../../services/proactiveAssistanceService.js";
import CallRecord from "../../database/models/CallRecord.js";

/**
 * Media Stream HTTP endpoint handler
 * Handles WebSocket upgrade requests
 */
export const mediaStream = async (req, res) => {
    const { callSid } = req.query;
    
    if (!callSid) {
        return res.status(400).send('Missing callSid parameter');
    }

    const upgrade = req.headers.upgrade;
    if (upgrade !== 'websocket') {
        return res.status(400).send('Expected WebSocket upgrade');
    }

    res.status(101).end();
};

/**
 * Handle WebSocket connection for Media Streams with dynamic config
 * This is the main entry point that composes all modular components
 */
export const handleMediaStreamConnection = (ws, req) => {
    try {
        // Initialize connection manager
        const connectionManager = new ConnectionManager(ws, req);
        
        if (!connectionManager.validateConnection()) {
            return;
        }
        
        // Initialize state manager
        const stateManager = new CallStateManager();
        
        // Initialize audio processor
        const audioProcessor = new AudioProcessor(stateManager, ws);
        
        // Initialize OpenAI integration (will be set up after 'start' event)
        let openaiIntegration = null;
        let toolCoordinator = null;
        
        // Setup initial message handler for 'start' event
        connectionManager.setupInitialMessageHandler(async ({ callSid, streamSid, phoneNumber }) => {
            if (!callSid) {
                console.error('❌ No callSid in start event');
                return { error: 'no_callsid' };
            }
            
            // Initialize state with call information
            stateManager.callSid = callSid;
            stateManager.streamSid = streamSid;
            stateManager.phoneNumber = phoneNumber;
            
            console.log(`📞 Start event - callSid: ${callSid}, phoneNumber: ${phoneNumber}`);
            
            // Setup duration timer
            stateManager.durationTimer = setTimeout(() => {
                if (!stateManager.isClosed) {
                    console.log(`⏰ [${callSid}] Max call duration reached (${stateManager.MAX_CALL_DURATION_MS / 60000} minutes)`);
                    cleanup('max_duration');
                }
            }, stateManager.MAX_CALL_DURATION_MS);
            
            // Setup start timeout
            stateManager.startTimeout = setTimeout(() => {
                if (!stateManager.setupComplete && !stateManager.isClosed) {
                    console.error(`❌ [${callSid}] Setup timeout - no OpenAI connection within 30s`);
                    cleanup('setup_timeout');
                }
            }, 30000);
            
            // Initialize OpenAI integration
            openaiIntegration = new OpenAIIntegration(
                stateManager,
                ws,
                audioProcessor,
                async (event) => {
                    // Route events through tool coordinator
                    if (toolCoordinator) {
                        return await toolCoordinator.routeEvent(event);
                    }
                }
            );
            
            // Initialize tool coordinator
            toolCoordinator = new ToolCoordinator(stateManager, null, ws); // openaiWs will be set after setup
            
            // Setup OpenAI connection
            const setupResult = await openaiIntegration.setupOpenAI();
            if (setupResult?.error) {
                const errorType = setupResult.retryable ? 'retryable' : 'non-retryable';
                console.error(`❌ [${callSid}] Failed to setup OpenAI (${errorType}): ${setupResult.error}${setupResult.details ? ` - ${setupResult.details}` : ''}`);
                
                // For retryable errors, log but still cleanup (call can't proceed without OpenAI)
                if (setupResult.retryable) {
                    console.warn(`⚠️ [${callSid}] OpenAI connection failed after retries. This may be due to temporary OpenAI service issues.`);
                }
                
                cleanup(setupResult.error);
                return;
            }
            
            // Update tool coordinator with OpenAI WebSocket
            if (setupResult?.openaiWs) {
                toolCoordinator.setOpenAIWebSocket(setupResult.openaiWs);
                stateManager.setOpenAIReady(setupResult.openaiWs);
            }
            
            // Audio processing will start automatically when first audio arrives
            // via processIncomingAudio() method
            
            // Memory consent will be checked after initial greeting completes
            // (moved to responseHandler.handleResponseDone to avoid blocking conversation start)
            
            return { success: true };
        });
        
        // Setup Twilio WebSocket message handler for media
        let mediaEventCount = 0; // Track total media events received (for logging)
        ws.on('message', async (data) => {
            if (stateManager.isClosed || !stateManager.accepting) {
                return;
            }
            
            try {
                const json = JSON.parse(data.toString());
                
                // Handle media events
                if (json.event === 'media' && json.media?.payload) {
                    if (!stateManager.streamSid) {
                        // Wait for start event
                        return;
                    }
                    
                    mediaEventCount++;
                    const track = json.media.track;
                    
                    // Log track info for debugging (first few and then periodically)
                    if (mediaEventCount <= 5 || (mediaEventCount % 500 === 0)) {
                        console.log(`🎤 [${stateManager.callSid}] Media event #${mediaEventCount} - track: ${track || 'undefined'}`);
                    }
                    
                    // CRITICAL: Only process inbound track to avoid feedback loop
                    // Outbound track is the agent's own audio being sent back
                    if (track === 'inbound') {
                        // Process incoming audio from caller
                        audioProcessor.processIncomingAudio(json.media.payload);
                    } else if (track === 'outbound') {
                        // Explicitly ignore outbound track - this is our own audio being echoed back
                        // Log first few to verify we're filtering correctly
                        if (mediaEventCount <= 10 || (mediaEventCount % 500 === 0)) {
                            console.log(`🔇 [${stateManager.callSid}] Ignoring outbound track audio (feedback prevention) - event #${mediaEventCount}`);
                        }
                    } else {
                        // Track is undefined or unexpected - log warning
                        console.warn(`⚠️ [${stateManager.callSid}] Media event #${mediaEventCount} with unexpected track: ${track || 'undefined'}, ignoring`);
                    }
                }
                
                // Handle other Twilio events (mark, stop, etc.)
                if (json.event === 'stop') {
                    console.log(`🛑 [${stateManager.callSid}] Stop event received from Twilio`);
                    cleanup('twilio_stop');
                }
            } catch (err) {
                stateManager.incrementErrorCount();
                console.error(`❌ [${stateManager.callSid}] Error processing Twilio message:`, err);
                if (stateManager.hasMaxErrors()) {
                    cleanup('error_limit');
                }
            }
        });
        
        // Setup Twilio WebSocket error handler
        ws.on('error', (err) => {
            console.error(`❌ [${stateManager.callSid}] Twilio WebSocket error:`, err);
            stateManager.incrementErrorCount();
            if (stateManager.hasMaxErrors()) {
                cleanup('twilio_error');
            }
        });
        
        // Setup Twilio WebSocket close handler
        ws.on('close', () => {
            console.log(`🔌 [${stateManager.callSid}] Twilio WebSocket closed`);
            cleanup('twilio_close');
        });
        
        /**
         * Cleanup function
         */
        async function cleanup(reason = 'unknown') {
            if (stateManager.isClosed) return;
            stateManager.isClosed = true;
            stateManager.accepting = false;
            
            console.log(`🧹 Cleaning up call ${stateManager.callSid} - reason: ${reason}`);
            
            // Cleanup OpenAI connection
            if (openaiIntegration) {
                openaiIntegration.cleanup();
            }
            
            // Cleanup audio processor
            if (audioProcessor) {
                audioProcessor.cleanup();
            }
            
            // Cleanup tool coordinator (includes responseHandler with downsampler)
            if (toolCoordinator) {
                toolCoordinator.cleanup();
            }
            
            // Cleanup Twilio WebSocket
            if (ws) {
                ws.removeAllListeners();
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close(1000, 'Call ended');
                }
            }
            
            // Clear timers
            if (stateManager.durationTimer) clearTimeout(stateManager.durationTimer);
            if (stateManager.startTimeout) clearTimeout(stateManager.startTimeout);
            if (stateManager.consentTimeout) clearTimeout(stateManager.consentTimeout);
            if (stateManager.speechContinuationGraceTimer) {
                clearTimeout(stateManager.speechContinuationGraceTimer);
            }
            
            // Cleanup outbound audio buffer and pacer
            if (stateManager.outboundAudioPacer) {
                clearInterval(stateManager.outboundAudioPacer);
                stateManager.outboundAudioPacer = null;
            }
            stateManager.outboundAudioBuffer = null;
            stateManager.lastOutboundSendTime = 0;
            
            // Cleanup services
            if (stateManager.callSid) {
                const toolExecutionService = (await import('../../services/toolExecutionService.js')).default;
                toolExecutionService.cleanup(stateManager.callSid);
                
                progressIndicatorService.endToolExecution(stateManager.callSid);
                silenceDetectionService.reset(stateManager.callSid);
                errorRecoveryService.clearRetryCount(stateManager.callSid);
                adaptiveTimingService.resetCallerProfile(stateManager.callSid);
                turnTakingStateMachine.reset(stateManager.callSid);
                proactiveAssistanceService.clearCache(stateManager.callSid);
                
                // Update database with transcript
                try {
                    const sessionManagementService = (await import('../../services/sessionManagementService.js')).default;
                    const duration = stateManager.callStartTime ? Math.floor((Date.now() - stateManager.callStartTime) / 1000) : null;
                    const conversation = sessionManagementService.getSession(stateManager.callSid);
                    
                    const updateData = {
                        callStatus: 'completed',
                        ...(duration && { duration })
                    };
                    
                    // Check recording consent before saving transcript (GDPR compliance)
                    const consent = conversation?.recordingConsent;
                    const consentGiven = consent?.given === true;
                    
                    if (conversation?.transcript && conversation.transcript.length > 0) {
                        if (consentGiven) {
                            // Consent given - store transcript
                            updateData.transcript = conversation.transcript;
                            if (conversation.from) updateData.from = conversation.from;
                            if (conversation.to) updateData.to = conversation.to;
                            
                            // Generate summary if not already present
                            if (!updateData.summary && conversation.transcript.length > 0) {
                                try {
                                    const summaryService = (await import('../../services/summaryService.js')).default;
                                    updateData.summary = await summaryService.generateCallSummary(
                                        conversation.transcript,
                                        { callSid: stateManager.callSid, from: conversation.from, to: conversation.to }
                                    );
                                } catch (summaryError) {
                                    console.warn(`⚠️ [${stateManager.callSid}] Could not generate summary:`, summaryError.message);
                                    updateData.summary = `Call transcript with ${conversation.transcript.length} exchanges.`;
                                }
                            }
                            
                            console.log(`✅ [${stateManager.callSid}] Saving transcript with ${conversation.transcript.length} entries - consent given`);
                        } else {
                            // Consent not given - do not store transcript (GDPR compliance)
                            updateData.transcript = []; // Explicitly set to empty array
                            updateData.summary = "Recording and transcript not stored - consent not given";
                            if (conversation.from) updateData.from = conversation.from;
                            if (conversation.to) updateData.to = conversation.to;
                            updateData.recordingConsent = {
                                requested: consent?.requested || false,
                                given: false,
                                requestedAt: consent?.requestedAt || null,
                                respondedAt: consent?.respondedAt || null,
                                optOutReason: consent?.optOutReason || "Consent not given"
                            };
                            console.log(`🚫 [${stateManager.callSid}] Transcript not saved - recording consent not given`);
                        }
                    }
                    
                    await CallRecord.findOneAndUpdate(
                        { callSid: stateManager.callSid },
                        updateData,
                        { upsert: true }
                    );
                } catch (dbError) {
                    console.error(`❌ [${stateManager.callSid}] Error updating CallRecord:`, dbError);
                }
                
                // Cleanup from global state
                delete realtimeClients[stateManager.callSid];
            }
        }
        
    } catch (err) {
        console.error('❌ Error in handleMediaStreamConnection:', err);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close(1011, 'Internal server error');
        }
    }
};

// Export modular components for advanced usage
export { ConnectionManager } from './connection/index.js';
export { CallStateManager } from './state/index.js';
export { AudioProcessor, ByteQueue } from './audio/index.js';
export { OpenAIIntegration } from './openai/index.js';
export { ToolCoordinator } from './toolCoordinator.js';
export { TokenManager, LanguageDetector, MemoryManager } from './utils/index.js';
export { BargeInHandler, ConsentHandler, ResponseHandler, TranscriptionHandler, ToolCallHandler } from './events/index.js';
