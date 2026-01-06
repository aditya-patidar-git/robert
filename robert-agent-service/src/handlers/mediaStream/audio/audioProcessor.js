import { spawn } from "child_process";
import { convertPcm16ToMulaw } from "../../../utils/audioConversion.js";
import configManager from "../../../agent/configManager.js";
import audioCalibrationService from "../../../services/audioCalibrationService.js";

/**
 * ByteQueue for audio frame buffering
 */
export class ByteQueue {
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

/**
 * Audio Processor
 * Handles audio conversion, ffmpeg resampling, VAD calibration, and frame pacing
 */
export class AudioProcessor {
  constructor(stateManager, ws) {
    this.state = stateManager;
    this.ws = ws;
    this.FRAME_BYTES = 160;
    this.ulawQueue = new ByteQueue(6400);
    this.pacer = null;
    this.lastSendTs = Date.now();
    this.downFfmpeg = null;
    this.upFfmpeg = null;
  }

  /**
   * Start frame pacer for sending audio to Twilio
   */
  startPacer() {
    if (this.pacer) return;
    
    const tick = () => {
      if (this.state.isClosed || !this.state.accepting) {
        this.pacer = setTimeout(tick, 20);
        return;
      }
      
      if (!this.ws || this.ws.readyState !== 1 || !this.state.streamSid) {
        this.pacer = setTimeout(tick, 20);
        return;
      }
      
      const now = Date.now();
      const elapsed = now - this.lastSendTs;
      if (elapsed >= 20) {
        const frame = this.ulawQueue.shiftN(this.FRAME_BYTES);
        if (frame) {
          try {
            this.ws.send(JSON.stringify({
              event: 'media',
              streamSid: this.state.streamSid,
              media: { 
                payload: frame.toString('base64')
                // NO track field - Twilio automatically routes to outbound
              }
            }));
          } catch (err) {
            console.error(`❌ Failed to send frame: ${err.message}`);
          }
        }
        this.lastSendTs = now;
      }
      this.pacer = setTimeout(tick, Math.max(0, 20 - (Date.now() - this.lastSendTs)));
    };
    
    this.pacer = setTimeout(tick, 20);
  }

  /**
   * Start downsampler (24kHz -> 8kHz) for incoming audio
   */
  startDownsampler(onCalibrationComplete) {
    if (this.downFfmpeg) return;
    
    this.downFfmpeg = spawn('ffmpeg', [
      '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', 'pipe:0',
      '-f', 's16le', '-ar', '8000', '-ac', '1', 'pipe:1'
    ]);
    
    this.downFfmpeg.stdout.on('data', (chunk) => {
      if (this.state.isClosed || !this.state.accepting) return;
      
      const base64Pcm8k = chunk.toString('base64');
      
      // Capture audio samples for VAD calibration (first 3 seconds)
      if (!this.state.calibrationComplete) {
        const audioConfig = configManager.getAudioConfig();
        if (audioConfig?.energyThresholdAutoCalibrate !== false) {
          const pcm16Buffer = Buffer.from(base64Pcm8k, 'base64');
          if (!this.state.calibrationStartTime) {
            this.state.calibrationStartTime = Date.now();
            console.log(`📊 [${this.state.callSid}] Starting VAD calibration - capturing ${this.state.CALIBRATION_DURATION_MS}ms of audio`);
          }
          
          const elapsed = Date.now() - this.state.calibrationStartTime;
          if (elapsed < this.state.CALIBRATION_DURATION_MS) {
            this.state.calibrationSamples.push(pcm16Buffer);
          } else if (!this.state.calibrationComplete) {
            // Calibration period complete - perform calibration
            this.performCalibration(onCalibrationComplete);
          }
        } else {
          // Calibration disabled - mark as complete
          this.state.calibrationComplete = true;
        }
      }
      
      const mulawBase64 = convertPcm16ToMulaw(base64Pcm8k);
      const pushed = Buffer.from(mulawBase64, 'base64');
      this.ulawQueue.push(pushed);
      this.startPacer();
    });
    
    this.downFfmpeg.on('close', () => { this.downFfmpeg = null; });
    this.downFfmpeg.on('error', (err) => console.error('❌ ffmpeg downsampler error:', err));
  }

