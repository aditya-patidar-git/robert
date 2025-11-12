import twilio from "twilio";
import axios from "axios";
import CallRecord from "../models/CallRecord.js";
import client from "../utils/twilioClient.js";
import { getAIResponse, executeToolCall } from "../utils/ai.js";
import observabilityService from "../services/observabilityService.js";
import multilingualService from "../services/multilingualService.js";
import gdprService from "../services/gdprService.js";
import { io } from "../server.js";
import { WebSocketServer, WebSocket } from "ws";
import { spawn } from "child_process";

const conversations = {}; // in-memory storage
const realtimeClients = {}; // Store active Realtime API connections
const VoiceResponse = twilio.twiml.VoiceResponse;

// ✅ μ-law to PCM16 conversion (optimized lookup table)
const MULAW_TO_LINEAR = new Int16Array(256);
for (let i = 0; i < 256; i++) {
    let uval = ~i;
    let sign = (uval & 0x80) ? -1 : 1;
    let exponent = (uval & 0x70) >> 4;
    let mantissa = uval & 0x0F;
    let step = 4 << (exponent + 1);
    let linear = ((mantissa << 1) + 33) << exponent;
    linear = sign * (linear - 33);
    MULAW_TO_LINEAR[i] = Math.max(-32768, Math.min(32767, linear));
}

function convertMulawToPcm16(mulawBase64) {
    const mulaw = Buffer.from(mulawBase64, 'base64');
    const pcm16 = Buffer.alloc(mulaw.length * 2);
    for (let i = 0; i < mulaw.length; i++) {
        pcm16.writeInt16LE(MULAW_TO_LINEAR[mulaw[i]], i * 2);
    }
    return pcm16.toString('base64');
}

// ✅ PCM16 to μ-law conversion (reverse of above)
const LINEAR_TO_MULAW = new Uint8Array(65536);
for (let i = 0; i < 65536; i++) {
    let sample = i - 32768; // Convert unsigned to signed
    let sign = sample < 0 ? 0x80 : 0x00;
    if (sign) sample = -sample;
    
    sample += 33; // Add bias
    let exponent = 7;
    
    // Find exponent
    for (let e = 0; e < 8; e++) {
        if (sample <= (33 << (e + 1))) {
            exponent = e;
            break;
        }
    }
    
    let mantissa = (sample >> (exponent + 1)) & 0x0F;
    let mulaw = ~(sign | (exponent << 4) | mantissa);
    LINEAR_TO_MULAW[i] = mulaw & 0xFF;
}

function convertPcm16ToMulaw(pcm16Base64) {
    const pcm16Buffer = Buffer.from(pcm16Base64, 'base64');
    const mulaw = Buffer.alloc(pcm16Buffer.length / 2);
    
    for (let i = 0; i < mulaw.length; i++) {
        const sample = pcm16Buffer.readInt16LE(i * 2);
        const unsigned = sample + 32768; // Convert to unsigned
        mulaw[i] = LINEAR_TO_MULAW[unsigned];
    }
    
    return mulaw.toString('base64');
}

// ✅ Make outbound calls
export const makeCall = async (req, res) => {
    const { toNumbers } = req.body;
    if (!Array.isArray(toNumbers) || toNumbers.length === 0)
        return res.status(400).json({ error: "Provide toNumbers array" });

    try {
        const results = [];
        for (const to of toNumbers) {
            console.log(`📞 Initiating call: to=${to}, from=${process.env.TWILIO_NUMBER}`);
            
            const call = await client.calls.create({
                to,
                from: process.env.TWILIO_NUMBER,
                url: `${process.env.BASE_URL}/api/outbound/ai-intro`,
                statusCallback: `${process.env.BASE_URL}/api/outbound/call-status`,
                statusCallbackEvent: ["initiated", "ringing", "answered", "completed", "no-answer", "busy", "failed"],
                statusCallbackMethod: "POST",
                record: true,
                recordingStatusCallback: `${process.env.BASE_URL}/api/outbound/recording-status`,
                recordingStatusCallbackMethod: "POST",
            });

            console.log(`✅ Call created: SID=${call.sid}, Status=${call.status}, To=${call.to}`);
            conversations[call.sid] = { transcript: [] };
            results.push({ callSid: call.sid, to });
        }

        return res.json({ success: true, calls: results });
    } catch (err) {
        console.error("❌ make-call error:", err);
        return res.status(500).json({ error: err.message });
    }
};

