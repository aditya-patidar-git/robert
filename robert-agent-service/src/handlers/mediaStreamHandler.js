import { WebSocket } from "ws";
import { spawn } from "child_process";
import { conversations, realtimeClients } from "../shared/state.js";
import { convertMulawToPcm16, convertPcm16ToMulaw } from "../utils/audioConversion.js";
import configManager from "../agent/configManager.js";
import toolExecutor from "../tools/index.js";
import audioCalibrationService from "../services/audioCalibrationService.js";
import crossCallMemoryService from "../services/crossCallMemoryService.js";
import multilingualService from "../services/multilingualService.js";
import toolOrchestrator from "../services/toolOrchestrator.js";
import kbaService from "../services/kbaService.js";
import complaintDetectionService from "../services/complaintDetectionService.js";

// Media Stream WebSocket Handler for Realtime API
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

// Handle WebSocket connection for Media Streams with dynamic config
export const handleMediaStreamConnection = (ws, req) => {
    try {
        console.log('🔌 [DEBUG] Media Stream WebSocket connection received');
        console.log('🔌 [DEBUG] WebSocket type:', typeof ws);
        console.log('🔌 [DEBUG] WebSocket readyState:', ws?.readyState, '(OPEN=1, CLOSING=2, CLOSED=3)');
        console.log('🔌 [DEBUG] Request object:', req ? 'present' : 'missing');
        
        // Add validation
        if (!ws) {
            console.error('❌ [DEBUG] WebSocket is null or undefined');
            return;
        }
        
        if (ws.readyState !== WebSocket.OPEN && ws.readyState !== 0) {
            console.warn(`⚠️ [DEBUG] WebSocket not in OPEN state: ${ws.readyState}`);
        }
        
        console.log('🔌 Media Stream WebSocket connection received');
        
        let callSid = null;
    let streamSid = null;
    let phoneNumber = null;
    let openaiWs = null;
    let openaiReady = false;
    let setupComplete = false;
    let isClosed = false;
    let accepting = true;
    
    const MAX_CALL_DURATION_MS = 3600000; // 1 hour max
    const MAX_ERROR_COUNT = 5;
    const MAX_AUDIO_BUFFER_SIZE = 100;
    
    let errorCount = 0;
    let audioChunkCount = 0;
    let audioChunkWarningLogged = false; // Track if we've already logged the warning for this threshold breach
    let callStartTime = Date.now();
    let startTimeout = null;
    let durationTimer = null;
    let isResponding = false;
    let waitingForUser = true;
    let lastUserTranscript = null;
    
    // Response tracking for barge-in
    let activeResponseId = null;
    let responseItemId = null;
    let responseStartTime = null;
    let lastCancellationTime = 0; // Track when we last cancelled a response
    let explicitResponseRequested = false; // Track if we explicitly requested a response
    let cancelledResponseIds = new Set(); // Track cancelled response IDs to block their audio
    let cancellationTime = new Map(); // Track when each response was cancelled (for grace period)
    const AUDIO_CANCELLATION_GRACE_PERIOD = 2000; // 2 seconds grace period to block audio after cancellation
    let lastAudioChunkTime = 0; // Track when we last received an audio chunk
    const AUDIO_PLAYBACK_GRACE_PERIOD = 1500; // 1.5 seconds after last audio chunk before considering playback stopped
    
    // Interruption state tracking
    let isInterrupted = false; // Boolean flag tracking active interruption
    let interruptionStartTime = 0; // Timestamp when interruption began
    let pendingTranscriptions = []; // Array to queue transcriptions during interruption
    let lastProcessedTranscriptionTime = 0; // Timestamp of last processed transcription
    let lastTranscriptionReceivedTime = 0; // Track when we last received a transcription (to distinguish barge-in from normal input)
    let agentFinishedSpeakingTime = 0; // Track when agent finished speaking (for 5-6 second user speaking window)
    const USER_SPEAKING_WINDOW_MS = 6000; // 6 second window for user to speak after agent finishes
    let userSpeechStartedTime = 0; // Track when user speech started (to distinguish barge-in from normal input)
    
    // Initial greeting tracking
    let hasInitialGreetingBeenSent = false;
    let hasInitialGreetingCompleted = false;
    
    // Recording consent tracking
    let recordingConsentState = {
        requested: false,
        given: null, // null = not yet responded, true = consented, false = declined
        requestedAt: null,
        respondedAt: null
    };
    let consentTimeout = null;
    const CONSENT_TIMEOUT_MS = 10000; // 10 seconds to respond to consent question
    
    // Tool execution tracking
    const pendingToolCalls = new Map(); // call_id -> { name, arguments, startTime }
    
    // VAD Calibration tracking
    let calibrationSamples = []; // Array to store initial audio samples for calibration
    let calibrationStartTime = null; // When calibration period started
    let calibrationComplete = false; // Whether calibration has been completed
    let calibratedThreshold = null; // The calibrated threshold value
    const CALIBRATION_DURATION_MS = 3000; // 3 seconds of audio for calibration
    
    // Audio quality metrics
    const audioMetrics = {
        incomingTimestamps: [],
        outgoingTimestamps: [],
        responseTimestamps: [],
        expectedChunks: 0,
        receivedChunks: 0,
        lastIncomingTime: null,
        lastOutgoingTime: null,
        lastResponseTime: null
    };
    
    // Twilio frame pacing and buffering
    const FRAME_BYTES = 160;
    class ByteQueue {
        constructor(maxBytes) {
            this.chunks = [];
            this.total = 0;
            this.maxBytes = maxBytes;
        }
        push(buf) {
            if (!buf || buf.length === 0) return;
            this.chunks.push(buf);
            this.total += buf.length;
            while (this.total > this.maxBytes && this.chunks.length > 0) {
                const dropped = this.chunks.shift();
                this.total -= dropped.length;
            }
        }
        shiftN(n) {
            if (this.total < n) return null;
            const out = Buffer.allocUnsafe(n);
            let copied = 0;
            while (copied < n) {
                const chunk = this.chunks[0];
                const toCopy = Math.min(chunk.length, n - copied);
                chunk.copy(out, copied, 0, toCopy);
                copied += toCopy;
                if (toCopy === chunk.length) {
                    this.chunks.shift();
                } else {
                    this.chunks[0] = chunk.slice(toCopy);
                }
            }
            this.total -= n;
            return out;
        }
        clear() {
            this.chunks = [];
            this.total = 0;
        }
    }
    const ulawQueue = new ByteQueue(6400);
    let pacer = null;
    let lastSendTs = Date.now();
    
    const startPacer = () => {
        if (pacer) return;
        const tick = () => {
            if (isClosed || !accepting) {
                pacer = setTimeout(tick, 20);
                return;
            }
            
            if (!ws || ws.readyState !== WebSocket.OPEN || !streamSid) {
                pacer = setTimeout(tick, 20);
                return;
            }
            
            const now = Date.now();
            const elapsed = now - lastSendTs;
            if (elapsed >= 20) {
                const frame = ulawQueue.shiftN(FRAME_BYTES);
                if (frame) {
                    try {
                        ws.send(JSON.stringify({
                            event: 'media',
                            streamSid,
                            track: 'outbound',
                            media: { payload: frame.toString('base64') }
                        }));
                    } catch (err) {
                        console.error(`❌ Failed to send frame: ${err.message}`);
                    }
                }
                lastSendTs = now;
            }
            pacer = setTimeout(tick, Math.max(0, 20 - (Date.now() - lastSendTs)));
        };
        pacer = setTimeout(tick, 20);
    };
    
    // ffmpeg resamplers
    let downFfmpeg = null;
    let upFfmpeg = null;
    
    const startDownsampler = () => {
        if (downFfmpeg) return;
        downFfmpeg = spawn('ffmpeg', [
            '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', 'pipe:0',
            '-f', 's16le', '-ar', '8000', '-ac', '1', 'pipe:1'
        ]);
        downFfmpeg.stdout.on('data', (chunk) => {
            if (isClosed || !accepting) return;
            const base64Pcm8k = chunk.toString('base64');
            
            // Capture audio samples for VAD calibration (first 3 seconds)
            if (!calibrationComplete) {
                const audioConfig = configManager.getAudioConfig();
                if (audioConfig?.energyThresholdAutoCalibrate !== false) {
                    const pcm16Buffer = Buffer.from(base64Pcm8k, 'base64');
                    if (!calibrationStartTime) {
                        calibrationStartTime = Date.now();
                        console.log(`📊 [${callSid}] Starting VAD calibration - capturing ${CALIBRATION_DURATION_MS}ms of audio`);
                    }
                    
                    const elapsed = Date.now() - calibrationStartTime;
                    if (elapsed < CALIBRATION_DURATION_MS) {
                        calibrationSamples.push(pcm16Buffer);
                    } else if (!calibrationComplete) {
                        // Calibration period complete - perform calibration
                        performCalibration();
                    }
                } else {
                    // Calibration disabled - mark as complete
                    calibrationComplete = true;
                }
            }
            
            const mulawBase64 = convertPcm16ToMulaw(base64Pcm8k);
            const pushed = Buffer.from(mulawBase64, 'base64');
            ulawQueue.push(pushed);
            startPacer();
        });
        downFfmpeg.on('close', () => { downFfmpeg = null; });
        downFfmpeg.on('error', (err) => console.error('❌ ffmpeg downsampler error:', err));
    };
    
    // Perform VAD calibration after capturing initial audio samples
    const performCalibration = () => {
        if (calibrationComplete || !openaiWs || openaiWs.readyState !== WebSocket.OPEN) {
            return;
        }
        
        try {
            const audioConfig = configManager.getAudioConfig();
            const baseThreshold = (configManager.getConfigForNumber(phoneNumber).vadThreshold || 500) / 1000; // Convert ms to seconds
            
            const calibrated = audioCalibrationService.calibrateEnergyThreshold(
                callSid,
                calibrationSamples,
                baseThreshold
            );
            
            calibratedThreshold = calibrated;
            calibrationComplete = true;
            
            // Update session with calibrated threshold
            openaiWs.send(JSON.stringify({
                type: 'session.update',
                session: {
                    turn_detection: {
                        type: 'server_vad',
                        threshold: calibrated,
                        prefix_padding_ms: configManager.getConfigForNumber(phoneNumber).startPadding || 250,
                        silence_duration_ms: configManager.getConfigForNumber(phoneNumber).endPadding || 500
                    }
                }
            }));
            
            console.log(`✅ [${callSid}] VAD calibration complete - threshold updated to ${calibrated.toFixed(3)}s`);
            
            // Clear calibration samples to free memory
            calibrationSamples = [];
        } catch (err) {
            console.error(`❌ [${callSid}] Error during VAD calibration:`, err);
            // Continue with base threshold if calibration fails
            calibrationComplete = true;
        }
    };
    
    const startUpsampler = () => {
        if (upFfmpeg) return;
        upFfmpeg = spawn('ffmpeg', [
            '-f', 's16le', '-ar', '8000', '-ac', '1', '-i', 'pipe:0',
            '-f', 's16le', '-ar', '24000', '-ac', '1', 'pipe:1'
        ]);
        upFfmpeg.stdout.on('data', (chunk) => {
            if (isClosed || !accepting) return;
            const base64Pcm24k = chunk.toString('base64');
            if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                try {
                    openaiWs.send(JSON.stringify({
                        type: 'input_audio_buffer.append',
                        audio: base64Pcm24k
                    }));
                } catch (_) {}
            }
        });
        upFfmpeg.on('close', () => { upFfmpeg = null; });
        upFfmpeg.on('error', (err) => console.error('❌ ffmpeg upsampler error:', err));
    };
    
    const cleanup = async (reason = 'unknown') => {
        if (isClosed) return;
        isClosed = true;
        accepting = false;
        
        console.log(`🧹 Cleaning up call ${callSid} - reason: ${reason}`);
        
        if (openaiWs) {
            openaiWs.removeAllListeners();
            if (openaiWs.readyState === WebSocket.OPEN) {
                // Clear conversation state before closing to prevent buffer persistence
                try {
                    openaiWs.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
                    openaiWs.send(JSON.stringify({ type: 'session.cancel' }));
                } catch (err) {
                    console.warn(`⚠️ [${callSid}] Error clearing state during cleanup:`, err.message);
                }
                openaiWs.close(1000, 'Call ended');
            }
        }
        
        if (ws) {
            ws.removeAllListeners();
            if (ws.readyState === WebSocket.OPEN) {
                ws.close(1000, 'Call ended');
            }
        }
        
        if (durationTimer) clearTimeout(durationTimer);
        if (startTimeout) clearTimeout(startTimeout);
        if (consentTimeout) clearTimeout(consentTimeout);
        if (pacer) { clearTimeout(pacer); pacer = null; }
        ulawQueue.clear();
        try { if (downFfmpeg) downFfmpeg.kill('SIGKILL'); } catch (_) {}
        try { if (upFfmpeg) upFfmpeg.kill('SIGKILL'); } catch (_) {}
        
        if (callSid) {
            delete realtimeClients[callSid];
            delete conversations[callSid];
            pendingToolCalls.clear();
        }
    };
    
    durationTimer = setTimeout(() => {
        console.error(`⏰ Maximum call duration reached for ${callSid}`);
        cleanup('max_duration');
    }, MAX_CALL_DURATION_MS);
    
    const messageHandler = async (data) => {
        if (isClosed) {
            console.log('🔌 [DEBUG] Message received but connection is closed');
            return;
        }
        
        try {
            const json = JSON.parse(data.toString());
            console.log('🔌 [DEBUG] Received message event:', json.event);
            
            if (json.event === 'start') {
                console.log('🔌 [DEBUG] Start event received, parsing...');
                callSid = json.start?.callSid;
                streamSid = json.start?.streamSid;
                phoneNumber = json.start?.callSidTo || json.start?.from || 'unknown';
                
                // Fix: Check if phoneNumber is already in conversations (from status callback)
                if (phoneNumber === 'unknown' && callSid && conversations[callSid]?.from) {
                    phoneNumber = conversations[callSid].from;
                    console.log(`📞 [${callSid}] Updated phoneNumber from conversations: ${phoneNumber}`);
                }
                
                // Fix: If still unknown, try to get from CallRecord in database
                if (phoneNumber === 'unknown' && callSid) {
                    try {
                        const CallRecord = (await import('../../database/models/CallRecord.js')).default;
                        const callRecord = await CallRecord.findOne({ callSid }).lean();
                        if (callRecord?.from) {
                            phoneNumber = callRecord.from;
                            console.log(`📞 [${callSid}] Updated phoneNumber from CallRecord: ${phoneNumber}`);
                            // Update conversations for future reference
                            if (!conversations[callSid]) {
                                conversations[callSid] = { transcript: [] };
                            }
                            conversations[callSid].from = phoneNumber;
                        }
                    } catch (err) {
                        console.warn(`⚠️ [${callSid}] Could not fetch phoneNumber from CallRecord:`, err.message);
                    }
                }
                
                console.log('🔌 [DEBUG] Parsed start event:', { callSid, streamSid, phoneNumber });
                
                if (!callSid) {
                    console.error('❌ No callSid in start event');
                    console.error('❌ [DEBUG] Full start event:', JSON.stringify(json, null, 2));
                    cleanup('no_callsid');
                    return;
                }
                
                console.log(`📞 Start event - callSid: ${callSid}, phoneNumber: ${phoneNumber}`);
                callStartTime = Date.now();
                
                console.log('🔌 [DEBUG] Removing message handler and setting up OpenAI...');
                ws.removeListener('message', messageHandler);
                setupOpenAI();
            } else {
                console.log('🔌 [DEBUG] Non-start event received:', json.event);
            }
        } catch (err) {
            errorCount++;
            console.error('❌ Error parsing message:', err);
            console.error('❌ [DEBUG] Raw message data:', data.toString().substring(0, 200));
            if (errorCount >= MAX_ERROR_COUNT) {
                cleanup('max_errors');
            }
        }
    };
    
    ws.on('message', messageHandler);
    
    // Add error handler early
    ws.on('error', (err) => {
        console.error('❌ [DEBUG] Twilio WebSocket error (early):', err);
        errorCount++;
        if (errorCount >= MAX_ERROR_COUNT) {
            cleanup('twilio_error_early');
        }
    });
    
    ws.on('close', (code, reason) => {
        console.log(`🔌 [DEBUG] Twilio WebSocket closed - code: ${code}, reason: ${reason}`);
        if (!isClosed) {
            cleanup('twilio_close_early');
        }
    });
    
    startTimeout = setTimeout(() => {
        if (!setupComplete) {
            console.error('❌ Timeout waiting for start event');
            console.error('❌ [DEBUG] WebSocket state at timeout:', ws.readyState);
            console.error('❌ [DEBUG] isClosed:', isClosed);
            cleanup('start_timeout');
        }
    }, 10000);
    
    // Check for previous call memories and request consent if needed
    async function checkAndRequestMemoryConsent() {
        try {
            if (!phoneNumber || !callSid) return;
            
            const hasPreviousCalls = await crossCallMemoryService.requestConsentForMemory(callSid, phoneNumber);
            
            if (hasPreviousCalls) {
                // Get memory summary
                const memorySummary = await crossCallMemoryService.getMemorySummary(phoneNumber);
                
                if (memorySummary) {
                    // Mark memory consent as requested
                    conversations[callSid].memoryConsent.requested = true;
                    conversations[callSid].memoryConsent.requestedAt = new Date();
                    
                    // Inject instruction to ask for consent, but don't inject full memory yet
                    // The AI will ask: "Shall I pick up from our last conversation about [topic]?"
                    const memoryConsentInstruction = `\n\nIMPORTANT: You have previous interaction history with this caller. You should ask for their consent before referencing it. Say something like: "Shall I pick up from our last conversation about [brief topic]?" Only reference previous interactions if they consent.`;
                    
                    if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                        // Get current instructions and append memory consent instruction
                        const currentLanguage = conversations[callSid]?.language || 'en';
                        const currentConfig = configManager.getConfigForNumber(phoneNumber, currentLanguage);
                        const updatedInstructions = currentConfig.instructions + memoryConsentInstruction;
                        
                        openaiWs.send(JSON.stringify({
                            type: 'session.update',
                            session: {
                                instructions: updatedInstructions
                            }
                        }));
                        
                        console.log(`📚 [${callSid}] Memory consent prompt instruction injected for caller ${phoneNumber}`);
                    }
                }
            }
        } catch (error) {
            console.error(`❌ [${callSid}] Error checking memory consent:`, error);
            // Don't block call if memory check fails
        }
    }
    
    // Switch language and update OpenAI session
    async function switchLanguage(detectedLanguageCode) {
        try {
            if (!callSid || !openaiWs || openaiWs.readyState !== WebSocket.OPEN) {
                return false;
            }
            
            // Validate language
            if (!multilingualService.isValidLanguage(detectedLanguageCode)) {
                console.warn(`⚠️ [${callSid}] Invalid language code: ${detectedLanguageCode}`);
                return false;
            }
            
            // Get language config
            const languageConfig = multilingualService.getLanguageConfig(detectedLanguageCode);
            const languageInstructions = multilingualService.getSystemInstructions(detectedLanguageCode);
            
            // Update conversation state
            if (conversations[callSid]) {
                conversations[callSid].language = detectedLanguageCode;
                conversations[callSid].locale = languageConfig.code;
            }
            
            // Get updated config with new language
            const config = configManager.getConfigForNumber(phoneNumber, detectedLanguageCode);
            
            // Update OpenAI session with new language and voice
            openaiWs.send(JSON.stringify({
                type: 'session.update',
                session: {
                    voice: languageConfig.voice,
                    instructions: config.instructions
                }
            }));
            
            console.log(`🌐 [${callSid}] Language switched to ${languageConfig.name} (${languageConfig.code}) with voice ${languageConfig.voice}`);
            return true;
        } catch (error) {
            console.error(`❌ [${callSid}] Error switching language:`, error);
            return false;
        }
    }
    
    // Detect and switch language from user transcription
    function detectAndSwitchLanguage(transcript) {
        if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
            return;
        }
        
        // Only detect language after initial greeting is completed
        if (!hasInitialGreetingCompleted) {
            return;
        }
        
        // Get current language
        const currentLanguage = conversations[callSid]?.language || 'en';
        
        // Skip if already in the detected language
        if (currentLanguage !== 'en') {
            return; // Already switched, don't re-detect
        }
        
        // Detect language from transcript
        const detectedLanguage = multilingualService.detectLanguage(transcript);
        
        // If detected language is different from current (and not English), switch
        if (detectedLanguage !== currentLanguage && detectedLanguage !== 'en') {
            console.log(`🌐 [${callSid}] Language detected: ${detectedLanguage} from transcript: "${transcript.substring(0, 50)}..."`);
            switchLanguage(detectedLanguage);
        } else if (detectedLanguage === 'en' && currentLanguage === 'en') {
            // Low confidence - ask for confirmation if we're not sure
            // This will be handled by the AI's instructions to ask "Would you like me to continue in English, or [language]?"
            console.log(`🌐 [${callSid}] Language detection inconclusive, keeping English`);
        }
    }
    
    // Inject full memory context after user consents
    async function injectMemoryContext() {
        try {
            if (!phoneNumber || !callSid) return;
            
            const memorySummary = await crossCallMemoryService.getMemorySummary(phoneNumber);
            
            if (memorySummary && openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                const memoryContext = `\n\nPREVIOUS INTERACTION CONTEXT (user has consented to use this): ${memorySummary}\nYou may now reference this context naturally in the conversation.`;
                
                const currentConfig = configManager.getConfigForNumber(phoneNumber);
                const updatedInstructions = currentConfig.instructions + memoryContext;
                
                openaiWs.send(JSON.stringify({
                    type: 'session.update',
                    session: {
                        instructions: updatedInstructions
                    }
                }));
                
                console.log(`📚 [${callSid}] Full memory context injected after consent for caller ${phoneNumber}`);
            }
        } catch (error) {
            console.error(`❌ [${callSid}] Error injecting memory context:`, error);
        }
    }
    
    async function setupOpenAI() {
        if (setupComplete || isClosed) return;
        setupComplete = true;
        clearTimeout(startTimeout);
        
        try {
            console.log(`🚀 Setting up OpenAI connection for call: ${callSid}`);
            
            if (!process.env.OPENAI_API_KEY) {
                console.error('❌ OPENAI_API_KEY is missing');
                cleanup('missing_api_key');
                return;
            }
            
            // Get dynamic config for this phone number (with current language)
            const currentLanguage = conversations[callSid]?.language || 'en';
            const config = configManager.getConfigForNumber(phoneNumber, currentLanguage);
            console.log('📋 Using config:', {
                voice: config.voice.id,
                temperature: config.temperature,
                confidence: config.confidenceThreshold
            });
            
            // Initialize conversation state with recording consent tracking
            if (!conversations[callSid]) {
                conversations[callSid] = { 
                    transcript: [], 
                    language: 'en-US', 
                    realtimeWs: ws,
                    from: phoneNumber,
                    to: phoneNumber,
                    recordingConsent: {
                        requested: false,
                        given: null,
                        requestedAt: null,
                        respondedAt: null
                    },
                    memoryConsent: {
                        requested: false,
                        given: null,
                        requestedAt: null,
                        respondedAt: null
                    },
                    kba: {
                        verified: false,
                        method: null,
                        verifiedAt: null,
                        otpVerified: false,
                        otpVerifiedAt: null,
                        email: null,
                        postcode: null,
                        bookingReference: null
                    }
                };
            } else {
                // Ensure recordingConsent, memoryConsent, and kba exist even if conversations[callSid] was created elsewhere
                if (!conversations[callSid].recordingConsent) {
                    conversations[callSid].recordingConsent = {
                        requested: false,
                        given: null,
                        requestedAt: null,
                        respondedAt: null
                    };
                }
                if (!conversations[callSid].memoryConsent) {
                    conversations[callSid].memoryConsent = {
                        requested: false,
                        given: null,
                        requestedAt: null,
                        respondedAt: null
                    };
                }
                if (!conversations[callSid].kba) {
                    conversations[callSid].kba = {
                        verified: false,
                        method: null,
                        verifiedAt: null,
                        otpVerified: false,
                        otpVerifiedAt: null,
                        email: null,
                        postcode: null,
                        bookingReference: null
                    };
                }
                // Ensure other required properties exist
                if (!conversations[callSid].transcript) {
                    conversations[callSid].transcript = [];
                }
                if (!conversations[callSid].language) {
                    conversations[callSid].language = 'en-US';
                }
                if (!conversations[callSid].realtimeWs) {
                    conversations[callSid].realtimeWs = ws;
                }
                if (!conversations[callSid].from) {
                    conversations[callSid].from = phoneNumber;
                }
                if (!conversations[callSid].to) {
                    conversations[callSid].to = phoneNumber;
                }
            }
            
            // Add recording consent notice and question to instructions
            const privacyConfig = await import('../../database/models/PrivacyConfig.js').then(m => m.default).catch(() => null);
            let privacySettings = null;
            if (privacyConfig) {
                privacySettings = await privacyConfig.findOne({ isActive: true }).lean().catch(() => null);
            }
            
            const requireExplicitConsent = privacySettings?.recording?.requireExplicitConsent !== false;
            const consentNotice = privacySettings?.consentScript || "For training and quality, this call may be recorded and handled in line with our Privacy Policy.";
            const consentQuestion = "Do you consent to this call being recorded?";
            
            // Modify instructions to include recording consent flow at the start
            let modifiedInstructions = config.instructions;
            if (requireExplicitConsent) {
                modifiedInstructions = `IMPORTANT: You must start every call with the following exact sequence:
1. First, say: "${consentNotice}"
2. Then immediately ask: "${consentQuestion}"
3. Wait for the caller's response (yes, no, or silence)
4. After they respond, continue with: "Hello, you're through to Universal Motorcycle Training. This is Robert. What language would you like to use today?"

${config.instructions}`;
                
                // Mark consent as requested
                recordingConsentState.requested = true;
                recordingConsentState.requestedAt = new Date();
                conversations[callSid].recordingConsent.requested = true;
                conversations[callSid].recordingConsent.requestedAt = new Date();
            }
            
            const openaiUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview';
            openaiWs = new WebSocket(openaiUrl, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'OpenAI-Beta': 'realtime=v1'
                }
            });
            
            realtimeClients[callSid] = { twilioWs: ws, openaiWs, streamSid };
            // conversations[callSid] is already initialized above with recordingConsent and memoryConsent
            // Just ensure transcript and language are set if they weren't already
            if (!conversations[callSid].transcript) {
                conversations[callSid].transcript = [];
            }
            if (!conversations[callSid].language) {
                conversations[callSid].language = 'en-US';
            }
            if (!conversations[callSid].realtimeWs) {
                conversations[callSid].realtimeWs = ws;
            }
            
            const openaiTimeout = setTimeout(() => {
                if (!openaiReady && !isClosed) {
                    console.error(`❌ OpenAI connection timeout for call: ${callSid}`);
                    cleanup('openai_timeout');
                }
            }, 30000);
            
            openaiWs.on('error', (err) => {
                console.error(`❌ OpenAI WebSocket ERROR for call ${callSid}:`, err);
                errorCount++;
                if (errorCount >= MAX_ERROR_COUNT) {
                    cleanup('openai_error');
                }
            });
            
            openaiWs.on('open', () => {
                if (isClosed) return;
                clearTimeout(openaiTimeout);
                console.log(`✅ OpenAI connected for call: ${callSid}`);
                openaiReady = true;
                
                try {
                    // Get tool definitions
                    const tools = toolExecutor.getToolDefinitions();
                    
                    // CRITICAL: Clear any existing conversation state and audio buffer
                    // This prevents old queries from previous calls being answered
                    try {
                        openaiWs.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
                        console.log(`🧹 [${callSid}] Cleared input audio buffer at session start`);
                    } catch (err) {
                        console.warn(`⚠️ [${callSid}] Could not clear audio buffer at start:`, err.message);
                    }
                    
                    // Get audio config for calibration check
                    const audioConfig = configManager.getAudioConfig();
                    
                    // Use base threshold initially (will be updated after calibration if enabled)
                    const initialThreshold = config.vadThreshold / 1000; // Convert ms to seconds
                    
                    // Apply dynamic config to OpenAI session
                    openaiWs.send(JSON.stringify({
                        type: 'session.update',
                        session: {
                            modalities: ['audio', 'text'],
                            instructions: modifiedInstructions || config.instructions,
                            voice: config.voice.id,
                            temperature: Math.max(0.6, config.temperature), // Minimum is 0.6 for Realtime API
                            input_audio_format: 'g711_ulaw',
                            output_audio_format: 'g711_ulaw',
                            turn_detection: {
                                type: 'server_vad',
                                threshold: initialThreshold,
                                prefix_padding_ms: config.startPadding,
                                silence_duration_ms: config.endPadding
                            },
                            tools: tools,
                            tool_choice: 'auto'
                        }
                    }));
                    console.log(`📤 Sent session.update with config and ${tools.length} tools for call: ${callSid}`);
                    if (audioConfig?.energyThresholdAutoCalibrate !== false) {
                        console.log(`📊 [${callSid}] VAD auto-calibration enabled - will calibrate after ${CALIBRATION_DURATION_MS}ms of audio`);
                    }
                } catch (err) {
                    errorCount++;
                    console.error('❌ Error sending session.update:', err);
                    if (errorCount >= MAX_ERROR_COUNT) {
                        cleanup('send_error');
                    }
                }
            });
            
            openaiWs.on('message', (data) => {
                if (isClosed) return;
                
                try {
                    const event = JSON.parse(data.toString());
                    
                    if (event.type === 'error') {
                        const errorCode = event.error?.code;
                        const errorMessage = event.error?.message || '';
                        
                        // Don't treat these as critical errors - they're expected in some scenarios
                        const nonCriticalErrors = [
                            'response_cancel_not_active',      // Response already cancelled (race condition)
                            'missing_required_parameter'       // Truncate API issues (non-critical, truncate is optional)
                        ];
                        
                        if (nonCriticalErrors.some(code => errorCode === code || errorMessage.includes(code))) {
                            console.warn(`⚠️ [${callSid}] Non-critical OpenAI error (ignoring):`, event.error);
                            return; // Don't increment errorCount for these
                        }
                        
                        // Critical errors - increment counter
                        errorCount++;
                        console.error(`❌ OpenAI error for call ${callSid}:`, event.error);
                        if (errorCount >= MAX_ERROR_COUNT) {
                            cleanup('openai_error');
                        }
                        return;
                    }
                    
                    if (event.type === 'session.updated') {
                        console.log(`✅ Session updated for call: ${callSid}`);
                        errorCount = 0;
                        
                        // Send initial greeting immediately (no delay)
                        if (isClosed || !openaiWs || openaiWs.readyState !== WebSocket.OPEN) {
                            return;
                        }
                        // Only create initial greeting if not already sent and not already responding
                        if (!hasInitialGreetingBeenSent && !isResponding && activeResponseId === null) {
                            try {
                                explicitResponseRequested = true; // Mark this as an explicit request
                                openaiWs.send(JSON.stringify({
                                    type: 'response.create',
                                    response: {
                                        modalities: ['audio', 'text']
                                    }
                                }));
                                hasInitialGreetingBeenSent = true;
                                isResponding = true; // Set flag before creating response
                                console.log(`🎯 [${callSid}] Initial greeting sent immediately`);
                                
                                // Set timeout for consent response (if consent was requested)
                                if (recordingConsentState.requested && recordingConsentState.given === null) {
                                    consentTimeout = setTimeout(() => {
                                        if (recordingConsentState.given === null) {
                                            // No response - default to opt-out for GDPR safety
                                            recordingConsentState.given = false;
                                            recordingConsentState.respondedAt = new Date();
                                            conversations[callSid].recordingConsent.given = false;
                                            conversations[callSid].recordingConsent.respondedAt = new Date();
                                            conversations[callSid].recordingConsent.optOutReason = "No response within timeout";
                                            console.log(`⏰ [${callSid}] Recording consent timeout - defaulting to opt-out (GDPR safety)`);
                                        }
                                    }, CONSENT_TIMEOUT_MS);
                                }
                            } catch (err) {
                                explicitResponseRequested = false; // Reset if send fails
                                isResponding = false; // Reset if send fails
                                hasInitialGreetingBeenSent = false; // Reset flag
                                errorCount++;
                                console.error(`❌ [${callSid}] Error sending initial greeting:`, err);
                            }
                        } else {
                            console.log(`⚠️ [${callSid}] Skipping initial greeting - already sent: ${hasInitialGreetingBeenSent}, isResponding: ${isResponding}, activeResponseId: ${activeResponseId}`);
                        }
                    }
                    
                    // Track response creation for barge-in cancellation
                    if (event.type === 'response.created') {
                        activeResponseId = event.response?.id;
                        // Note: item_id comes from conversation.item.created, not response.created
                        responseStartTime = Date.now(); // Track when this response was created
                        
                        // Log response creation details for debugging
                        console.log(`📝 [${callSid}] Response created - ID: ${activeResponseId}, modalities: ${JSON.stringify(event.response?.modalities || [])}, isResponding: ${isResponding}`);
                        
                        // Check if response has any errors or warnings
                        if (event.response?.error) {
                            console.error(`❌ [${callSid}] Response created with error:`, JSON.stringify(event.response.error, null, 2));
                        }
                        
                        // CRITICAL: Block automatic responses that we didn't explicitly request
                        // BUT: Distinguish between barge-in (block) and normal user input (allow)
                        if (!explicitResponseRequested) {
                            const currentTime = Date.now();
                            const timeSinceTranscription = lastTranscriptionReceivedTime > 0 ? currentTime - lastTranscriptionReceivedTime : Infinity;
                            const timeSinceAgentFinished = agentFinishedSpeakingTime > 0 ? currentTime - agentFinishedSpeakingTime : Infinity;
                            // Validate times are reasonable (not negative or extremely large)
                            const isRecentTranscription = lastTranscriptionReceivedTime > 0 && timeSinceTranscription >= 0 && timeSinceTranscription < 3000; // 3 second window
                            const isWithinUserSpeakingWindow = agentFinishedSpeakingTime > 0 && timeSinceAgentFinished >= 0 && timeSinceAgentFinished < USER_SPEAKING_WINDOW_MS; // 6 second window
                            
                            // Log warning if transcription time seems invalid
                            if (lastTranscriptionReceivedTime > 0 && (timeSinceTranscription < 0 || timeSinceTranscription > 3600000)) {
                                console.warn(`⚠️ [${callSid}] Suspicious transcription timing: timeSinceTranscription=${timeSinceTranscription}ms, lastTranscriptionReceivedTime=${lastTranscriptionReceivedTime}, currentTime=${currentTime}`);
                            }
                            
                            // Check if user speech started before this response was created
                            const userSpokeBeforeResponse = userSpeechStartedTime > 0 && userSpeechStartedTime < responseStartTime;
                            
                            // Block automatic responses if:
                            // 1. We're in an interrupted state (barge-in scenario - user interrupted agent WHILE agent was speaking)
                            // 2. Agent is currently responding (shouldn't create new responses during active response)
                            // 3. We're waiting but no recent transcription AND outside user speaking window AND user did NOT speak before response (ghost/phantom response)
                            // NOTE: If user spoke before response, allow it even if outside speaking window (user initiated the response)
                            // NOTE: isInterrupted should ONLY be true when agent was actively speaking (isResponding was true)
                            const shouldBlock = isInterrupted || 
                                             (isResponding && activeResponseId !== event.response?.id) ||
                                             (waitingForUser && !isRecentTranscription && !isWithinUserSpeakingWindow && !userSpokeBeforeResponse);
                            
                            if (shouldBlock) {
                                console.log(`🚫 [${callSid}] Blocking automatic response (barge-in/ghost) - ID: ${activeResponseId}, isInterrupted: ${isInterrupted}, isResponding: ${isResponding}, isRecentTranscription: ${isRecentTranscription}, isWithinUserSpeakingWindow: ${isWithinUserSpeakingWindow}, userSpokeBeforeResponse: ${userSpokeBeforeResponse}, timeSinceAgentFinished: ${timeSinceAgentFinished}ms`);
                                try {
                                    openaiWs.send(JSON.stringify({
                                        type: 'response.cancel',
                                        response_id: activeResponseId
                                    }));
                                    activeResponseId = null;
                                    isResponding = false;
                                    waitingForUser = true;
                                    return; // Don't process this response
                                } catch (err) {
                                    console.warn(`⚠️ [${callSid}] Error cancelling automatic response:`, err.message);
                                }
                            } else {
                                // This is a legitimate automatic response after normal user input
                                const timeUserSpokeBefore = userSpeechStartedTime > 0 ? (responseStartTime - userSpeechStartedTime) : 0;
                                console.log(`✅ [${callSid}] Allowing automatic response after normal user input (transcription ${timeSinceTranscription}ms ago, within ${timeSinceAgentFinished}ms of agent finishing, user spoke ${timeUserSpokeBefore}ms before response)`);
                                // Don't cancel - this is OpenAI responding to user input normally
                            }
                        }
                        
                        // Reset the flag after processing
                        explicitResponseRequested = false;
                        
                        // Synchronize isResponding flag with activeResponseId to prevent race conditions
                        isResponding = true;
                        console.log(`📝 [${callSid}] Response created - ID: ${activeResponseId}, isResponding: ${isResponding}`);
                    }
                    
                    // Get item_id from conversation.item.created event
                    if (event.type === 'conversation.item.created' && event.item?.role === 'assistant') {
                        // Match this item to the active response by checking if we have an active response
                        if (activeResponseId && !responseItemId) {
                            responseItemId = event.item?.id;
                            console.log(`📝 [${callSid}] Response item created - Item ID: ${responseItemId} for response ${activeResponseId}`);
                        }
                    }
                    
                    // Handle audio output
                    if ((event.type === 'response.audio.delta' || event.type === 'response.output_audio.delta') && event.delta) {
                        isResponding = true;
                        lastAudioChunkTime = Date.now(); // Track when we last received audio
                        audioChunkCount++;
                        const responseTime = Date.now();
                        audioMetrics.responseTimestamps.push(responseTime);
                        audioMetrics.lastResponseTime = responseTime;
                        
                        // DISABLED FOR DEVELOPMENT/TESTING: Audio chunk limit check
                        // Still track the count for logging, but don't enforce limit during development
                        // Only log warning once per threshold breach to reduce log noise
                        if (audioChunkCount > MAX_AUDIO_BUFFER_SIZE * 100 && !audioChunkWarningLogged) {
                            console.warn(`⚠️ [DEV] Audio chunk count exceeded limit (${audioChunkCount} > ${MAX_AUDIO_BUFFER_SIZE * 100}), but continuing for development/testing. This warning will not repeat.`);
                            audioChunkWarningLogged = true;
                            // cleanup('audio_limit'); // DISABLED FOR DEVELOPMENT
                            // return; // DISABLED FOR DEVELOPMENT
                        }
                        
                        // CRITICAL: Get response ID from event if available, otherwise use activeResponseId
                        // Note: OpenAI audio.delta events may not include response_id, so we use activeResponseId as fallback
                        const currentResponseId = event.response_id || activeResponseId;
                        
                        // CRITICAL: Block audio if:
                        // 1. We're in an interrupted state, OR
                        // 2. This response was cancelled (check both Set and grace period)
                        const isCancelledResponse = currentResponseId && cancelledResponseIds.has(currentResponseId);
                        const cancellationTimestamp = currentResponseId ? cancellationTime.get(currentResponseId) : null;
                        const timeSinceCancellation = cancellationTimestamp ? Date.now() - cancellationTimestamp : Infinity;
                        const withinGracePeriod = cancellationTimestamp && timeSinceCancellation < AUDIO_CANCELLATION_GRACE_PERIOD;
                        
                        if (isInterrupted || isCancelledResponse || (cancellationTimestamp && withinGracePeriod)) {
                            // Log first few blocked chunks to confirm it's working, then silence
                            if (audioChunkCount % 100 === 0 || audioChunkCount < 5) {
                                console.log(`🔇 [${callSid}] Blocking audio chunk #${audioChunkCount} - response interrupted/cancelled (responseId: ${currentResponseId || 'unknown'}, isInterrupted: ${isInterrupted}, isCancelled: ${isCancelledResponse}, gracePeriod: ${withinGracePeriod})`);
                            }
                            return; // Don't send audio chunks during interruption or from cancelled responses
                        }
                        
                        if (ws.readyState === WebSocket.OPEN && streamSid && !isClosed) {
                            try {
                                // Direct μ-law - no conversion needed
                                ws.send(JSON.stringify({
                                    event: 'media',
                                    streamSid,
                                    media: { payload: event.delta }
                                }));
                            } catch (err) {
                                errorCount++;
                                console.error('❌ Error sending audio to Twilio:', err);
                            }
                        }
                    }
                    
                    // Handle when response is done
                    if (event.type === 'response.done') {
                        const status = event.response?.status || 'completed';
                        const responseId = event.response?.id;
                        const error = event.response?.error;
                        
                        // Log error details if response failed
                        if (status === 'failed') {
                            console.error(`❌ [${callSid}] Response failed - ID: ${responseId}`);
                            if (error) {
                                console.error(`❌ [${callSid}] Response error details:`, JSON.stringify(error, null, 2));
                            }
                            console.error(`❌ [${callSid}] Full response.done event:`, JSON.stringify(event, null, 2));
                        } else {
                            console.log(`✅ [${callSid}] Response done - ID: ${responseId}, status: ${status}`);
                        }
                        
                        // Clean up cancelled response tracking after grace period
                        if (responseId && cancelledResponseIds.has(responseId)) {
                            // Keep in Set for a bit longer to catch any late-arriving chunks, then clean up
                            setTimeout(() => {
                                cancelledResponseIds.delete(responseId);
                                cancellationTime.delete(responseId);
                                console.log(`🧹 [${callSid}] Cleaned up cancelled response tracking for ${responseId}`);
                            }, AUDIO_CANCELLATION_GRACE_PERIOD);
                        }
                        
                        // Check if this was the initial greeting
                        const wasInitialGreeting = hasInitialGreetingBeenSent && !hasInitialGreetingCompleted;
                        // Treat "cancelled" same as "interrupted" - both mean the response was stopped
                        if (wasInitialGreeting && status !== 'interrupted' && status !== 'cancelled') {
                            hasInitialGreetingCompleted = true;
                            console.log(`✅ [${callSid}] Initial greeting completed - now waiting for user input`);
                            console.log(`👂 [${callSid}] Agent is now listening - user has ${USER_SPEAKING_WINDOW_MS/1000} seconds to speak`);
                            // CRITICAL: After initial greeting, wait for user input before creating any new responses
                            waitingForUser = true;
                            isResponding = false;
                            activeResponseId = null;
                            // Mark when agent finished speaking (for user speaking window)
                            agentFinishedSpeakingTime = Date.now();
                            
                            // Check for previous call memories and request consent if needed
                            checkAndRequestMemoryConsent();
                            
                            // Language detection will happen when user responds after greeting
                            // Set flag to enable language detection on next user input
                            conversations[callSid].languageDetectionEnabled = true;
                        }
                        
                        // Treat "cancelled" the same as "interrupted" - both indicate barge-in
                        // When we call response.cancel, OpenAI returns status "cancelled", not "interrupted"
                        // The "interrupted" status is only used when OpenAI's VAD detects speech automatically
                        if (status === 'interrupted' || status === 'cancelled') {
                            console.log(`🛑 [${callSid}] Response was interrupted/cancelled (barge-in) - status: ${status}`);
                            // Don't clear activeResponseId here - barge-in handler already cleared it
                            // Just reset flags if they weren't already reset
                            isResponding = false;
                            waitingForUser = true;
                            // CRITICAL: Do NOT clear interruption state here
                            // The interruption state must persist until speech_stopped event
                            // This allows transcriptions to be queued properly
                            console.log(`🛑 [${callSid}] Preserving interruption state (isInterrupted: ${isInterrupted}) to queue transcriptions`);
                            // NOTE: Don't set agentFinishedSpeakingTime here - this was a barge-in, not natural completion
                        } else {
                            // Response completed naturally
                            // CRITICAL: Always keep tracking active for a grace period
                            // Audio might still be playing even if chunks stopped arriving
                            // Network buffering and playback delay mean we can't rely on lastAudioChunkTime
                            // This ensures barge-in detection works even if audio is still playing
                            const responseIdForGracePeriod = responseId;
                            
                            // Fix: Check if this was an acknowledgment response (created after barge-in)
                            // If so, ensure state is fully reset after completion to allow subsequent barge-ins
                            const wasAcknowledgmentResponse = isInterrupted === false && 
                                                              activeResponseId === responseId && 
                                                              explicitResponseRequested === true;
                            
                            console.log(`⏳ [${callSid}] Response done - keeping response tracking active for ${AUDIO_PLAYBACK_GRACE_PERIOD}ms to allow barge-in detection${wasAcknowledgmentResponse ? ' (acknowledgment response)' : ''}`);
                            
                            // Always set a timer to clear after grace period
                            // This ensures barge-in detection works even if audio is still playing
                            setTimeout(() => {
                                // Only clear if this is still the active response and not interrupted
                                if (activeResponseId === responseIdForGracePeriod && !isInterrupted) {
                                    activeResponseId = null;
                                    responseItemId = null;
                                    responseStartTime = null;
                                    isResponding = false;
                                    waitingForUser = true;
                                    explicitResponseRequested = false; // Reset explicit request flag
                                    
                                    // Clear interruption state if it was somehow still set
                                    if (isInterrupted) {
                                        console.log(`⚠️ [${callSid}] Clearing lingering interruption state after natural completion`);
                                        isInterrupted = false;
                                        interruptionStartTime = 0;
                                        pendingTranscriptions = [];
                                    }
                                    
                                    // Mark when agent finished speaking (for user speaking window)
                                    agentFinishedSpeakingTime = Date.now();
                                    console.log(`👂 [${callSid}] Agent finished speaking (audio playback grace period completed) - user has ${USER_SPEAKING_WINDOW_MS/1000} seconds to speak`);
                                    
                                    // Fix: After acknowledgment response, ensure state is ready for next barge-in
                                    if (wasAcknowledgmentResponse) {
                                        console.log(`✅ [${callSid}] Acknowledgment response completed - state reset, ready for next barge-in`);
                                    }
                                } else {
                                    // Log why we didn't clear (for debugging)
                                    console.log(`⚠️ [${callSid}] Not clearing response state - activeResponseId: ${activeResponseId}, expected: ${responseIdForGracePeriod}, isInterrupted: ${isInterrupted}`);
                                }
                            }, AUDIO_PLAYBACK_GRACE_PERIOD);
                            
                            // Mark when response.done occurred (but audio might still be playing)
                            agentFinishedSpeakingTime = Date.now();
                        }
                    }
                    
                    // Handle barge-in: user speech detected during active response
                    if (event.type === 'input_audio_buffer.speech_started') {
                        // Track when user speech started
                        userSpeechStartedTime = Date.now();
                        
                        // CRITICAL: Barge-in ONLY occurs when agent is actively speaking (isResponding = true)
                        // AND user speech started AFTER the response was created
                        // If user speech started BEFORE response was created, it's normal input, not barge-in
                        // CRITICAL: Handle interruptions even if isInterrupted is already true (multiple interruptions)
                        
                        // Enhanced logging for barge-in detection debugging
                        if (activeResponseId || isResponding) {
                            console.log(`🔍 [${callSid}] Speech started - activeResponseId: ${activeResponseId}, isResponding: ${isResponding}, isInterrupted: ${isInterrupted}, responseStartTime: ${responseStartTime}`);
                        }
                        
                        if (activeResponseId && isResponding) {
                            // Check if user speech started before this response was created
                            const timeSinceResponseCreated = responseStartTime > 0 ? Date.now() - responseStartTime : Infinity;
                            const userSpokeBeforeResponse = userSpeechStartedTime < responseStartTime || timeSinceResponseCreated > 2000; // 2 second grace period
                            
                            if (userSpokeBeforeResponse) {
                                // User started speaking before response was created - this is normal input, not barge-in
                                console.log(`👤 [${callSid}] User speech started before response was created (normal input, not barge-in) - response created ${timeSinceResponseCreated}ms ago`);
                                // Don't treat as barge-in - allow the response to continue
                                return; // Exit early, don't cancel response
                            }
                        } else {
                            // Log why barge-in wasn't detected (for debugging subsequent barge-ins)
                            if (activeResponseId && !isResponding) {
                                console.log(`⚠️ [${callSid}] Speech started but barge-in not detected - activeResponseId exists but isResponding=false (response may have just completed)`);
                            } else if (!activeResponseId && isResponding) {
                                console.log(`⚠️ [${callSid}] Speech started but barge-in not detected - isResponding=true but no activeResponseId (state inconsistency?)`);
                            }
                            // If both are false/null, this is normal - agent is waiting, not responding
                            // Normal user input - agent is waiting, not responding
                            // Check if we're within the user speaking window
                            const timeSinceAgentFinished = agentFinishedSpeakingTime > 0 ? Date.now() - agentFinishedSpeakingTime : Infinity;
                            const isWithinWindow = timeSinceAgentFinished < USER_SPEAKING_WINDOW_MS;
                            
                            if (isWithinWindow) {
                                console.log(`👤 [${callSid}] User speech started (normal input - agent is waiting, user has ${Math.round((USER_SPEAKING_WINDOW_MS - timeSinceAgentFinished) / 1000)}s remaining in speaking window)`);
                            } else {
                                console.log(`👤 [${callSid}] User speech started (normal input - agent is waiting, not responding)`);
                            }
                            return; // Exit early if barge-in conditions not met
                        }
                        
                        // CRITICAL: User is interrupting an active response
                        // Handle this even if isInterrupted is already true (multiple interruptions)
                        // This ensures ANY interruption during agent response triggers the acknowledgment flow
                        const isMultipleInterruption = isInterrupted;
                        console.log(`🛑 [${callSid}] Barge-in detected! User is interrupting agent response ${activeResponseId} (agent was actively speaking)${isMultipleInterruption ? ' - multiple interruption' : ''}`);
                        
                        // Set interruption flags (even if already set - this handles multiple interruptions)
                        isInterrupted = true;
                        interruptionStartTime = Date.now();
                        pendingTranscriptions = []; // Clear any pending transcriptions
                        
                        // Save IDs before clearing
                        const responseIdToCancel = activeResponseId;
                        
                        // CRITICAL: Mark this response as cancelled BEFORE clearing activeResponseId
                        // This ensures audio from this response is blocked immediately, even if chunks arrive after cancellation
                        if (responseIdToCancel) {
                            cancelledResponseIds.add(responseIdToCancel);
                            cancellationTime.set(responseIdToCancel, Date.now());
                            console.log(`🚫 [${callSid}] Marked response ${responseIdToCancel} as cancelled - will block all audio chunks from this response`);
                        }
                        
                        // Clear response tracking immediately to prevent race conditions
                        activeResponseId = null;
                        responseItemId = null;
                        responseStartTime = null;
                        isResponding = false;
                        waitingForUser = true; // Ready to listen to interrupting speech
                        lastCancellationTime = Date.now(); // Mark when we cancelled (for stop command detection)
                        
                        try {
                            // Fix: Only cancel if this is still the active response (prevent cancellation errors)
                            if (responseIdToCancel) {
                                // Cancel the active response
                                openaiWs.send(JSON.stringify({
                                    type: 'response.cancel',
                                    response_id: responseIdToCancel
                                }));
                                console.log(`🛑 [${callSid}] Sent response.cancel for ${responseIdToCancel}${isMultipleInterruption ? ' (multiple interruption)' : ''}`);
                            } else {
                                console.log(`⚠️ [${callSid}] Skipping response.cancel - no response to cancel`);
                            }
                            
                            // Clear the input audio buffer to stop processing old audio
                            openaiWs.send(JSON.stringify({
                                type: 'input_audio_buffer.clear'
                            }));
                            console.log(`🛑 [${callSid}] Cleared input audio buffer to prevent processing old audio${isMultipleInterruption ? ' (multiple interruption)' : ''}`);
                            
                            // CRITICAL: Mark the interrupted response as completely discarded
                            // This prevents any continuation or reference to the interrupted response
                            console.log(`🗑️ [${callSid}] Discarding interrupted response ${responseIdToCancel} completely - will not continue${isMultipleInterruption ? ' (multiple interruption)' : ''}`);
                        } catch (err) {
                            // If cancel fails, log but don't treat as fatal
                            // This can happen if response already completed/cancelled
                            console.warn(`⚠️ [${callSid}] Error sending response.cancel (non-critical):`, err.message);
                        }
                    }
                    
                    // Handle user speech transcription with confidence check
                    if (event.type === 'conversation.item.input_audio_transcription.completed') {
                        const transcript = event.transcript || '';
                        const confidence = event.confidence || 1.0;
                        const transcriptionTime = Date.now();
                        console.log(`👤 User said: "${transcript}" (confidence: ${confidence})`);
                        
                        // Check for memory consent response (if consent was requested and not yet responded)
                        if (conversations[callSid]?.memoryConsent?.requested && conversations[callSid]?.memoryConsent?.given === null) {
                            const transcriptLower = transcript.toLowerCase().trim();
                            const consentKeywords = ['yes', 'yeah', 'yep', 'okay', 'ok', 'sure', 'consent', 'agree', 'fine', 'alright', 'please', 'go ahead'];
                            const declineKeywords = ['no', 'nope', "don't", 'refuse', 'decline', 'not', 'disagree', "don't want"];
                            
                            let consentDetected = false;
                            let declineDetected = false;
                            
                            for (const keyword of consentKeywords) {
                                if (transcriptLower.includes(keyword)) {
                                    consentDetected = true;
                                    break;
                                }
                            }
                            
                            for (const keyword of declineKeywords) {
                                if (transcriptLower.includes(keyword)) {
                                    declineDetected = true;
                                    break;
                                }
                            }
                            
                            if (consentDetected && !declineDetected) {
                                conversations[callSid].memoryConsent.given = true;
                                conversations[callSid].memoryConsent.respondedAt = new Date();
                                console.log(`✅ [${callSid}] Memory consent GIVEN by user`);
                                
                                // Inject full memory context now that consent is given
                                injectMemoryContext();
                            } else if (declineDetected) {
                                conversations[callSid].memoryConsent.given = false;
                                conversations[callSid].memoryConsent.respondedAt = new Date();
                                console.log(`❌ [${callSid}] Memory consent DECLINED by user`);
                            }
                        }
                        
                        // Check for recording consent response (if consent was requested and not yet responded)
                        if (recordingConsentState.requested && recordingConsentState.given === null) {
                            const transcriptLower = transcript.toLowerCase().trim();
                            const consentKeywords = ['yes', 'yeah', 'yep', 'okay', 'ok', 'sure', 'consent', 'agree', 'fine', 'alright'];
                            const declineKeywords = ['no', 'nope', "don't", 'refuse', 'decline', 'not', 'disagree'];
                            
                            let consentDetected = false;
                            let declineDetected = false;
                            
                            // Check for consent
                            for (const keyword of consentKeywords) {
                                if (transcriptLower.includes(keyword)) {
                                    consentDetected = true;
                                    break;
                                }
                            }
                            
                            // Check for decline
                            for (const keyword of declineKeywords) {
                                if (transcriptLower.includes(keyword)) {
                                    declineDetected = true;
                                    break;
                                }
                            }
                            
                            if (consentDetected && !declineDetected) {
                                recordingConsentState.given = true;
                                recordingConsentState.respondedAt = new Date();
                                conversations[callSid].recordingConsent.given = true;
                                conversations[callSid].recordingConsent.respondedAt = new Date();
                                // Clear timeout since we got a response
                                if (consentTimeout) {
                                    clearTimeout(consentTimeout);
                                    consentTimeout = null;
                                }
                                console.log(`✅ [${callSid}] Recording consent GIVEN by user`);
                            } else if (declineDetected) {
                                recordingConsentState.given = false;
                                recordingConsentState.respondedAt = new Date();
                                conversations[callSid].recordingConsent.given = false;
                                conversations[callSid].recordingConsent.respondedAt = new Date();
                                conversations[callSid].recordingConsent.optOutReason = transcript;
                                // Clear timeout since we got a response
                                if (consentTimeout) {
                                    clearTimeout(consentTimeout);
                                    consentTimeout = null;
                                }
                                console.log(`❌ [${callSid}] Recording consent DECLINED by user`);
                            }
                            // If neither detected, wait for more input (silence/unclear will default to false later)
                        }
                        
                        // Track when we received this transcription (for distinguishing barge-in from normal input)
                        const currentTime = Date.now();
                        lastTranscriptionReceivedTime = currentTime;
                        // Validate transcription time is reasonable (not in the past or far future)
                        if (lastTranscriptionReceivedTime <= 0 || lastTranscriptionReceivedTime > currentTime + 1000) {
                            console.warn(`⚠️ [${callSid}] Invalid transcription time detected: ${lastTranscriptionReceivedTime}, resetting to current time`);
                            lastTranscriptionReceivedTime = currentTime;
                        }
                        
                        // ALTERNATIVE INTERRUPTION DETECTION: If transcription arrives while agent is responding,
                        // This is a BARGE-IN scenario - user interrupted the agent WHILE agent was speaking
                        // CRITICAL: Only treat as barge-in if agent was actively responding (isResponding = true)
                        // This ensures clear distinction: barge-in = agent speaking, normal = agent waiting
                        // treat it as an interruption even if speech_started didn't fire
                        // This is critical because OpenAI's VAD may not detect speech during agent responses
                        // CRITICAL: Handle interruptions even if isInterrupted is already true (multiple interruptions)
                        if (isResponding && activeResponseId) {
                            // Check if this is a new interruption or a multiple interruption
                            const isNewInterruption = !isInterrupted;
                            const isMultipleInterruption = isInterrupted;
                            
                            if (isNewInterruption) {
                                console.log(`🛑 [${callSid}] Barge-in detected via transcription! User interrupted agent response ${activeResponseId} (agent was actively speaking)`);
                            } else {
                                console.log(`🛑 [${callSid}] Multiple interruption detected via transcription! User interrupted again during existing interruption - cancelling response ${activeResponseId}`);
                            }
                            
                            // Set interruption flags (even if already set - this handles multiple interruptions)
                            isInterrupted = true;
                            interruptionStartTime = Date.now();
                            pendingTranscriptions = [];
                            
                            // Save IDs before clearing
                            const responseIdToCancel = activeResponseId;
                            
                            // CRITICAL: Mark this response as cancelled BEFORE clearing activeResponseId
                            // This ensures audio from this response is blocked immediately, even if chunks arrive after cancellation
                            if (responseIdToCancel) {
                                cancelledResponseIds.add(responseIdToCancel);
                                cancellationTime.set(responseIdToCancel, Date.now());
                                console.log(`🚫 [${callSid}] Marked response ${responseIdToCancel} as cancelled (via transcription) - will block all audio chunks from this response`);
                            }
                            
                            // Clear response tracking immediately
                            activeResponseId = null;
                            responseItemId = null;
                            responseStartTime = null;
                            isResponding = false;
                            waitingForUser = true;
                            lastCancellationTime = Date.now();
                            
                            try {
                                // Fix: Use the saved responseIdToCancel (not activeResponseId which is now null)
                                // Always try to cancel if we had a response to cancel
                                if (responseIdToCancel) {
                                    // Cancel the active response
                                    openaiWs.send(JSON.stringify({
                                        type: 'response.cancel',
                                        response_id: responseIdToCancel
                                    }));
                                    console.log(`🛑 [${callSid}] Sent response.cancel for ${responseIdToCancel} (via transcription detection${isMultipleInterruption ? ' - multiple interruption' : ''})`);
                                } else {
                                    console.log(`⚠️ [${callSid}] No response to cancel (responseIdToCancel was null)`);
                                }
                                
                                // Clear the input audio buffer to stop processing old audio
                                openaiWs.send(JSON.stringify({
                                    type: 'input_audio_buffer.clear'
                                }));
                                console.log(`🛑 [${callSid}] Cleared input audio buffer (via transcription detection${isMultipleInterruption ? ' - multiple interruption' : ''})`);
                                
                                // CRITICAL: Mark the interrupted response as completely discarded
                                console.log(`🗑️ [${callSid}] Discarding interrupted response ${responseIdToCancel} completely (via transcription detection${isMultipleInterruption ? ' - multiple interruption' : ''})`);
                            } catch (err) {
                                console.warn(`⚠️ [${callSid}] Error cancelling response (non-critical):`, err.message);
                            }
                            
                            // CRITICAL: Queue this transcription since we detected/handled the interruption
                            // This prevents it from being processed immediately and creating unwanted responses
                            console.log(`⏸️ [${callSid}] Queuing transcription during interruption: "${transcript}"`);
                            pendingTranscriptions.push({
                                transcript,
                                confidence,
                                time: transcriptionTime
                            });
                            return; // Don't process yet - wait for speech to end
                        }
                        
                        // Check confidence threshold
                        if (config.uncertaintyGateEnabled && confidence < config.confidenceThreshold) {
                            console.log(`⚠️ Low confidence transcript (${confidence} < ${config.confidenceThreshold}), skipping response`);
                            return;
                        }
                        
                        // If we're in an interruption window, queue this transcription and wait for speech to end
                        if (isInterrupted) {
                            console.log(`⏸️ [${callSid}] Transcription received during interruption - queuing: "${transcript}"`);
                            pendingTranscriptions.push({
                                transcript,
                                confidence,
                                time: transcriptionTime
                            });
                            return; // Don't process yet - wait for speech to end
                        }
                        
                        // Check if this transcription is from before the last interruption (stale transcription)
                        if (transcriptionTime < interruptionStartTime && interruptionStartTime > 0) {
                            console.log(`🗑️ [${callSid}] Ignoring stale transcription from before interruption: "${transcript}"`);
                            return;
                        }
                        
                        // Check if this is a stop command (if we cancelled recently, user might be trying to stop)
                        const timeSinceCancellation = Date.now() - lastCancellationTime;
                        const isRecentCancellation = lastCancellationTime > 0 && timeSinceCancellation < 3000;
                        const stopCommands = /\b(stop|wait|hold on|pause|shut up|be quiet|enough|that's enough)\b/i;
                        const isStopCommand = stopCommands.test(transcript);
                        
                        if (isRecentCancellation && isStopCommand) {
                            console.log(`🛑 [${callSid}] Stop command detected after interruption: "${transcript}" - entering listening mode`);
                            waitingForUser = true;
                            lastCancellationTime = 0; // Reset
                            isInterrupted = false; // Clear interruption flag
                            interruptionStartTime = 0;
                            return; // Don't respond to stop commands
                        }
                        
                        // If we cancelled recently but it's NOT a stop command, check if still interrupted
                        // If still interrupted, queue the transcription to wait for speech_stopped
                        // This ensures transcriptions are queued even if they arrive after response.done but before speech_stopped
                        if (isRecentCancellation) {
                            if (isInterrupted) {
                                // Still in interruption window - queue this transcription
                                console.log(`⏸️ [${callSid}] Recent cancellation - queuing transcription during interruption: "${transcript}"`);
                                pendingTranscriptions.push({
                                    transcript,
                                    confidence,
                                    time: transcriptionTime
                                });
                                return; // Wait for speech_stopped to process
                            } else {
                                // Interruption state was already cleared (edge case) - process normally
                                console.log(`👂 [${callSid}] Processing interrupting speech (interruption state already cleared): "${transcript}"`);
                                lastCancellationTime = 0; // Reset after processing
                            }
                        }
                        
                        // Prevent user responses until initial greeting completes (unless this is interrupting speech)
                        if (!hasInitialGreetingCompleted && !isRecentCancellation) {
                            console.log(`⏳ [${callSid}] Waiting for initial greeting to complete before responding to: "${transcript}"`);
                            return; // Queue this input - will be processed after greeting completes
                        }
                        
                        // Add user transcription to conversation transcript
                        if (transcript && conversations[callSid]) {
                            conversations[callSid].transcript.push({
                                role: 'user',
                                text: transcript,
                                timestamp: new Date(transcriptionTime)
                            });
                            
                            // Detect and switch language if enabled (after initial greeting)
                            if (conversations[callSid].languageDetectionEnabled && hasInitialGreetingCompleted) {
                                detectAndSwitchLanguage(transcript);
                                // Disable after first detection to avoid repeated switching
                                conversations[callSid].languageDetectionEnabled = false;
                            }

                            // Monitor for complaint keywords
                            const complaintDetection = complaintDetectionService.monitorCall(callSid);
                            if (complaintDetection && complaintDetection.detected) {
                                console.log(`⚠️ [${callSid}] Complaint detected: ${complaintDetection.riskLevel} risk, type: ${complaintDetection.complaintType}`);
                                
                                // Store complaint detection in conversation state
                                if (!conversations[callSid].complaintDetected) {
                                    conversations[callSid].complaintDetected = {
                                        detected: true,
                                        riskLevel: complaintDetection.riskLevel,
                                        complaintType: complaintDetection.complaintType,
                                        keywords: complaintDetection.keywords,
                                        detectedAt: new Date()
                                    };
                                }

                                // If high-risk, suggest immediate escalation
                                if (complaintDetection.riskLevel === 'high') {
                                    console.log(`🚨 [${callSid}] HIGH-RISK complaint detected. Suggesting immediate escalation.`);
                                    // The AI will be prompted to escalate via instructions or tool call
                                }
                            }
                        }
                        
                        // NORMAL USER INPUT: Process transcription when agent is waiting (not interrupting)
                        // Double-check: ensure no active response before creating new one
                        if (transcript && transcript !== lastUserTranscript && !isResponding && activeResponseId === null && waitingForUser) {
                            lastUserTranscript = transcript;
                            waitingForUser = false;
                            isResponding = true; // Set flag before creating response
                            lastProcessedTranscriptionTime = transcriptionTime; // Track this as the last processed
                            console.log(`🎯 [${callSid}] Creating response to normal user input: "${transcript}" (agent was waiting, not interrupted)`);
                            try {
                                explicitResponseRequested = true; // Mark this as an explicit request
                                openaiWs.send(JSON.stringify({
                                    type: 'response.create',
                                    response: {
                                        modalities: ['audio', 'text']
                                    }
                                }));
                            } catch (err) {
                                explicitResponseRequested = false; // Reset if send fails
                                isResponding = false; // Reset if send fails
                                console.error(`❌ [${callSid}] Error creating response to user input:`, err);
                            }
                        } else if (transcript && transcript !== lastUserTranscript) {
                            console.log(`⚠️ [${callSid}] Skipping response - isResponding: ${isResponding}, activeResponseId: ${activeResponseId}, waitingForUser: ${waitingForUser}, hasInitialGreetingCompleted: ${hasInitialGreetingCompleted}`);
                        }
                    }
                    
                    // Handle when user speech ends - process the most recent transcription
                    if (event.type === 'input_audio_buffer.speech_stopped') {
                        if (isInterrupted && pendingTranscriptions.length > 0) {
                            // Get the most recent transcription (last one in the queue)
                            const latestTranscription = pendingTranscriptions[pendingTranscriptions.length - 1];
                            console.log(`✅ [${callSid}] Speech ended after interruption - acknowledging interruption first`);
                            
                            // Clear interruption flag
                            isInterrupted = false;
                            const finalInterruptionTime = interruptionStartTime;
                            interruptionStartTime = 0;
                            
                            // Clear pending transcriptions - we'll ignore the interrupting speech
                            // and wait for the user to ask again after acknowledgment
                            pendingTranscriptions = [];
                            
                            // Process only the latest transcription to check if it's a stop command
                            const transcript = latestTranscription.transcript;
                            const confidence = latestTranscription.confidence;
                            const transcriptionTime = latestTranscription.time;
                            
                            // Check confidence threshold
                            if (!config.uncertaintyGateEnabled || confidence >= config.confidenceThreshold) {
                                // Check if this is a stop command
                                const stopCommands = /\b(stop|wait|hold on|pause|shut up|be quiet|enough|that's enough)\b/i;
                                const isStopCommand = stopCommands.test(transcript);
                                
                                if (isStopCommand) {
                                    console.log(`🛑 [${callSid}] Stop command detected: "${transcript}" - entering listening mode`);
                                    waitingForUser = true;
                                    lastCancellationTime = 0;
                                    return;
                                }
                                
                                // CRITICAL: Only acknowledge the interruption, don't respond to the query yet
                                // The user will ask again after the acknowledgment
                                // Fix: Add atomic check right before sending to prevent race condition
                                if (!isResponding && activeResponseId === null && waitingForUser && openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                                    // Double-check atomically right before sending (prevent race condition)
                                    if (activeResponseId === null && !isResponding) {
                                        waitingForUser = false;
                                        isResponding = true;
                                        console.log(`🎯 [${callSid}] Creating acknowledgment response after barge-in (ignoring interrupting speech: "${transcript}")`);
                                        try {
                                            // Add a conversation item that instructs the agent to ONLY acknowledge the interruption
                                            // Do NOT include the user's query - we'll wait for them to ask again
                                            openaiWs.send(JSON.stringify({
                                                type: 'conversation.item.create',
                                                item: {
                                                    type: 'message',
                                                    role: 'user',
                                                    content: [
                                                        {
                                                            type: 'input_text',
                                                            text: `[The user interrupted your previous response. Please acknowledge this by saying something like "How can I help you with any other queries you have?" or "Sure, what can I help you with?" Do NOT respond to any specific query yet - just acknowledge and wait for them to ask again.]`
                                                        }
                                                    ]
                                                }
                                            }));
                                            console.log(`💬 [${callSid}] Added barge-in acknowledgment instruction (will wait for user to ask again)`);
                                            
                                            explicitResponseRequested = true; // Mark this as an explicit request
                                            openaiWs.send(JSON.stringify({
                                                type: 'response.create',
                                                response: {
                                                    modalities: ['audio', 'text']
                                                }
                                            }));
                                            console.log(`📤 [${callSid}] Created acknowledgment response - will wait for user's question`);
                                        } catch (err) {
                                            explicitResponseRequested = false; // Reset if send fails
                                            isResponding = false;
                                            waitingForUser = true;
                                            console.error(`❌ [${callSid}] Error creating acknowledgment response:`, err);
                                        }
                                    } else {
                                        console.log(`⚠️ [${callSid}] Skipping acknowledgment - response already active (race condition prevented)`);
                                    }
                                } else {
                                    console.log(`⚠️ [${callSid}] Skipping acknowledgment - conditions not met: isResponding=${isResponding}, activeResponseId=${activeResponseId}, waitingForUser=${waitingForUser}, wsOpen=${openaiWs && openaiWs.readyState === WebSocket.OPEN}`);
                                }
                            }
                        } else if (isInterrupted) {
                            // Speech ended but no transcriptions were queued
                            // CRITICAL: Still send acknowledgment to let user know we're ready
                            console.log(`✅ [${callSid}] Speech ended after interruption - no transcriptions to process, sending acknowledgment`);
                            
                            // Clear interruption flag
                            isInterrupted = false;
                            const finalInterruptionTime = interruptionStartTime;
                            interruptionStartTime = 0;
                            
                            // CRITICAL: Send acknowledgment even when there are no transcriptions
                            // This ensures the user knows we're ready to listen
                            // Fix: Add atomic check right before sending to prevent race condition
                            if (!isResponding && activeResponseId === null && waitingForUser && openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                                // Double-check atomically right before sending (prevent race condition)
                                if (activeResponseId === null && !isResponding) {
                                    waitingForUser = false;
                                    isResponding = true;
                                    console.log(`🎯 [${callSid}] Creating acknowledgment response after barge-in (no transcriptions)`);
                                    try {
                                        // Add a conversation item that instructs the agent to ONLY acknowledge the interruption
                                        openaiWs.send(JSON.stringify({
                                            type: 'conversation.item.create',
                                            item: {
                                                type: 'message',
                                                role: 'user',
                                                content: [
                                                    {
                                                        type: 'input_text',
                                                        text: `[The user interrupted your previous response. Please acknowledge this by saying something like "How can I help you with any other queries you have?" or "Sure, what can I help you with?" Do NOT respond to any specific query yet - just acknowledge and wait for them to ask again.]`
                                                    }
                                                ]
                                            }
                                        }));
                                        console.log(`💬 [${callSid}] Added barge-in acknowledgment instruction (no transcriptions)`);
                                        
                                        explicitResponseRequested = true; // Mark this as an explicit request
                                        openaiWs.send(JSON.stringify({
                                            type: 'response.create',
                                            response: {
                                                modalities: ['audio', 'text']
                                            }
                                        }));
                                        console.log(`📤 [${callSid}] Created acknowledgment response - will wait for user's question`);
                                    } catch (err) {
                                        explicitResponseRequested = false; // Reset if send fails
                                        isResponding = false;
                                        waitingForUser = true;
                                        console.error(`❌ [${callSid}] Error creating acknowledgment response:`, err);
                                    }
                                } else {
                                    console.log(`⚠️ [${callSid}] Skipping acknowledgment - response already active (race condition prevented)`);
                                }
                            } else {
                                console.log(`⚠️ [${callSid}] Skipping acknowledgment - conditions not met: isResponding=${isResponding}, activeResponseId=${activeResponseId}, waitingForUser=${waitingForUser}, wsOpen=${openaiWs && openaiWs.readyState === WebSocket.OPEN}`);
                            }
                        }
                    }
                    
                    // Handle function call arguments streaming (optional - for better UX)
                    if (event.type === 'response.function_call_arguments.delta') {
                        // Track partial arguments if needed (optional)
                        const callId = event.call_id;
                        if (!pendingToolCalls.has(callId)) {
                            pendingToolCalls.set(callId, {
                                name: null,
                                arguments: '',
                                startTime: Date.now()
                            });
                        }
                        const toolCall = pendingToolCalls.get(callId);
                        toolCall.arguments += event.delta || '';
                    }
                    
                    // Handle complete function call arguments
                    if (event.type === 'response.function_call_arguments.done') {
                        const callId = event.call_id;
                        if (pendingToolCalls.has(callId)) {
                            const toolCall = pendingToolCalls.get(callId);
                            toolCall.arguments = event.arguments || '';
                        }
                    }
                    
                    // Handle function call completion - PRIMARY EVENT
                    if (event.type === 'response.output_item.done' && 
                        event.item?.type === 'function_call') {
                        
                        const { call_id, name, arguments: args } = event.item;
                        console.log(`\n🔧 [${callSid}] ========================================`);
                        console.log(`🔧 [${callSid}] TOOL INVOCATION DETECTED`);
                        console.log(`🔧 [${callSid}] Tool: ${name}`);
                        console.log(`🔧 [${callSid}] Call ID: ${call_id}`);
                        console.log(`🔧 [${callSid}] Phone: ${phoneNumber || 'unknown'}`);
                        console.log(`🔧 [${callSid}] Raw Arguments: ${args || '{}'}`);
                        
                        // Parse arguments JSON string
                        let parameters = {};
                        try {
                            // Check if args is valid before parsing
                            if (!args || args.trim() === '') {
                                parameters = {};
                            } else {
                                parameters = JSON.parse(args);
                            }
                            console.log(`🔧 [${callSid}] Parsed Parameters:`, JSON.stringify(parameters, null, 2));
                        } catch (parseError) {
                            console.error(`❌ [${callSid}] Failed to parse tool arguments for ${name}:`, parseError);
                            console.error(`❌ [${callSid}] Raw arguments (first 200 chars):`, args ? args.substring(0, 200) : 'null');
                            console.error(`❌ [${callSid}] Arguments length:`, args ? args.length : 0);
                                // Submit error result
                                if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                                    openaiWs.send(JSON.stringify({
                                        type: 'conversation.item.create',
                                        item: {
                                            type: 'function_call_output',
                                            call_id: call_id,
                                            output: JSON.stringify({
                                                success: false,
                                                error: `Failed to parse tool arguments: ${parseError.message}`,
                                                raw_args_preview: args ? args.substring(0, 100) : 'null'
                                            })
                                        }
                                    }));
                                    // Trigger response ONLY if not already responding and no active response
                                    if (!isResponding && activeResponseId === null && !isClosed) {
                                        isResponding = true;
                                        explicitResponseRequested = true; // Mark this as an explicit request
                                        openaiWs.send(JSON.stringify({
                                            type: 'response.create'
                                        }));
                                        console.log(`📤 [${callSid}] Parse error result submitted, waiting for AI response...`);
                                    } else {
                                        console.log(`⚠️ [${callSid}] Skipping response.create after parse error - isResponding: ${isResponding}, activeResponseId: ${activeResponseId}`);
                                    }
                                }
                                return;
                        }
                        
                        // Store tool call info
                        const toolStartTime = Date.now();
                        pendingToolCalls.set(call_id, {
                            name: name,
                            arguments: args,
                            startTime: toolStartTime
                        });
                        
                        console.log(`🔧 [${callSid}] Starting tool execution: ${name}`);
                        console.log(`🔧 [${callSid}] ========================================\n`);
                        
                        // Check if KBA is required for this tool
                        if (kbaService.requiresKBA(name, parameters)) {
                            const isKBAVerified = kbaService.isKBAVerified(callSid);
                            
                            if (!isKBAVerified) {
                                console.log(`🔐 [${callSid}] KBA required for tool ${name} but not verified. Blocking execution.`);
                                
                                // Submit error result indicating KBA is required
                                if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                                    openaiWs.send(JSON.stringify({
                                        type: 'conversation.item.create',
                                        item: {
                                            type: 'function_call_output',
                                            call_id: call_id,
                                            output: JSON.stringify({
                                                success: false,
                                                error: 'KBA_REQUIRED',
                                                message: 'Identity verification is required before accessing or changing personal booking data. Please use the kba_verification tool first with your email, postcode, and booking reference (if available).',
                                                requiresKBA: true
                                            })
                                        }
                                    }));
                                    
                                    // Trigger model response
                                    if (!isResponding && activeResponseId === null && !isClosed) {
                                        isResponding = true;
                                        explicitResponseRequested = true;
                                        openaiWs.send(JSON.stringify({
                                            type: 'response.create'
                                        }));
                                        console.log(`📤 [${callSid}] KBA required message sent, waiting for AI response...`);
                                    }
                                }
                                
                                // Remove from pending
                                pendingToolCalls.delete(call_id);
                                return;
                            } else {
                                console.log(`✅ [${callSid}] KBA verified for tool ${name}. Proceeding with execution.`);
                            }
                        }
                        
                        // Execute tool asynchronously
                        // Include client details and verification status from conversation state
                        const conversation = conversations[callSid] || {};
                        const callContext = {
                            callSid: callSid,
                            phoneNumber: phoneNumber,
                            clientDetails: conversation.clientDetails,
                            clientVerified: conversation.clientVerified || false
                        };
                        
                        toolExecutor.execute(name, parameters, callContext)
                            .then(async (executionResult) => {
                                if (isClosed || !openaiWs || openaiWs.readyState !== WebSocket.OPEN) {
                                    return;
                                }
                                
                                // Store client details in conversation if returned from CRM browser tool
                                if (name === 'crm_browser' && executionResult.success && executionResult.result) {
                                    if (executionResult.result.clientDetails) {
                                        if (!conversations[callSid]) {
                                            conversations[callSid] = {};
                                        }
                                        conversations[callSid].clientDetails = executionResult.result.clientDetails;
                                        console.log(`💾 [${callSid}] Stored client details in conversation state`);
                                    }
                                    
                                    // Store availability data if returned from check_availability
                                    if (executionResult.result.sessionDetails || executionResult.result.availableSlots) {
                                        if (!conversations[callSid]) {
                                            conversations[callSid] = {};
                                        }
                                        conversations[callSid].lastAvailabilityCheck = executionResult.result.sessionDetails || executionResult.result;
                                        console.log(`💾 [${callSid}] Stored availability data in conversation state`);
                                    }
                                }
                                
                                // Store client verification status if returned from client_verification tool
                                if (name === 'client_verification' && executionResult.success && executionResult.verified) {
                                    if (!conversations[callSid]) {
                                        conversations[callSid] = {};
                                    }
                                    conversations[callSid].clientVerified = true;
                                    conversations[callSid].clientVerifiedAt = new Date();
                                    console.log(`✅ [${callSid}] Client verified - stored in conversation state`);
                                }
                                
                                // Remove from pending
                                const toolCallInfo = pendingToolCalls.get(call_id);
                                const totalTime = Date.now() - (toolCallInfo?.startTime || toolStartTime);
                                pendingToolCalls.delete(call_id);
                                
                                // Format result
                                const output = executionResult.success 
                                    ? executionResult.result 
                                    : { success: false, error: executionResult.error };
                                
                                // Include clientDetails in output if available
                                if (executionResult.clientDetails) {
                                    output.clientDetails = executionResult.clientDetails;
                                }
                                
                                // Include verification status if available
                                if (executionResult.requiresVerification !== undefined) {
                                    output.requiresVerification = executionResult.requiresVerification;
                                }
                                
                                console.log(`\n✅ [${callSid}] ========================================`);
                                console.log(`✅ [${callSid}] TOOL EXECUTION COMPLETED`);
                                console.log(`✅ [${callSid}] Tool: ${name}`);
                                console.log(`✅ [${callSid}] Success: ${executionResult.success}`);
                                console.log(`✅ [${callSid}] Execution Time: ${executionResult.executionTime}ms`);
                                console.log(`✅ [${callSid}] Total Time (including overhead): ${totalTime}ms`);
                                if (executionResult.success) {
                                    console.log(`✅ [${callSid}] Result:`, JSON.stringify(output, null, 2).substring(0, 500));
                                } else {
                                    console.log(`✅ [${callSid}] Error: ${executionResult.error}`);
                                }
                                console.log(`✅ [${callSid}] Submitting result to OpenAI...`);
                                console.log(`✅ [${callSid}] ========================================\n`);
                                
                                // Submit tool result
                                try {
                                    openaiWs.send(JSON.stringify({
                                        type: 'conversation.item.create',
                                        item: {
                                            type: 'function_call_output',
                                            call_id: call_id,
                                            output: JSON.stringify(output) // Must be stringified JSON
                                        }
                                    }));
                                    
                                    // Trigger model response ONLY if not already responding and no active response
                                    if (!isResponding && activeResponseId === null && !isClosed && openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                                        isResponding = true; // Set flag before creating response
                                        explicitResponseRequested = true; // Mark this as an explicit request
                                        openaiWs.send(JSON.stringify({
                                            type: 'response.create'
                                        }));
                                        console.log(`📤 [${callSid}] Tool result submitted for ${name}, waiting for AI response...`);
                                    } else {
                                        console.log(`⚠️ [${callSid}] Skipping response.create - isResponding: ${isResponding}, activeResponseId: ${activeResponseId}, connection closed: ${!openaiWs || openaiWs.readyState !== WebSocket.OPEN}`);
                                    }
                                } catch (sendError) {
                                    console.error(`❌ [${callSid}] Error submitting tool result:`, sendError);
                                }
                            })
                            .catch(async (error) => {
                                if (isClosed || !openaiWs || openaiWs.readyState !== WebSocket.OPEN) {
                                    return;
                                }
                                
                                // Remove from pending
                                const toolCallInfo = pendingToolCalls.get(call_id);
                                const totalTime = toolCallInfo ? Date.now() - toolCallInfo.startTime : 0;
                                pendingToolCalls.delete(call_id);
                                
                                console.error(`\n❌ [${callSid}] ========================================`);
                                console.error(`❌ [${callSid}] TOOL EXECUTION FAILED`);
                                console.error(`❌ [${callSid}] Tool: ${name}`);
                                console.error(`❌ [${callSid}] Error: ${error.message || error}`);
                                console.error(`❌ [${callSid}] Total Time: ${totalTime}ms`);
                                console.error(`❌ [${callSid}] Submitting error result to OpenAI...`);
                                console.error(`❌ [${callSid}] ========================================\n`);
                                
                                // Submit error result
                                try {
                                    openaiWs.send(JSON.stringify({
                                        type: 'conversation.item.create',
                                        item: {
                                            type: 'function_call_output',
                                            call_id: call_id,
                                            output: JSON.stringify({
                                                success: false,
                                                error: error.message || 'Tool execution failed'
                                            })
                                        }
                                    }));
                                    
                                    // Trigger model response ONLY if not already responding and no active response
                                    if (!isResponding && activeResponseId === null && !isClosed && openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                                        isResponding = true; // Set flag before creating response
                                        explicitResponseRequested = true; // Mark this as an explicit request
                                        openaiWs.send(JSON.stringify({
                                            type: 'response.create'
                                        }));
                                        console.log(`📤 [${callSid}] Tool error result submitted, waiting for AI response...`);
                                    } else {
                                        console.log(`⚠️ [${callSid}] Skipping response.create after tool error - isResponding: ${isResponding}, activeResponseId: ${activeResponseId}`);
                                    }
                                } catch (sendError) {
                                    console.error(`❌ [${callSid}] Error submitting tool error result:`, sendError);
                                }
                            });
                    }
                    
                    // Capture transcripts
                    if (event.type === 'conversation.item.created') {
                        const item = event.item;
                        const text = item.content?.find(c => c.type === 'text')?.text;
                        if (text && conversations[callSid]) {
                            const role = item.role === 'assistant' ? 'agent' : 'user';
                            conversations[callSid].transcript.push({
                                role: role,
                                text: text
                            });
                            console.log(`💬 ${role.toUpperCase()}: ${text}`);
                        }
                    }
                    
                } catch (err) {
                    errorCount++;
                    console.error('❌ Error processing OpenAI event:', err);
                    if (errorCount >= MAX_ERROR_COUNT) {
                        cleanup('parse_error');
                    }
                }
            });
            
            // Forward Twilio audio → OpenAI
            ws.on('message', (data) => {
                if (isClosed || !openaiReady) return;
                
                try {
                    const json = JSON.parse(data.toString());
                    
                    if (json.event === 'media' && json.media?.payload) {
                        audioChunkCount++;
                        const now = Date.now();
                        audioMetrics.incomingTimestamps.push(now);
                        audioMetrics.receivedChunks++;
                        
                        if (openaiWs && openaiWs.readyState === WebSocket.OPEN && !isClosed) {
                            try {
                                // Direct μ-law - no conversion needed
                                openaiWs.send(JSON.stringify({
                                    type: 'input_audio_buffer.append',
                                    audio: json.media.payload
                                }));
                            } catch (err) {
                                errorCount++;
                                console.error('❌ Error sending audio to OpenAI:', err);
                            }
                        }
                    }
                } catch (err) {
                    errorCount++;
                    console.error('❌ Error forwarding Twilio audio:', err);
                }
            });
            
            ws.on('close', () => {
                cleanup('twilio_close');
            });
            
            openaiWs.on('close', () => {
                cleanup('openai_close');
            });
            
            ws.on('error', (err) => {
                errorCount++;
                console.error(`❌ Twilio WebSocket error for call ${callSid}:`, err);
                if (errorCount >= MAX_ERROR_COUNT) {
                    cleanup('twilio_error');
                }
            });
            
        } catch (err) {
            errorCount++;
            console.error('❌ Failed to setup OpenAI:', err);
            if (errorCount >= MAX_ERROR_COUNT) {
                cleanup('setup_error');
            } else {
                ws.close();
            }
        }
    }
    
    } catch (error) {
         console.error('❌ [DEBUG] Fatal error in handleMediaStreamConnection:', error);
         console.error('❌ [DEBUG] Error stack:', error.stack);
         if (ws && ws.readyState === WebSocket.OPEN) {
             ws.close(1011, 'Internal server error');
         }
     }
};