  /**
   * Perform VAD calibration after capturing initial audio samples
   */
  performCalibration(onCalibrationComplete) {
    if (this.state.calibrationComplete || !this.state.openaiWs || this.state.openaiWs.readyState !== 1) {
      return;
    }
    
    try {
      const audioConfig = configManager.getAudioConfig();
      const baseThreshold = (configManager.getConfigForNumber(this.state.phoneNumber).vadThreshold || 500) / 1000;
      
      const calibrated = audioCalibrationService.calibrateEnergyThreshold(
        this.state.callSid,
        this.state.calibrationSamples,
        baseThreshold
      );
      
      this.state.calibratedThreshold = calibrated;
      this.state.calibrationComplete = true;
      
      // Update session with calibrated threshold
      this.state.openaiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          turn_detection: {
            type: 'server_vad',
            threshold: calibrated,
            prefix_padding_ms: configManager.getConfigForNumber(this.state.phoneNumber).startPadding || 250,
            silence_duration_ms: configManager.getConfigForNumber(this.state.phoneNumber).endPadding || 500
          }
        }
      }));
      
      console.log(`✅ [${this.state.callSid}] VAD calibration complete - threshold updated to ${calibrated.toFixed(3)}s`);
      
      // Clear calibration samples to free memory
      this.state.calibrationSamples = [];
      
      if (onCalibrationComplete) {
        onCalibrationComplete(calibrated);
      }
    } catch (err) {
      console.error(`❌ [${this.state.callSid}] Error during VAD calibration:`, err);
      // Continue with base threshold if calibration fails
      this.state.calibrationComplete = true;
    }
  }

  /**
   * Start upsampler (8kHz -> 24kHz) for outgoing audio
   */
  startUpsampler() {
    if (this.upFfmpeg) return;
    
    this.upFfmpeg = spawn('ffmpeg', [
      '-f', 's16le', '-ar', '8000', '-ac', '1', '-i', 'pipe:0',
      '-f', 's16le', '-ar', '24000', '-ac', '1', 'pipe:1'
    ]);
    
    this.upFfmpeg.stdout.on('data', (chunk) => {
      if (this.state.isClosed || !this.state.accepting) return;
      
      const base64Pcm24k = chunk.toString('base64');
      if (this.state.openaiWs && this.state.openaiWs.readyState === 1) {
        try {
          this.state.openaiWs.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: base64Pcm24k
          }));
        } catch (_) {}
      }
    });
    
    this.upFfmpeg.on('close', () => { this.upFfmpeg = null; });
    this.upFfmpeg.on('error', (err) => console.error('❌ ffmpeg upsampler error:', err));
  }

  /**
   * Process incoming audio from Twilio
   * Sends μ-law directly to OpenAI (matching original implementation)
   */
  processIncomingAudio(mulawBase64) {
    if (this.state.isClosed || !this.state.accepting || !this.state.openaiWs || this.state.openaiWs.readyState !== 1) {
      return;
    }
    
    try {
      // Track audio metrics - use separate inbound counter
      this.state.audioChunkCount++;  // Keep for backward compatibility
      this.state.inboundAudioChunkCount++;  // Track inbound separately
      const now = Date.now();
      this.state.audioMetrics.incomingTimestamps.push(now);
      this.state.audioMetrics.receivedChunks++;
      
      // Send μ-law directly to OpenAI (matching original implementation)
      this.state.openaiWs.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: mulawBase64
      }));
    } catch (err) {
      console.error(`❌ [${this.state.callSid}] Error sending audio to OpenAI:`, err);
      this.state.incrementErrorCount();
    }
  }

  /**
   * Cleanup audio processors
   */
  cleanup() {
    if (this.pacer) {
      clearTimeout(this.pacer);
      this.pacer = null;
    }
    this.ulawQueue.clear();
    try {
      if (this.downFfmpeg) {
        this.downFfmpeg.kill('SIGKILL');
        this.downFfmpeg = null;
      }
    } catch (_) {}
    try {
      if (this.upFfmpeg) {
        this.upFfmpeg.kill('SIGKILL');
        this.upFfmpeg = null;
      }
    } catch (_) {}
  }
}