// ✅ AI Intro (first agent message) - Updated for Media Streams
export const aiIntro = async (req, res) => {
    const { CallSid } = req.body;
    
    if (!conversations[CallSid]) {
        conversations[CallSid] = { 
            transcript: [], 
            language: 'en-US',
            realtimeWs: null 
        };
    }

    // Record call start
    observabilityService.incrementMetric('app.total_calls');
    observabilityService.incrementMetric('telephony.outbound_calls');
    
    // Record consent for GDPR
    await gdprService.recordConsent(CallSid, 'recording', true);
    await gdprService.recordConsent(CallSid, 'processing', true);

    const twiml = new VoiceResponse();

    // Start Media Stream FIRST (before any Say commands)
    // Determine WebSocket URL - use wss:// for production, ws:// for local
    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const wsUrl = `${wsProtocol}://${wsHost}/api/outbound/media-stream?callSid=${CallSid}`;
    
    const start = twiml.start();
    const stream = start.stream({
        url: wsUrl,
        track: 'both_tracks'
    });
    
    // CRITICAL: Add a long pause to keep call alive while Media Stream takes over
    // The Media Stream will handle all audio from here, so OpenAI will provide the greeting
    twiml.pause({ length: 3600 }); // 1 hour pause (call will be handled by Media Stream)

    res.type("text/xml").send(twiml.toString());
};

// ✅ Media Stream WebSocket Handler for Realtime API
export const mediaStream = async (req, res) => {
    const { callSid } = req.query;
    
    if (!callSid) {
        return res.status(400).send('Missing callSid parameter');
    }

    // Check if this is a WebSocket upgrade request
    const upgrade = req.headers.upgrade;
    if (upgrade !== 'websocket') {
        return res.status(400).send('Expected WebSocket upgrade');
    }

    // The WebSocket upgrade will be handled by the server.js upgrade handler
    // This endpoint just validates the request
    res.status(101).end();
};

