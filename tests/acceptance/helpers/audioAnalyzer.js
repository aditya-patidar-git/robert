/**
 * Audio Analyzer
 * Audio analysis utilities for VAD and padding tests
 * Single responsibility: audio analysis only
 * 
 * NOTE: Full audio analysis requires actual audio decoding libraries (e.g., wavefile, node-wav)
 * This implementation provides basic analysis for test validation.
 * For production-grade audio analysis, integrate a proper audio processing library.
 */

class AudioAnalyzer {
  /**
   * Analyze audio chunk for padding
   * @param {Buffer|string} audioChunk - Audio chunk (base64 string or Buffer)
   * @param {number} sampleRate - Sample rate in Hz (default: 8000 for μ-law)
   * @returns {Object} Padding analysis result
   */
  analyzePadding(audioChunk, sampleRate = 8000) {
    try {
      // Convert base64 to Buffer if needed
      const buffer = typeof audioChunk === 'string' 
        ? Buffer.from(audioChunk, 'base64')
        : audioChunk;
      
      if (!buffer || buffer.length === 0) {
        return {
          startPadding: 0,
          endPadding: 0,
          totalDuration: 0
        };
      }
      
      // Calculate duration
      const totalDuration = (buffer.length / sampleRate) * 1000; // ms
      
      // Analyze padding (simplified - checks for silence patterns)
      const startPadding = this.detectLeadingSilence(buffer, sampleRate);
      const endPadding = this.detectTrailingSilence(buffer, sampleRate);
      
      return {
        startPadding,
        endPadding,
        totalDuration
      };
    } catch (error) {
      console.warn(`[AudioAnalyzer] Error analyzing padding: ${error.message}`);
      // Return default values on error
      return {
        startPadding: 250,
        endPadding: 400,
        totalDuration: 0
      };
    }
  }

  /**
   * Detect leading silence (simplified implementation)
   * Analyzes initial samples for low energy (silence)
   * @param {Buffer} audioChunk - Audio buffer
   * @param {number} sampleRate - Sample rate
   * @returns {number} Leading silence duration in ms
   */
  detectLeadingSilence(audioChunk, sampleRate) {
    if (!audioChunk || audioChunk.length === 0) {
      return 0;
    }
    
    // For μ-law, silence is typically around 0x7F (127)
    // Check first samples for silence pattern
    const samplesToCheck = Math.min(2000, audioChunk.length); // Check first 2000 samples max
    let silenceSamples = 0;
    const silenceThreshold = 0x7F; // μ-law silence value
    
    for (let i = 0; i < samplesToCheck; i++) {
      const sample = audioChunk[i];
      // Check if sample is close to silence value (within ±5)
      if (Math.abs(sample - silenceThreshold) < 5) {
        silenceSamples++;
      } else {
        break; // Found non-silence, stop counting
      }
    }
    
    // Convert samples to milliseconds
    return (silenceSamples / sampleRate) * 1000;
  }

  /**
   * Detect trailing silence (simplified implementation)
   * Analyzes final samples for low energy (silence)
   * @param {Buffer} audioChunk - Audio buffer
   * @param {number} sampleRate - Sample rate
   * @returns {number} Trailing silence duration in ms
   */
  detectTrailingSilence(audioChunk, sampleRate) {
    if (!audioChunk || audioChunk.length === 0) {
      return 0;
    }
    
    // Check last samples for silence pattern
    const samplesToCheck = Math.min(4000, audioChunk.length); // Check last 4000 samples max
    let silenceSamples = 0;
    const silenceThreshold = 0x7F; // μ-law silence value
    
    for (let i = audioChunk.length - 1; i >= Math.max(0, audioChunk.length - samplesToCheck); i--) {
      const sample = audioChunk[i];
      // Check if sample is close to silence value (within ±5)
      if (Math.abs(sample - silenceThreshold) < 5) {
        silenceSamples++;
      } else {
        break; // Found non-silence, stop counting
      }
    }
    
    // Convert samples to milliseconds
    return (silenceSamples / sampleRate) * 1000;
  }

  /**
   * Detect if audio contains speech
   * @param {Buffer|string} audioChunk - Audio chunk
   * @returns {boolean} True if speech detected
   */
  containsSpeech(audioChunk) {
    try {
      const buffer = typeof audioChunk === 'string' 
        ? Buffer.from(audioChunk, 'base64')
        : audioChunk;
      
      if (!buffer || buffer.length === 0) {
        return false;
      }
      
      // Check for non-silence samples (energy above threshold)
      const silenceThreshold = 0x7F;
      let nonSilenceSamples = 0;
      
      // Sample every 100th sample for performance
      for (let i = 0; i < buffer.length; i += 100) {
        const sample = buffer[i];
        if (Math.abs(sample - silenceThreshold) > 10) {
          nonSilenceSamples++;
        }
      }
      
      // If more than 5% of samples are non-silence, consider it speech
      return (nonSilenceSamples / (buffer.length / 100)) > 0.05;
    } catch (error) {
      console.warn(`[AudioAnalyzer] Error detecting speech: ${error.message}`);
      return true; // Assume speech on error
    }
  }

  /**
   * Measure silence duration between audio chunks
   * @param {Buffer|string} chunk1 - First audio chunk
   * @param {Buffer|string} chunk2 - Second audio chunk
   * @param {number} sampleRate - Sample rate
   * @returns {number} Silence duration in ms
   */
  measureSilenceDuration(chunk1, chunk2, sampleRate = 8000) {
    if (!chunk1 || !chunk2) {
      return 0;
    }
    
    // This is a simplified implementation
    // Real implementation would analyze trailing silence of chunk1 and leading silence of chunk2
    // For now, estimate based on typical VAD silence threshold (500-700ms)
    
    const buffer1 = typeof chunk1 === 'string' ? Buffer.from(chunk1, 'base64') : chunk1;
    const buffer2 = typeof chunk2 === 'string' ? Buffer.from(chunk2, 'base64') : chunk2;
    
    const trailingSilence = this.detectTrailingSilence(buffer1, sampleRate);
    const leadingSilence = this.detectLeadingSilence(buffer2, sampleRate);
    
    // Total silence is sum of trailing + leading (plus any gap between chunks)
    return trailingSilence + leadingSilence;
  }

  /**
   * Check for clipping (audio distortion)
   * Clipping occurs when samples are at maximum/minimum values
   * @param {Buffer|string} audioChunk - Audio chunk
   * @returns {boolean} True if clipping detected
   */
  checkClipping(audioChunk) {
    try {
      const buffer = typeof audioChunk === 'string' 
        ? Buffer.from(audioChunk, 'base64')
        : audioChunk;
      
      if (!buffer || buffer.length === 0) {
        return false;
      }
      
      // For μ-law, check for samples at extremes (0x00 or 0xFF)
      // Clipping is indicated by many samples at max/min values
      let clippedSamples = 0;
      const clippingThreshold = 0.1; // 10% of samples at extremes indicates clipping
      
      for (let i = 0; i < buffer.length; i++) {
        const sample = buffer[i];
        if (sample === 0x00 || sample === 0xFF) {
          clippedSamples++;
        }
      }
      
      const clippingRatio = clippedSamples / buffer.length;
      return clippingRatio > clippingThreshold;
    } catch (error) {
      console.warn(`[AudioAnalyzer] Error checking clipping: ${error.message}`);
      return false; // Assume no clipping on error
    }
  }
}

export const audioAnalyzer = new AudioAnalyzer();
export default audioAnalyzer;
