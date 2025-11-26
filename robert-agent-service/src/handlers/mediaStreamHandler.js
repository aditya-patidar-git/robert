import { WebSocket } from "ws";
import { spawn } from "child_process";
import { conversations, realtimeClients } from "../shared/state.js";
import { convertMulawToPcm16, convertPcm16ToMulaw } from "../utils/audioConversion.js";
import configManager from "../agent/configManager.js";

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
        }
    };
    
    durationTimer = setTimeout(() => {
        console.error(`⏰ Maximum call duration reached for ${callSid}`);
        cleanup('max_duration');
    }, MAX_CALL_DURATION_MS);
    
    const messageHandler = (data) => {
        if (isClosed) return;
        
        try {
            const json = JSON.parse(data.toString());
            
            if (json.event === 'start') {
                callSid = json.start?.callSid;
                streamSid = json.start?.streamSid;
                phoneNumber = json.start?.callSidTo || json.start?.from || 'unknown';
                
                if (!callSid) {
                    console.error('❌ No callSid in start event');
                    cleanup('no_callsid');
                    return;
                }
                
                console.log(`📞 Start event - callSid: ${callSid}, phoneNumber: ${phoneNumber}`);
                callStartTime = Date.now();
                
                ws.removeListener('message', messageHandler);
                setupOpenAI();
            }
        } catch (err) {
            errorCount++;
            console.error('❌ Error parsing message:', err);
            if (errorCount >= MAX_ERROR_COUNT) {
                cleanup('max_errors');
            }
        }
    };
    
    ws.on('message', messageHandler);
    
    startTimeout = setTimeout(() => {
        if (!setupComplete) {
            console.error('❌ Timeout waiting for start event');
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
                            }
                        }
                    }));
                    console.log(`📤 Sent session.update with config for call: ${callSid}`);
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
                        
                        setTimeout(() => {
                            if (isClosed || !openaiWs || openaiWs.readyState !== WebSocket.OPEN) {
                                return;
                            }
                            try {
                                openaiWs.send(JSON.stringify({
                                    type: 'response.create',
                                    response: {
                                        modalities: ['audio', 'text']
                                    }
                                }));
                                console.log(`🎯 Triggered AI to speak first for call: ${callSid}`);
                            } catch (err) {
                                errorCount++;
                                console.error('❌ Error sending response.create:', err);
                            }
                        }, 1000);
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
                        console.log(`✅ Response done for call: ${callSid}`);
                        isResponding = false;
                        waitingForUser = true;
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
                        
                        if (transcript && transcript !== lastUserTranscript && !isResponding) {
                            lastUserTranscript = transcript;
                            waitingForUser = false;
                            console.log('🎯 Creating response to user input:', transcript);
                            openaiWs.send(JSON.stringify({
                                type: 'response.create',
                                response: {
                                    modalities: ['audio']
                                }
                            }));
                        }
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
};

