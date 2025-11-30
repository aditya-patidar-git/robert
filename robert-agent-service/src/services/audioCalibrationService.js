/**
 * Audio Calibration Service
 * Handles adaptive energy threshold calibration for VAD based on line noise
 */

class AudioCalibrationService {
  constructor() {
    this.calibrationCache = new Map(); // Cache calibrated thresholds per phone number
    this.calibrationWindow = 3000; // 3 seconds of audio for calibration
    this.minSamples = 100; // Minimum samples needed for calibration
  }

  /**
   * Detect noise level from audio buffer using RMS (Root Mean Square) energy
   * @param {Buffer} audioBuffer - PCM16 audio samples
   * @returns {number} - RMS energy value (0-100 scale)
   */
  detectNoiseLevel(audioBuffer) {
    if (!audioBuffer || audioBuffer.length === 0) {
      return 0;
    }

    // Convert buffer to array of 16-bit signed integers
    const samples = [];
    for (let i = 0; i < audioBuffer.length; i += 2) {
      if (i + 1 < audioBuffer.length) {
        const sample = audioBuffer.readInt16LE(i);
        samples.push(sample);
      }
    }

    if (samples.length === 0) {
      return 0;
    }

    // Calculate RMS (Root Mean Square) energy
    let sumSquares = 0;
    for (const sample of samples) {
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / samples.length);

    // Normalize to 0-100 scale (16-bit audio max is 32768)
    const normalized = (rms / 32768) * 100;
    return Math.min(100, Math.max(0, normalized));
  }

  /**
   * Adjust VAD threshold based on detected noise level
   * @param {number} noiseLevel - RMS energy level (0-100)
   * @param {number} baseThreshold - Base threshold from config (in seconds, typically 0.5-0.7)
   * @returns {number} - Calibrated threshold in seconds
   */
  adjustVADThreshold(noiseLevel, baseThreshold) {
    // Noise level interpretation:
    // 0-20: Very quiet (lower threshold = more sensitive)
    // 20-40: Normal/quiet
    // 40-60: Moderate noise
    // 60-80: High noise
    // 80-100: Very noisy (higher threshold = less sensitive)

    let adjustment = 0;

    if (noiseLevel < 20) {
      // Very quiet - make more sensitive (lower threshold)
      adjustment = -0.1;
    } else if (noiseLevel < 40) {
      // Normal - slight sensitivity increase
      adjustment = -0.05;
    } else if (noiseLevel < 60) {
      // Moderate noise - use base threshold
      adjustment = 0;
    } else if (noiseLevel < 80) {
      // High noise - less sensitive (higher threshold)
      adjustment = 0.1;
    } else {
      // Very noisy - significantly less sensitive
      adjustment = 0.2;
    }

    const calibratedThreshold = baseThreshold + adjustment;
    
    // Clamp to reasonable bounds (0.3 to 1.0 seconds)
    return Math.max(0.3, Math.min(1.0, calibratedThreshold));
  }

  /**
   * Calibrate energy threshold for a call
   * @param {string} callSid - Call SID
   * @param {Buffer[]} initialAudioSamples - Array of audio buffers from first 2-3 seconds
   * @param {number} baseThreshold - Base threshold from AudioConfig (in seconds)
   * @returns {number} - Calibrated threshold in seconds
   */
  calibrateEnergyThreshold(callSid, initialAudioSamples, baseThreshold = 0.5) {
    if (!initialAudioSamples || initialAudioSamples.length === 0) {
      console.log(`⚠️ [${callSid}] No audio samples provided for calibration, using base threshold`);
      return baseThreshold;
    }

    // Combine all audio samples into single buffer
    const totalLength = initialAudioSamples.reduce((sum, buf) => sum + buf.length, 0);
    if (totalLength < this.minSamples * 2) { // 2 bytes per sample (16-bit)
      console.log(`⚠️ [${callSid}] Insufficient audio samples for calibration (${totalLength} bytes), using base threshold`);
      return baseThreshold;
    }

    const combinedBuffer = Buffer.concat(initialAudioSamples);

    // Detect noise level
    const noiseLevel = this.detectNoiseLevel(combinedBuffer);
    console.log(`📊 [${callSid}] Noise level detected: ${noiseLevel.toFixed(2)}%`);

    // Adjust threshold based on noise
    const calibratedThreshold = this.adjustVADThreshold(noiseLevel, baseThreshold);
    
    console.log(`✅ [${callSid}] VAD threshold calibrated: ${baseThreshold}s → ${calibratedThreshold.toFixed(3)}s (noise: ${noiseLevel.toFixed(1)}%)`);

    return calibratedThreshold;
  }

  /**
   * Clear calibration cache (useful for testing or reset)
   */
  clearCache() {
    this.calibrationCache.clear();
  }
}

export default new AudioCalibrationService();

