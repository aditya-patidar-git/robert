/**
 * Audio-specific logging utility for verbose debugging
 * Provides reusable logging functions for audio processing pipeline
 */

/**
 * Determine if verbose logging should be enabled for a chunk number
 * @param {number} chunkNumber - Current chunk number
 * @param {number} initialCount - Number of initial chunks to log (default: 20)
 * @param {number} periodicInterval - Log every Nth chunk after initial (default: 50)
 * @returns {boolean} - True if verbose logging should be enabled
 */
export function shouldLogVerbose(chunkNumber, initialCount = 20, periodicInterval = 50) {
  return chunkNumber <= initialCount || chunkNumber % periodicInterval === 0;
}

/**
 * Log section header for audio events
 * @param {string} callSid - Call SID
 * @param {string} title - Section title
 * @param {number} chunkNumber - Optional chunk number
 */
export function logSectionHeader(callSid, title, chunkNumber = null) {
  const chunkInfo = chunkNumber !== null ? ` #${chunkNumber}` : '';
  console.log(`\n${title}[${callSid}]${chunkInfo} ==========`);
}

/**
 * Log audio chunk details
 * @param {string} callSid - Call SID
 * @param {Buffer} audioChunk - Audio chunk buffer
 * @param {number} previewBytes - Number of bytes to preview (default: 10)
 */
export function logAudioChunkDetails(callSid, audioChunk, previewBytes = 10) {
  console.log(`   📦 Audio chunk details:`);
  console.log(`      - Buffer size: ${audioChunk.length} bytes`);
  console.log(`      - First ${previewBytes} bytes (hex): ${audioChunk.slice(0, previewBytes).toString('hex')}`);
  console.log(`      - First ${previewBytes} bytes (decimal): ${Array.from(audioChunk.slice(0, previewBytes)).join(', ')}`);
  if (audioChunk.length > previewBytes) {
    console.log(`      - Last ${previewBytes} bytes (hex): ${audioChunk.slice(-previewBytes).toString('hex')}`);
  }
}

/**
 * Log buffer state information
 * @param {string} callSid - Call SID
 * @param {number} bufferLengthBefore - Buffer length before operation
 * @param {number} addedLength - Length added to buffer
 * @param {number} bufferLengthAfter - Buffer length after operation
 */
export function logBufferState(callSid, bufferLengthBefore, addedLength, bufferLengthAfter) {
  console.log(`   📊 Buffer state:`);
  console.log(`      - Before: ${bufferLengthBefore} bytes`);
  console.log(`      - Added: ${addedLength} bytes`);
  console.log(`      - After: ${bufferLengthAfter} bytes`);
  console.log(`      - Available frames (160 bytes): ${Math.floor(bufferLengthAfter / 160)}`);
}

/**
 * Log connection state checks
 * @param {string} callSid - Call SID
 * @param {Object} state - State object with connection properties
 */
export function logConnectionState(callSid, state) {
  console.log(`   🔌 Connection state:`);
  console.log(`      - Twilio WS exists: ${!!state.ws}`);
  console.log(`      - Twilio WS readyState: ${state.ws?.readyState || 'N/A'} (1=OPEN, 2=CLOSING, 3=CLOSED)`);
  console.log(`      - streamSid: ${state.streamSid || 'MISSING'}`);
  console.log(`      - isClosed: ${state.isClosed || false}`);
  console.log(`      - accepting: ${state.accepting !== undefined ? state.accepting : 'N/A'}`);
}

/**
 * Log format conversion details
 * @param {string} callSid - Call SID
 * @param {boolean} isPcm16 - Whether format is PCM16
 * @param {number} inputSize - Input buffer size
 * @param {number} outputSize - Output buffer size (if converted)
 * @param {Buffer} outputBuffer - Output buffer for preview
 */