// ✅ Handle WebSocket connection for Media Streams - SIMPLIFIED WITH SAFEGUARDS
export const handleMediaStreamConnection = (ws, req) => {
    console.log('🔌 Media Stream WebSocket connection received');
    
    let callSid = null;
    let streamSid = null;
    let openaiWs = null;
    let openaiReady = false;
    let setupComplete = false;
    let isClosed = false; // Prevent multiple cleanup calls
    let accepting = true; // gate for enqueues to avoid races after cleanup
    
    // Safety limits
    const MAX_CALL_DURATION_MS = 3600000; // 1 hour max
    const MAX_ERROR_COUNT = 5; // Max errors before closing
    const MAX_AUDIO_BUFFER_SIZE = 100; // Max buffered audio chunks
    
    let errorCount = 0;
    let audioChunkCount = 0;
    let callStartTime = Date.now();
    let startTimeout = null;
    let durationTimer = null;
    
    // ── Twilio frame pacing and buffering (μ-law at 8 kHz; 20ms = 160 bytes) ─────────
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
            // Drop oldest when over capacity to remain real-time
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
    const ulawQueue = new ByteQueue(6400); // ~80ms-160ms of audio buffering
    let pacer = null;
    let lastSendTs = Date.now();
    const startPacer = () => {
        if (pacer) return;
        let idleLogTs = 0;
        let conditionFailCount = 0;
        let lastDiagnosticLog = 0;
        
        const tick = () => {
            if (isClosed || !accepting) {
                if (Date.now() - lastDiagnosticLog > 2000) {
                    console.log(`🛑 Pacer stopped: isClosed=${isClosed}, accepting=${accepting}`);
                    lastDiagnosticLog = Date.now();
                }
                pacer = setTimeout(tick, 20);
                return;
            }
            
            // ✅ DIAGNOSTIC: Check each condition separately and log failures
            const now = Date.now();
            let conditionFailed = false;
            let failureReason = '';
            
            if (!ws) {
                conditionFailed = true;
                failureReason = 'ws is null';
            } else if (ws.readyState !== WebSocket.OPEN) {
                conditionFailed = true;
                failureReason = `ws.readyState=${ws.readyState} (need OPEN=1)`;
            } else if (!streamSid) {
                conditionFailed = true;
                failureReason = 'streamSid is missing';
            }
            
            if (conditionFailed) {
                conditionFailCount++;
                // Log every 1 second to avoid spam
                if (now - lastDiagnosticLog > 1000) {
                    console.log(`⚠️ Pacer blocked (${conditionFailCount} times): ${failureReason}`);
                    lastDiagnosticLog = now;
                }
                pacer = setTimeout(tick, 20);
                return;
            }
            
            // Condition passed - reset counter and proceed
            if (conditionFailCount > 0) {
                console.log(`✅ Pacer condition now OK (was blocked ${conditionFailCount} times)`);
                conditionFailCount = 0;
            }
            
            const elapsed = now - lastSendTs;
            if (elapsed >= 20) {
                const frame = ulawQueue.shiftN(FRAME_BYTES);
                if (frame) {
                    try {
                        const payload = {
                            event: 'media',
                            streamSid,
                            track: 'outbound',
                            media: { payload: frame.toString('base64') }
                        };
                        ws.send(JSON.stringify(payload));
                        console.log(`📤 SENT OUTBOUND FRAME ${frame.length}B to Twilio`);
                    } catch (err) {
                        console.error(`❌ Failed to send frame: ${err.message || err}`);
                    }
                } else {
                    if (now - idleLogTs > 200) {
                        console.log(`⏳ Pacer idle, queue=${ulawQueue.total}B`);
                        idleLogTs = now;
                    }
                }
                lastSendTs = now;
            }
            pacer = setTimeout(tick, Math.max(0, 20 - (Date.now() - lastSendTs)));
        };
        pacer = setTimeout(tick, 20);
        console.log('🚀 Pacer started');
    };
    
    // ── ffmpeg resamplers per call ───────────────────────────────────────────────────
    // OpenAI (PCM16 24k) → ffmpeg downsample → PCM16 8k → μ-law → Twilio
    // Twilio (μ-law 8k) → PCM16 8k → ffmpeg upsample → PCM16 24k → OpenAI
    let downFfmpeg = null;
    let upFfmpeg = null;
    const startDownsampler = () => {
        if (downFfmpeg) return;
        downFfmpeg = spawn('ffmpeg', [
            '-f', 's16le',
            '-ar', '24000',
            '-ac', '1',
            '-i', 'pipe:0',
            '-f', 's16le',
            '-ar', '8000',
            '-ac', '1',
            'pipe:1'
        ]);
        console.log(`🎛️ Downsampler ffmpeg started (24k→8k), pid=${downFfmpeg.pid}`);
        downFfmpeg.stdout.on('data', (chunk) => {
            if (isClosed || !accepting) return;
            // chunk is PCM16 8k mono
            const base64Pcm8k = chunk.toString('base64');
            const mulawBase64 = convertPcm16ToMulaw(base64Pcm8k);
            const pushed = Buffer.from(mulawBase64, 'base64');
            ulawQueue.push(pushed);
            console.log(`➕ Downsampled PCM8k chunk ${pushed.length}B enqueued, queue=${ulawQueue.total}B`);
            
            // ✅ DIAGNOSTIC: Log state when pacer is triggered
            if (!pacer) {
                console.log(`🎯 Triggering pacer: ws=${!!ws}, ws.readyState=${ws?.readyState}, streamSid=${!!streamSid}`);
            }
            
            startPacer();
        });
        downFfmpeg.on('close', () => { downFfmpeg = null; });
        downFfmpeg.on('error', (err) => { console.error('❌ ffmpeg downsampler error:', err?.message || err); });
    };
    const startUpsampler = () => {
        if (upFfmpeg) return;
        upFfmpeg = spawn('ffmpeg', [
            '-f', 's16le',
            '-ar', '8000',
            '-ac', '1',
            '-i', 'pipe:0',
            '-f', 's16le',
            '-ar', '24000',
            '-ac', '1',
            'pipe:1'
        ]);
        console.log(`🎛️ Upsampler ffmpeg started (8k→24k), pid=${upFfmpeg.pid}`);
        upFfmpeg.stdout.on('data', (chunk) => {
            if (isClosed || !accepting) return;
            // chunk is PCM16 24k mono
            const base64Pcm24k = chunk.toString('base64');
            if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                try {
                    openaiWs.send(JSON.stringify({
                        type: 'input_audio_buffer.append',
                        audio: base64Pcm24k
                    }));
                } catch (_) { /* ignore */ }
            }
        });
        upFfmpeg.on('close', () => { upFfmpeg = null; });
        upFfmpeg.on('error', (err) => { console.error('❌ ffmpeg upsampler error:', err?.message || err); });
    };
    
    // Cleanup function - call only once with proper resource cleanup
    const cleanup = (reason = 'unknown') => {
        if (isClosed) return;
        isClosed = true;
        accepting = false;
        
        console.log(`🧹 Cleaning up call ${callSid} - reason: ${reason}`);
        
        // STEP 1: Remove ALL listeners FIRST to prevent ghost events
        if (openaiWs) {
            openaiWs.removeAllListeners('message');
            openaiWs.removeAllListeners('error');
            openaiWs.removeAllListeners('close');
            openaiWs.removeAllListeners('open');
        }
        
        if (ws) {
            ws.removeAllListeners('message');
            ws.removeAllListeners('error');
            ws.removeAllListeners('close');
        }
        
        // STEP 2: Cancel OpenAI session and close
        try {
            if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                // Use session.cancel for immediate abort (faster than response.cancel)
                openaiWs.send(JSON.stringify({ type: 'session.cancel' }));
                openaiWs.close(1000, 'Call ended');
            }
        } catch (err) {
            console.error('Error closing OpenAI connection:', err.message);
        }
        
        // STEP 3: Close Twilio connection
        try {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close(1000, 'Call ended');
            }
        } catch (err) {
            console.error('Error closing Twilio connection:', err.message);
        }
        
        // STEP 4: Clear timers and references
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
        
        console.log(`✅ Cleanup complete for call ${callSid}`);
    };

    // Safety: Maximum call duration
    durationTimer = setTimeout(() => {
        console.error(`⏰ Maximum call duration reached for ${callSid}`);
        cleanup('max_duration');
    }, MAX_CALL_DURATION_MS);

    // Wait for start event - check all messages until we get it
    const messageHandler = (data) => {
        if (isClosed) return; // Don't process if already closed
        
        try {
            const json = JSON.parse(data.toString());
            
            if (json.event === 'start') {
                callSid = json.start?.callSid;
                streamSid = json.start?.streamSid;
                
                if (!callSid) {
                    console.error('❌ No callSid in start event');
                    cleanup('no_callsid');
                    return;
                }
                
                console.log(`📞 Start event received - callSid: ${callSid}, streamSid: ${streamSid}`);
                console.log(`🔍 WebSocket state check: ws=${!!ws}, ws.readyState=${ws?.readyState}, streamSid=${!!streamSid}`);
                callStartTime = Date.now();
                
                // Optional: test tone path to validate Twilio outbound playback
                if (process.env.TWILIO_TEST_TONE === '1') {
                    console.log('🎼 Sending 1kHz test tone to Twilio (8kHz μ-law, 20ms frames)');
                    const sampleRate = 8000;
                    const durationMs = 2000;
                    const totalSamples = Math.floor(sampleRate * durationMs / 1000);
                    const pcm = Buffer.alloc(totalSamples * 2);
                    const freq = 1000;
                    const amplitude = 0.6;
                    for (let i = 0; i < totalSamples; i++) {
                        const t = i / sampleRate;
                        const s = Math.max(-1, Math.min(1, Math.sin(2 * Math.PI * freq * t))) * amplitude;
                        const s16 = Math.max(-32768, Math.min(32767, Math.round(s * 32767)));
                        pcm.writeInt16LE(s16, i * 2);
                    }
                    // PCM16 8k → μ-law
                    const ulaw = Buffer.from(convertPcm16ToMulaw(pcm.toString('base64')), 'base64');
                    // Send as 160-byte frames every ~20ms
                    let offset = 0;
                    const BYTES_PER_20MS = 160;
                    const sendFrame = () => {
                        if (isClosed || !(ws && ws.readyState === WebSocket.OPEN)) return;
                        if (offset >= ulaw.length) {
                            console.log('🎼 Test tone finished');
                            return;
                        }
                        const end = Math.min(offset + BYTES_PER_20MS, ulaw.length);
                        const frame = ulaw.slice(offset, end);
                        ws.send(JSON.stringify({
                            event: 'media',
                            streamSid,
                            track: 'outbound',
                            media: { payload: frame.toString('base64') }
                        }));
                        console.log(`📤 SENT TEST TONE FRAME ${frame.length}B`);
                        offset = end;
                        setTimeout(sendFrame, 20);
                    };
                    sendFrame();
                    // Do not set up OpenAI in test mode
                    ws.removeListener('message', messageHandler);
                    clearTimeout(startTimeout); // ✅ Clear the timeout since we got the start event
                    setupComplete = true; // ✅ Mark as complete to prevent timeout
                    return;
                }
                
                // Remove this handler and set up OpenAI
                ws.removeListener('message', messageHandler);
                setupOpenAI();
            } else if (json.event !== 'connected') {
                // Only log non-connected events
                console.log(`⏳ Waiting for start event, got: ${json.event}`);
            }
        } catch (err) {
            errorCount++;
            console.error('❌ Error parsing message:', err);
            
            if (errorCount >= MAX_ERROR_COUNT) {
                console.error(`❌ Too many errors (${errorCount}), closing connection`);
                cleanup('max_errors');
            }
        }
    };

    // Listen for messages until we get start event
    ws.on('message', messageHandler);

    // Timeout if no start event in 10 seconds
    startTimeout = setTimeout(() => {
        if (!setupComplete) {
            console.error('❌ Timeout waiting for start event');
            cleanup('start_timeout');
        }
    }, 10000);

    function setupOpenAI() {
        if (setupComplete || isClosed) return;
        setupComplete = true;
        clearTimeout(startTimeout); // Clear the start timeout

        try {
            console.log(`🚀 Setting up OpenAI connection for call: ${callSid}`);
            
            // Validate API key first
            if (!process.env.OPENAI_API_KEY) {
                console.error('❌ OPENAI_API_KEY is missing from environment variables');
                cleanup('missing_api_key');
                return;
            }
            
            console.log(`🔑 API key present: ${process.env.OPENAI_API_KEY.substring(0, 7)}...`);
            
            // Connect to OpenAI Realtime API
            const openaiUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
            console.log(`🔗 Connecting to OpenAI: ${openaiUrl}`);
            
            openaiWs = new WebSocket(openaiUrl, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'OpenAI-Beta': 'realtime=v1'
                }
            });
            
            console.log(`📡 WebSocket created, initial state: ${openaiWs.readyState} (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)`);

            // Connection timeout - close if OpenAI doesn't connect in 30 seconds
            const openaiTimeout = setTimeout(() => {
                if (!openaiReady && !isClosed) {
                    console.error(`❌ OpenAI connection timeout after 30s for call: ${callSid}`);
                    console.error(`❌ WebSocket state: ${openaiWs?.readyState} (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)`);
                    cleanup('openai_timeout');
                }
            }, 30000);

            // Store connections
            realtimeClients[callSid] = { twilioWs: ws, openaiWs, streamSid };
            conversations[callSid] = { transcript: [], language: 'en-US', realtimeWs: ws };

            // ✅ CRITICAL: Add error handler BEFORE 'open' to catch connection failures
            openaiWs.on('error', (err) => {
                console.error(`❌ OpenAI WebSocket ERROR for call ${callSid}:`, err);
                console.error(`❌ Error message: ${err.message}`);
                console.error(`❌ Error code: ${err.code}`);
                console.error(`❌ WebSocket state: ${openaiWs?.readyState}`);
                if (err.stack) {
                    console.error(`❌ Error stack: ${err.stack.substring(0, 200)}`);
                }
                errorCount++;
                if (errorCount >= MAX_ERROR_COUNT) {
                    cleanup('openai_error');
                }
            });

            // When OpenAI connects, initialize session
            openaiWs.on('open', () => {
                if (isClosed) return;
                clearTimeout(openaiTimeout);
                console.log(`✅ OpenAI connected for call: ${callSid}`);
                openaiReady = true;
                
                // Initialize the session first
                try {
                    openaiWs.send(JSON.stringify({
                        type: 'session.update',
                        session: {
                            modalities:['audio','text'],
                            instructions: `You are "Robert", Universal Motorcycle Training's AI phone agent. 
                            Speak in clear, calm, polite British English. 
                            Greet the caller warmly and ask how you can help them today.
                            Keep responses concise and natural.`,
                            voice: 'alloy',
                            temperature: 0.6, // FIXED: Minimum is 0.6 for Realtime API
                            input_audio_format: 'pcm16',
                            output_audio_format: 'pcm16',
                            turn_detection: {
                                type: 'server_vad',
                                threshold: 0.5,
                                prefix_padding_ms: 300,
                                silence_duration_ms: 500
                            }
                        }
                    }));
                    console.log(`📤 Sent session.update for call: ${callSid}`);
                } catch (err) {
                    errorCount++;
                    console.error('❌ Error sending session.update:', err);
                    if (errorCount >= MAX_ERROR_COUNT) {
                        cleanup('send_error');
                    }
                }
            });

            // Listen for OpenAI events - with error protection
            openaiWs.on('message', (data) => {
                if (isClosed) return;
                
                try {
                    const event = JSON.parse(data.toString());
                    
                    // Only log important events (skip audio deltas to reduce log spam)
                    if (event.type !== 'response.audio.delta' && 
                        event.type !== 'response.output_audio.delta' && 
                        event.type !== 'response.audio.done' &&
                        event.type !== 'response.audio_transcript.delta') {
                        console.log(`📥 OpenAI event [${event.type}] for call ${callSid}`);
                    }
                    
                    // Diagnostic: Log all audio-related events to debug
                    if (event.type.includes('audio')) {
                        console.log(`🎵 AUDIO EVENT: ${event.type} - has delta: ${!!event.delta}, length: ${event.delta?.length || 0}`);
                    }
                    
                    // Handle errors from OpenAI - CRITICAL: Don't continue if session fails
                    if (event.type === 'error') {
                        errorCount++;
                        console.error(`❌ OpenAI error for call ${callSid}:`, event.error);
                        
                        // If session update failed, try to recover with correct parameters
                        if (event.error?.param === 'session.temperature' || 
                            event.error?.code === 'decimal_below_min_value') {
                            console.log('🔄 Retrying session.update with corrected temperature...');
                            try {
                                openaiWs.send(JSON.stringify({
                                    type: 'session.update',
                                    session: {
                                        modalities: ['audio','text'],
                                        instructions: `You are "Robert", Universal Motorcycle Training's AI phone agent. 
                                        Speak in clear, calm, polite British English. 
                                        Greet the caller warmly and ask how you can help them today.
                                        Keep responses concise and natural.`,
                                        voice: 'alloy',
                                        temperature: 0.6, // Use minimum allowed value
                                        input_audio_format: 'pcm16',
                                        output_audio_format: 'pcm16',
                                        turn_detection: {
                                            type: 'server_vad',
                                            threshold: 0.5,
                                            prefix_padding_ms: 300,
                                            silence_duration_ms: 500
                                        }
                                    }
                                }));
                                return; // Don't increment error count for retry
                            } catch (retryErr) {
                                console.error('❌ Retry failed:', retryErr);
                            }
                        }
                        
                        // For other errors or if retry fails, check error count
                        if (errorCount >= MAX_ERROR_COUNT) {
                            cleanup('openai_error');
                            return;
                        }
                        return; // Don't process further on error
                    }
                    
                    // Log important events
                    if (event.type === 'session.updated') {
                        console.log(`✅ Session updated for call: ${callSid}`);
                        // Reset error count on successful session update
                        errorCount = 0;
                        
                        // ✅ CRITICAL: Trigger AI to speak FIRST with greeting
                        // Wait 1 second to ensure session is fully ready
                        setTimeout(() => {
                            if (isClosed || !openaiWs || openaiWs.readyState !== WebSocket.OPEN) {
                                console.log(`⚠️ Cannot create response - connection closed for call: ${callSid}`);
                                return;
                            }
                            
                            try {
                                // Trigger AI to speak first (no conversation items = audio generation)
                                openaiWs.send(JSON.stringify({
                                    type: 'response.create',
                                    response: {
                                        modalities: ['audio', 'text']
                                    }
                                }));
                                console.log(`🎯 TRIGGERED AI TO SPEAK FIRST (response.create) for call: ${callSid}`);
                            } catch (err) {
                                errorCount++;
                                console.error('❌ Error sending response.create:', err);
                                if (errorCount >= MAX_ERROR_COUNT) {
                                    cleanup('send_error');
                                }
                            }
                        }, 1000);
                    }
                    
                    // Handle audio deltas - support both possible event names
                    if ((event.type === 'response.audio.delta' || event.type === 'response.output_audio.delta') && event.delta) {
                        audioChunkCount++;
                        console.log(`🔊 CAPTURING AUDIO DELTA (${event.type}) - size: ${event.delta.length} bytes - chunk #${audioChunkCount}`);
                        
                        // Safety: Limit audio chunks to prevent runaway
                        if (audioChunkCount > MAX_AUDIO_BUFFER_SIZE * 100) {
                            console.error(`❌ Too many audio chunks (${audioChunkCount}), closing`);
                            cleanup('audio_limit');
                            return;
                        }
                        
                        if (ws.readyState === WebSocket.OPEN && streamSid && !isClosed) {
                            try {
                                // Start downsampler if needed; write PCM16 24k (base64) as raw bytes
                                startDownsampler();
                                const pcm24kBuf = Buffer.from(event.delta, 'base64');
                                // Gate by accepting to avoid writes after cleanup
                                if (accepting && downFfmpeg?.stdin?.writable) {
                                    downFfmpeg.stdin.write(pcm24kBuf);
                                }
                            } catch (err) {
                                errorCount++;
                                console.error('❌ Error sending audio to Twilio:', err);
                                if (errorCount >= MAX_ERROR_COUNT) {
                                    cleanup('send_error');
                                }
                            }
                        } else {
                            console.log(`⚠️ Cannot send audio - ws.readyState: ${ws.readyState}, streamSid: ${streamSid ? 'exists' : 'missing'}, isClosed: ${isClosed}`);
                        }
                    }
                    
                    // Handle response done
                    if (event.type === 'response.done') {
                        console.log(`✅ Response done for call: ${callSid}`);
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

            // Forward Twilio audio → OpenAI - with rate limiting
            ws.on('message', (data) => {
                if (isClosed || !openaiReady) {
                    if (!openaiReady) {
                        console.log(`⏳ Skipping Twilio message - OpenAI not ready yet for call: ${callSid}`);
                    }
                    return;
                }
                
                try {
                    const json = JSON.parse(data.toString());
                    
                    // Log non-media events
                    if (json.event !== 'media') {
                        console.log(`📨 Twilio event: ${json.event} for call: ${callSid}`);
                    }
                    
                    if (json.event === 'media' && json.media?.payload) {
                        audioChunkCount++;
                        
                        // Safety: Limit audio chunks
                        if (audioChunkCount > MAX_AUDIO_BUFFER_SIZE * 100) {
                            console.error(`❌ Too many audio chunks (${audioChunkCount}), closing`);
                            cleanup('audio_limit');
                            return;
                        }
                        
                        if (openaiWs && openaiWs.readyState === WebSocket.OPEN && !isClosed) {
                            try {
                                // ✅ μ-law (8k) → PCM16 8k → upsample to 24k via ffmpeg → send to OpenAI
                                startUpsampler();
                                const base64Pcm8k = convertMulawToPcm16(json.media.payload);
                                const pcm8kBuf = Buffer.from(base64Pcm8k, 'base64');
                                if (accepting && upFfmpeg?.stdin?.writable) {
                                    upFfmpeg.stdin.write(pcm8kBuf);
                                }
                            } catch (err) {
                                errorCount++;
                                console.error('❌ Error sending audio to OpenAI:', err);
                                if (errorCount >= MAX_ERROR_COUNT) {
                                    cleanup('send_error');
                                }
                            }
                        } else {
                            console.log(`⚠️ Cannot send to OpenAI - readyState: ${openaiWs?.readyState}, isClosed: ${isClosed}`);
                        }
                    }
                } catch (err) {
                    errorCount++;
                    console.error('❌ Error forwarding Twilio audio:', err);
                    if (errorCount >= MAX_ERROR_COUNT) {
                        cleanup('parse_error');
                    }
                }
            });

            // Cleanup on close - call immediately without checks
            ws.on('close', () => {
                cleanup('twilio_close');
            });

            openaiWs.on('close', () => {
                cleanup('openai_close');
            });
            
            // Note: Error handler is already set up earlier (before 'open' handler)
            
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

// ✅ Handle user responses (AI-driven)
// ✅ Handle user responses (AI-driven)
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
        // Generate AI reply
        const conversationText = conversations[callSid].transcript
            .map(t => `${t.role === "agent" ? "AI" : "User"}: ${t.text}`)
            .join("\n");

        const aiResponse = await getAIResponse(conversationText, null, { callSid });
        aiReply = aiResponse.content || "I understand. How else can I help?";
        
        // Add AI response to transcript
        conversations[callSid].transcript.push({ role: "agent", text: aiReply });
        
        console.log(`🤖 AI replied: "${aiReply}"`);
        
    } catch (error) {
        console.error("AI response error:", error);
        aiReply = "I'm sorry, I didn't catch that. Could you please repeat?";
        conversations[callSid].transcript.push({ role: "agent", text: aiReply });
    }

    // Generate TwiML response
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


// ✅ Recording
export const recordingStatus = async (req, res) => {
    const { RecordingUrl, CallSid } = req.body;
    try {
        if (conversations[CallSid]) {
            // Generate a short summary using AI
            let summary = "Summary not available";
            try {
                const transcriptText = conversations[CallSid].transcript
                    .map(t => `${t.role === "agent" ? "Agent" : "User"}: ${t.text}`)
                    .join("\n");

                    const summaryResponse = await getAIResponse(
                        `Summarize the following sales call in 2-3 sentences. 
                        Clearly mention the outcome (e.g., user interested, not interested, wants follow-up, unsure). 
                        Keep it short and professional.
                    
                        Transcript:
                        ${transcriptText}`
                    );
                    summary = summaryResponse.content;
            } catch (err) {
                console.error("Summary generation failed:", err.message);
            }

            // Mask PII in transcript for GDPR compliance
            const maskedTranscript = conversations[CallSid].transcript.map(entry => ({
                ...entry,
                text: gdprService.maskPII(entry.text || '', 'partial')
            }));

            const rec = new CallRecord({
                callSid: CallSid,
                from: conversations[CallSid].from || "Unknown",
                to: conversations[CallSid].to || "Unknown",
                transcript: maskedTranscript,
                recordingUrl: RecordingUrl,
                summary,
                language: conversations[CallSid].language || 'en',
                piiDetected: gdprService.detectPII(conversations[CallSid].transcript.map(t => t.text).join(' ')),
                gdprCompliant: true
            });
            await rec.save();
            
            // Log GDPR compliance
            await gdprService.logAuditEvent('call_recorded', {
                callSid: CallSid,
                recordingUrl: RecordingUrl,
                piiDetected: rec.piiDetected,
                language: rec.language
            });
            
            delete conversations[CallSid];

            const records = await CallRecord.find().sort({ createdAt: -1 });
            io.emit("all-calls", records);
        }
        res.sendStatus(200);
    } catch (err) {
        console.error("recording-status error:", err);
        res.sendStatus(500);
    }
};

// ✅ Get all calls
export const getAllCalls = async (req, res) => {
    const records = await CallRecord.find().sort({ createdAt: -1 });
    res.json(records);
};

// ✅ Proxy recording
export const proxyRecording = async (req, res) => {
    try {
        const rec = await CallRecord.findOne({ callSid: req.params.callSid });
        if (!rec || !rec.recordingUrl) return res.status(404).send("Recording not found");

        const twilioUrl = rec.recordingUrl + ".mp3";
        const response = await axios.get(twilioUrl, {
            auth: { username: process.env.TWILIO_SID, password: process.env.TWILIO_AUTH_TOKEN },
            responseType: "stream",
        });

        res.setHeader("Content-Type", "audio/mpeg");
        response.data.pipe(res);
    } catch (err) {
        console.error("recording proxy error:", err.message);
        res.status(500).send("Error fetching recording");
    }
};
