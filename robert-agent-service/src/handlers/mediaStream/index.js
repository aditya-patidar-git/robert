import { WebSocket } from "ws";
import { conversations, realtimeClients } from "../../shared/state.js";
import testClientRegistry from "../../services/testClientRegistry.js";
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
import recordingService from "../../services/recordingService.js";
import gdprService from "../../services/gdprService.js";
import piiDetectionService from "../../services/piiDetectionService.js";
import { getProvenanceForCall } from "../../services/provenanceService.js";

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
        // Extract and store callSid from URL query param
        // This callSid matches what test clients register with (from REST API response)
        let callSidFromUrl = null;
        try {
            const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
            callSidFromUrl = url.searchParams.get('callSid');
            
            if (callSidFromUrl && realtimeClients[callSidFromUrl]) {
                const existing = realtimeClients[callSidFromUrl];
                if (existing.twilioWs && existing.twilioWs.readyState === WebSocket.OPEN) {
                    ws.close(1000, 'Connection already exists for this call');
                    return;
                }
            }
        } catch (urlError) {
            // If URL parsing fails, continue with normal flow (callSid will be extracted from start event)
        }
        
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
            
            const callSidFromStartEvent = callSid; // From Twilio start event
            
            // Use URL callSid for forwarding (matches test client registration)
            // Fall back to start event callSid if URL callSid not available
            const callSidForForwarding = callSidFromUrl || callSidFromStartEvent;
            
            // Double-check for duplicate connections (backup check)
            if (realtimeClients[callSidFromStartEvent]) {
                const existing = realtimeClients[callSidFromStartEvent];
                // Only reject if existing connection is still open
                if (existing.twilioWs && existing.twilioWs.readyState === WebSocket.OPEN) {
                    ws.close(1000, 'Connection already exists for this call');
                    return { error: 'duplicate_connection' };
                } else {
                    // Existing connection is closed, clean it up and allow new one
                    delete realtimeClients[callSidFromStartEvent];
                }
            }
            
            // Initialize state with call information
            // Use start event callSid for state management (Twilio's canonical ID)
            stateManager.callSid = callSidFromStartEvent;
            stateManager.streamSid = streamSid;
            // Store callSid for forwarding (URL callSid matches test client registration)
            stateManager.callSidForForwarding = callSidForForwarding;
            stateManager.pickupLatencyStartTime = Date.now();
            stateManager.phoneNumber = phoneNumber;

            const latency = () => stateManager.pickupLatencyMs();
            console.log(`[PICKUP_LATENCY] [${callSidFromStartEvent}] T0 start_event_received 0ms`);
            
            // Initialize audio diagnostics (non-intrusive, optional)
            const audioDiagnosticService = (await import('../../services/audioDiagnosticService.js')).default;
            audioDiagnosticService.initializeCall(callSidFromStartEvent);
            
            console.log(`📞 Start event - callSid: ${callSidFromStartEvent}, phoneNumber: ${phoneNumber}`);

            // Forward start event to registered test clients (acceptance tests)
            // Use URL callSid for forwarding (matches test client registration)
            const startPayload = { event: 'start', start: { callSid: callSidFromStartEvent, streamSid, phoneNumber } };
            testClientRegistry.forwardEvent(callSidForForwarding, startPayload);
            
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
            
            console.log(`[PICKUP_LATENCY] [${callSid}] T1 setup_openai_start ${latency()}ms`);
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
            
            // Update tool coordinator with OpenAI WebSocket and integration reference
            if (setupResult?.openaiWs) {
                toolCoordinator.setOpenAIWebSocket(setupResult.openaiWs);
                toolCoordinator.setOpenAIIntegration(openaiIntegration);
                // Set OpenAI ready with connection manager reference for robust sending
                const connectionManager = openaiIntegration?.connectionManager || null;
                stateManager.setOpenAIReady(setupResult.openaiWs, connectionManager);
            }
            console.log(`[PICKUP_LATENCY] [${callSid}] T2 openai_ready ${latency()}ms`);
            
            // Audio processing will start automatically when first audio arrives
            // via processIncomingAudio() method
            
            // Memory consent will be checked after initial greeting completes
            // (moved to responseHandler.handleResponseDone to avoid blocking conversation start)
            
            // Start recording for inbound calls (once per call; consent checked by recording service)
            // Fire-and-forget so start handler returns immediately; T3 and conversation updates run in .then
            const conversation = conversations[callSid] || {};
            if (!conversation.recordingStarted && recordingService.shouldRecordCall(conversation)) {
                const callbackUrl = recordingService.getRecordingCallbackUrl('inbound');
                recordingService.startCallRecording(callSid, {
                    statusCallbackUrl: callbackUrl
                })
                    .then((recordingResult) => {
                        if (recordingResult.success || recordingResult.error === 'already_recording') {
                            if (!conversations[callSid]) conversations[callSid] = {};
                            conversations[callSid].recordingStarted = true;
                            console.log(`[PICKUP_LATENCY] [${callSid}] T3 recording_started ${stateManager.pickupLatencyMs()}ms`);
                        }
                        if (recordingResult.success) {
                            console.log(`🎙️ [${callSid}] Recording started for inbound call`);
                        } else if (recordingResult.error !== 'already_recording') {
                            console.warn(`⚠️ [${callSid}] Could not start recording: ${recordingResult.message}`);
                        }
                    })
                    .catch((recordingError) => {
                        console.warn(`⚠️ [${callSid}] Recording setup error (non-blocking):`, recordingError.message);
                    });
            } else if (!conversation.recordingStarted) {
                console.log(`🔇 [${callSid}] Recording skipped - consent not given`);
            }

            return { success: true };
        });
        
        // Setup Twilio WebSocket message handler for media
        let mediaEventCount = 0; // Track total media events received (for logging)
        let outboundMessageCount = 0; // Track outbound messages sent
        
        // Remove wrapper logging - not needed for format testing
        // Just pass through to original send
        
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
                    
                    // Remove media event logging - not needed for format testing
                    // CRITICAL: Only process inbound track to avoid feedback loop
                    if (track === 'inbound') {
                        audioProcessor.processIncomingAudio(json.media.payload);
                    }
                    // Silently ignore outbound track (feedback prevention)
                }
                
                // Handle other Twilio events (mark, stop, etc.)
                if (json.event === 'mark') {
                    // Twilio sends mark events when audio finishes playing or is cleared
                    // Only log during interruption to confirm barge-in clears were acknowledged
                    if (stateManager.isInterrupted) {
                        const markName = json.mark?.name || 'unknown';
                        console.log(`📌 [${stateManager.callSid}] Mark event during interruption: "${markName}" (audio cleared)`);
                    }
                }
                
                if (json.event === 'stop') {
                    console.log(`🛑 [${stateManager.callSid}] Stop event received from Twilio`);
                    cleanup('twilio_stop');
                }

                // Forward Twilio events to registered test clients (acceptance tests)
                // Use callSidForForwarding (URL callSid) which matches test client registration
                const callSidForForward = stateManager.callSidForForwarding || stateManager.callSid || json.start?.callSid;
                if (callSidForForward && ['connected', 'media', 'mark', 'stop'].includes(json.event)) {
                    testClientRegistry.forwardEvent(callSidForForward, json);
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
        ws.on('close', (code, reason) => {
            console.log(`🔌 [${stateManager.callSid}] Twilio WebSocket closed`);
            console.log(`   - Close code: ${code}`);
            console.log(`   - Close reason: ${reason || 'No reason provided'}`);
            console.log(`   - Close code meanings: 1000=Normal, 1001=Going Away, 1006=Abnormal, 1008=Policy Violation, 1011=Server Error`);
            
            // Log additional context
            const duration = stateManager.callStartTime ? Math.floor((Date.now() - stateManager.callStartTime) / 1000) : null;
            console.log(`   - Call duration: ${duration ? `${duration}s` : 'unknown'}`);
            console.log(`   - Was responding: ${stateManager.isResponding || false}`);
            console.log(`   - OpenAI readyState: ${openaiIntegration?.state?.openaiWs?.readyState || 'N/A'} (1=OPEN, 2=CLOSING, 3=CLOSED)`);
            console.log(`   - Twilio WebSocket readyState: ${ws.readyState} (1=OPEN, 2=CLOSING, 3=CLOSED)`);
            console.log(`   - Error count: ${stateManager.errorCount || 0}`);
            
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
            
            // Cleanup audio diagnostics (non-intrusive, optional)
            const audioDiagnosticService = (await import('../../services/audioDiagnosticService.js')).default;
            audioDiagnosticService.cleanup(stateManager.callSid);
            
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
            
            // Cleanup test clients (forwarding registry)
            if (stateManager.callSid) {
                testClientRegistry.cleanup(stateManager.callSid);
            }

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
                        const transcriptSnapshot = conversation?.transcript ? [...conversation.transcript] : [];
                        const consentSnapshot = conversation?.recordingConsent;
                        const fromSnapshot = conversation?.from;
                        const toSnapshot = conversation?.to;
                        
                        const updateData = {
                            callStatus: 'completed',
                            ...(duration && { duration })
                        };
                        
                        // Extract WebSocket connection quality metrics if available
                        const connectionManager = openaiIntegration?.connectionManager || stateManager.openaiConnectionManager;
                        if (connectionManager && connectionManager.connectionQuality) {
                            const quality = connectionManager.connectionQuality;
                            const latencyArray = quality.latency || [];
                            
                            if (latencyArray.length > 0) {
                                const avgLatency = latencyArray.reduce((a, b) => a + b, 0) / latencyArray.length;
                                const minLatency = Math.min(...latencyArray);
                                const maxLatency = Math.max(...latencyArray);
                                
                                // Calculate variance (used for jitter estimation)
                                const variance = latencyArray.reduce((sum, val) => {
                                    return sum + Math.pow(val - avgLatency, 2);
                                }, 0) / latencyArray.length;
                                
                                // Estimate packet loss from missed pongs
                                const pingCount = connectionManager.config?.pingInterval 
                                    ? Math.floor(duration * 1000 / connectionManager.config.pingInterval)
                                    : 0;
                                const packetLoss = pingCount > 0 
                                    ? (quality.consecutivePongMisses / pingCount) * 100 
                                    : null;
                                
                                updateData.websocketMetrics = {
                                    avgLatency: Math.round(avgLatency * 100) / 100,
                                    minLatency: Math.round(minLatency * 100) / 100,
                                    maxLatency: Math.round(maxLatency * 100) / 100,
                                    latencyVariance: Math.round(variance * 100) / 100,
                                    packetLoss: packetLoss !== null ? Math.round(packetLoss * 100) / 100 : null,
                                    consecutivePongMisses: quality.consecutivePongMisses || 0,
                                    isHealthy: quality.isHealthy !== false,
                                    pingCount: pingCount,
                                    pongCount: latencyArray.length,
                                    measuredAt: new Date()
                                };
                                
                                console.log(`📊 [${stateManager.callSid}] WebSocket metrics saved: avgLatency=${updateData.websocketMetrics.avgLatency}ms, packetLoss=${updateData.websocketMetrics.packetLoss}%`);
                            }
                        }
                    
                    const consent = consentSnapshot;
                    const consentGiven = consent?.given !== false;
                    if (fromSnapshot) updateData.from = fromSnapshot;
                    if (toSnapshot) updateData.to = toSnapshot;
                    updateData.recordingConsent = consentGiven ? {
                        requested: consent?.requested || false,
                        given: true,
                        requestedAt: consent?.requestedAt || null,
                        respondedAt: consent?.respondedAt || new Date(),
                        optOutReason: null
                    } : {
                        requested: consent?.requested || false,
                        given: false,
                        requestedAt: consent?.requestedAt || null,
                        respondedAt: consent?.respondedAt || null,
                        optOutReason: consent?.optOutReason || "Consent not given"
                    };
                    if (consentGiven) {
                        updateData.provenance = await getProvenanceForCall(stateManager.callSid);
                        if (!updateData.summary && transcriptSnapshot.length > 0) {
                            try {
                                const summaryService = (await import('../../services/summaryService.js')).default;
                                const summary = await summaryService.generateCallSummary(
                                    transcriptSnapshot,
                                    { callSid: stateManager.callSid, from: fromSnapshot, to: toSnapshot }
                                );
                                updateData.summary = typeof summary === 'object' && summary !== null ? JSON.stringify(summary) : summary;
                            } catch (summaryError) {
                                console.warn(`⚠️ [${stateManager.callSid}] Could not generate summary:`, summaryError.message);
                                updateData.summary = `Call transcript with ${transcriptSnapshot.length} exchanges.`;
                            }
                        }
                    } else {
                        updateData.summary = "Recording and transcript not stored - consent not given";
                    }
                    
                    await CallRecord.findOneAndUpdate(
                        { callSid: stateManager.callSid },
                        updateData,
                        { upsert: true }
                    );
                    if (stateManager.callSid && conversations[stateManager.callSid]) {
                        delete conversations[stateManager.callSid];
                    }
                } catch (dbError) {
                    console.error(`❌ [${stateManager.callSid}] Error updating CallRecord:`, dbError);
                }
                
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