export function logFormatConversion(callSid, isPcm16, inputSize, outputSize = null, outputBuffer = null) {
  console.log(`   🔍 Format detection:`);
  console.log(`      - Detected as PCM16: ${isPcm16}`);
  console.log(`      - Input size: ${inputSize} bytes`);
  
  if (isPcm16 && outputSize !== null) {
    console.log(`   🔄 Conversion: PCM16 → g711_ulaw`);
    console.log(`      - Output size: ${outputSize} bytes`);
    if (outputBuffer && outputBuffer.length > 0) {
      console.log(`      - Output preview (hex): ${outputBuffer.slice(0, 10).toString('hex')}`);
    }
  } else if (!isPcm16) {
    console.log(`   ✅ No conversion needed - assuming g711_ulaw format`);
  }
}

/**
 * Log frame analysis (silence detection, etc.)
 * @param {string} callSid - Call SID
 * @param {Buffer} frame - Audio frame buffer
 * @param {number} previewBytes - Number of bytes to preview (default: 20)
 */
export function logFrameAnalysis(callSid, frame, previewBytes = 20) {
  // Calculate silence ratio
  let silenceCount = 0;
  for (let i = 0; i < frame.length; i++) {
    const byte = frame[i];
    if (byte === 0xFF || byte === 0x7F || (byte >= 0x7C && byte <= 0x83)) {
      silenceCount++;
    }
  }
  const silenceRatio = silenceCount / frame.length;
  
  console.log(`   🔍 Frame analysis:`);
  console.log(`      - Frame size: ${frame.length} bytes`);
  console.log(`      - Silence bytes: ${silenceCount}/${frame.length}`);
  console.log(`      - Silence ratio: ${(silenceRatio * 100).toFixed(2)}%`);
  console.log(`      - First ${previewBytes} bytes (hex): ${frame.slice(0, previewBytes).toString('hex')}`);
  console.log(`      - First ${previewBytes} bytes (decimal): ${Array.from(frame.slice(0, previewBytes)).join(', ')}`);
  if (frame.length > previewBytes) {
    console.log(`      - Last 10 bytes (hex): ${frame.slice(-10).toString('hex')}`);
  }
  console.log(`      - Unique byte values: ${new Set(Array.from(frame)).size}`);
  
  if (silenceRatio > 0.9) {
    console.warn(`   ⚠️ WARNING: Frame is mostly silence (${(silenceRatio * 100).toFixed(1)}%)`);
  } else {
    console.log(`   ✅ Frame contains audio data`);
  }
  
  return silenceRatio;
}

/**
 * Log timing information
 * @param {string} callSid - Call SID
 * @param {Object} timing - Timing object with current, lastSend, interval, etc.
 */
export function logTimingInfo(callSid, timing) {
  console.log(`   ⏱️ Timing:`);
  console.log(`      - Current time: ${timing.now || Date.now()}`);
  console.log(`      - Last send time: ${timing.lastSendTime || 'N/A'}`);
  console.log(`      - Time since last send: ${timing.timeSinceLastSend || 'N/A'}ms`);
  console.log(`      - Required interval: ${timing.requiredInterval || 'N/A'}ms`);
  console.log(`      - Can send immediately: ${timing.canSendImmediately || false}`);
}

/**
 * Log media message details before sending
 * @param {string} callSid - Call SID
 * @param {Object} mediaMessage - Media message object
 */
export function logMediaMessage(callSid, mediaMessage) {
  console.log(`   📨 Media message:`);
  console.log(`      - event: ${mediaMessage.event}`);
  console.log(`      - streamSid: ${mediaMessage.streamSid || 'MISSING'}`);
  console.log(`      - track: ${mediaMessage.media?.track || 'MISSING'}`);
  console.log(`      - payload length: ${mediaMessage.media?.payload?.length || 0} chars (base64)`);
  const messageSize = JSON.stringify(mediaMessage).length;
  console.log(`      - Full message size: ${messageSize} bytes`);
}
