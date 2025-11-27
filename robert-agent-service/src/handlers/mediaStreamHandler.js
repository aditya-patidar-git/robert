import { WebSocket } from "ws";
import { spawn } from "child_process";
import { conversations, realtimeClients } from "../shared/state.js";
import { convertMulawToPcm16, convertPcm16ToMulaw } from "../utils/audioConversion.js";
import configManager from "../agent/configManager.js";
import toolExecutor from "../tools/index.js";

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
    
    // Initial greeting tracking
    let hasInitialGreetingBeenSent = false;
    let hasInitialGreetingCompleted = false;
    
    // Tool execution tracking
    const pendingToolCalls = new Map(); // call_id -> { name, arguments, startTime }
    
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
            const mulawBase64 = convertPcm16ToMulaw(base64Pcm8k);
            const pushed = Buffer.from(mulawBase64, 'base64');
            ulawQueue.push(pushed);
            startPacer();
        });
        downFfmpeg.on('close', () => { downFfmpeg = null; });
        downFfmpeg.on('error', (err) => console.error('❌ ffmpeg downsampler error:', err));
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
                openaiWs.send(JSON.stringify({ type: 'session.cancel' }));
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
    
    const messageHandler = (data) => {
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
    
    function setupOpenAI() {
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
            
            // Get dynamic config for this phone number
            const config = configManager.getConfigForNumber(phoneNumber);
            console.log('📋 Using config:', {
                voice: config.voice.id,
                temperature: config.temperature,
                confidence: config.confidenceThreshold
            });
            
            const openaiUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview';
            openaiWs = new WebSocket(openaiUrl, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'OpenAI-Beta': 'realtime=v1'
                }
            });
            
            realtimeClients[callSid] = { twilioWs: ws, openaiWs, streamSid };
            conversations[callSid] = { transcript: [], language: 'en-US', realtimeWs: ws };
            
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
                    
                    // Apply dynamic config to OpenAI session
                    openaiWs.send(JSON.stringify({
                        type: 'session.update',
                        session: {
                            modalities: ['audio', 'text'],
                            instructions: config.instructions,
                            voice: config.voice.id,
                            temperature: Math.max(0.6, config.temperature), // Minimum is 0.6 for Realtime API
                            input_audio_format: 'g711_ulaw',
                            output_audio_format: 'g711_ulaw',
                            turn_detection: {
                                type: 'server_vad',
                                threshold: config.vadThreshold / 1000, // Convert ms to seconds
                                prefix_padding_ms: config.startPadding,
                                silence_duration_ms: config.endPadding
                            },
                            tools: tools,
                            tool_choice: 'auto'
                        }
                    }));
                    console.log(`📤 Sent session.update with config and ${tools.length} tools for call: ${callSid}`);
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
                                openaiWs.send(JSON.stringify({
                                    type: 'response.create',
                                    response: {
                                        modalities: ['audio', 'text']
                                    }
                                }));
                                hasInitialGreetingBeenSent = true;
                                isResponding = true; // Set flag before creating response
                                console.log(`🎯 [${callSid}] Initial greeting sent immediately`);
                            } catch (err) {
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
                        responseStartTime = Date.now();
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
                        audioChunkCount++;
                        const responseTime = Date.now();
                        audioMetrics.responseTimestamps.push(responseTime);
                        audioMetrics.lastResponseTime = responseTime;
                        
                        if (audioChunkCount > MAX_AUDIO_BUFFER_SIZE * 100) {
                            console.error(`❌ Too many audio chunks (${audioChunkCount}), closing`);
                            cleanup('audio_limit');
                            return;
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
                        console.log(`✅ [${callSid}] Response done - ID: ${responseId}, status: ${status}`);
                        
                        // Check if this was the initial greeting
                        const wasInitialGreeting = hasInitialGreetingBeenSent && !hasInitialGreetingCompleted;
                        if (wasInitialGreeting && status !== 'interrupted') {
                            hasInitialGreetingCompleted = true;
                            console.log(`✅ [${callSid}] Initial greeting completed`);
                        }
                        
                        // Only clear tracking if response completed naturally (not interrupted)
                        // If interrupted, the barge-in handler already cleared it
                        if (status === 'interrupted') {
                            console.log(`🛑 [${callSid}] Response was interrupted (barge-in)`);
                            // Don't clear activeResponseId here - barge-in handler already cleared it
                            // Just reset flags if they weren't already reset
                            isResponding = false;
                            waitingForUser = true;
                        } else {
                            // Response completed naturally - clear all tracking
                            activeResponseId = null;
                            responseItemId = null;
                            responseStartTime = null;
                            isResponding = false;
                            waitingForUser = true;
                        }
                    }
                    
                    // Handle barge-in: user speech detected during active response
                    if (event.type === 'input_audio_buffer.speech_started') {
                        if (activeResponseId && isResponding) {
                            console.log(`🛑 [${callSid}] Barge-in detected! Cancelling active response ${activeResponseId}`);
                            
                            // Save IDs before clearing
                            const responseIdToCancel = activeResponseId;
                            
                            // Clear response tracking immediately to prevent race conditions
                            activeResponseId = null;
                            responseItemId = null;
                            responseStartTime = null;
                            isResponding = false;
                            waitingForUser = true; // Ready to listen to interrupting speech
                            lastCancellationTime = Date.now(); // Mark when we cancelled (for stop command detection)
                            
                            try {
                                // Cancel the active response (this is sufficient for barge-in)
                                openaiWs.send(JSON.stringify({
                                    type: 'response.cancel',
                                    response_id: responseIdToCancel
                                }));
                                console.log(`🛑 [${callSid}] Sent response.cancel for ${responseIdToCancel}`);
                            } catch (err) {
                                // If cancel fails, log but don't treat as fatal
                                // This can happen if response already completed/cancelled
                                console.warn(`⚠️ [${callSid}] Error sending response.cancel (non-critical):`, err.message);
                            }
                        } else {
                            console.log(`👤 [${callSid}] User speech started (no active response to cancel - activeResponseId: ${activeResponseId}, isResponding: ${isResponding})`);
                        }
                    }
                    
                    // Handle user speech transcription with confidence check
                    if (event.type === 'conversation.item.input_audio_transcription.completed') {
                        const transcript = event.transcript || '';
                        const confidence = event.confidence || 1.0;
                        console.log(`👤 User said: "${transcript}" (confidence: ${confidence})`);
                        
                        // Check confidence threshold
                        if (config.uncertaintyGateEnabled && confidence < config.confidenceThreshold) {
                            console.log(`⚠️ Low confidence transcript (${confidence} < ${config.confidenceThreshold}), skipping response`);
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
                            return; // Don't respond to stop commands
                        }
                        
                        // If we cancelled recently but it's NOT a stop command, process it normally
                        // This allows the agent to respond to interrupting speech that's not a stop command
                        if (isRecentCancellation) {
                            console.log(`👂 [${callSid}] Processing interrupting speech: "${transcript}"`);
                            lastCancellationTime = 0; // Reset after processing
                        }
                        
                        // Prevent user responses until initial greeting completes (unless this is interrupting speech)
                        if (!hasInitialGreetingCompleted && !isRecentCancellation) {
                            console.log(`⏳ [${callSid}] Waiting for initial greeting to complete before responding to: "${transcript}"`);
                            return; // Queue this input - will be processed after greeting completes
                        }
                        
                        // Double-check: ensure no active response before creating new one
                        if (transcript && transcript !== lastUserTranscript && !isResponding && activeResponseId === null && waitingForUser) {
                            lastUserTranscript = transcript;
                            waitingForUser = false;
                            isResponding = true; // Set flag before creating response
                            console.log(`🎯 [${callSid}] Creating response to user input: "${transcript}" (isResponding: ${isResponding}, activeResponseId: ${activeResponseId})`);
                            try {
                                openaiWs.send(JSON.stringify({
                                    type: 'response.create',
                                    response: {
                                        modalities: ['audio']
                                    }
                                }));
                            } catch (err) {
                                isResponding = false; // Reset if send fails
                                console.error(`❌ [${callSid}] Error creating response to user input:`, err);
                            }
                        } else if (transcript && transcript !== lastUserTranscript) {
                            console.log(`⚠️ [${callSid}] Skipping response - isResponding: ${isResponding}, activeResponseId: ${activeResponseId}, waitingForUser: ${waitingForUser}, hasInitialGreetingCompleted: ${hasInitialGreetingCompleted}`);
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
                            parameters = JSON.parse(args || '{}');
                            console.log(`🔧 [${callSid}] Parsed Parameters:`, JSON.stringify(parameters, null, 2));
                        } catch (parseError) {
                            console.error(`❌ [${callSid}] Failed to parse tool arguments for ${name}:`, parseError);
                                // Submit error result
                                if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                                    openaiWs.send(JSON.stringify({
                                        type: 'conversation.item.create',
                                        item: {
                                            type: 'function_call_output',
                                            call_id: call_id,
                                            output: JSON.stringify({
                                                success: false,
                                                error: 'Failed to parse tool arguments'
                                            })
                                        }
                                    }));
                                    // Trigger response ONLY if not already responding and no active response
                                    if (!isResponding && activeResponseId === null && !isClosed) {
                                        isResponding = true;
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
                        
                        // Execute tool asynchronously
                        const callContext = {
                            callSid: callSid,
                            phoneNumber: phoneNumber
                        };
                        
                        toolExecutor.execute(name, parameters, callContext)
                            .then(async (executionResult) => {
                                if (isClosed || !openaiWs || openaiWs.readyState !== WebSocket.OPEN) {
                                    return;
                                }
                                
                                // Remove from pending
                                const toolCallInfo = pendingToolCalls.get(call_id);
                                const totalTime = Date.now() - (toolCallInfo?.startTime || toolStartTime);
                                pendingToolCalls.delete(call_id);
                                
                                // Format result
                                const output = executionResult.success 
                                    ? executionResult.result 
                                    : { success: false, error: executionResult.error };
                                
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

