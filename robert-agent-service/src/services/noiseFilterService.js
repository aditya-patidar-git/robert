import configManager from '../agent/configManager.js';

/**
 * Noise Filter Service
 * Industry-standard background noise filtering using multi-factor quality assessment
 * Zero latency impact - uses only existing transcription data
 */
class NoiseFilterService {
  constructor() {
    // Industry-standard noise patterns (filler words, non-speech sounds)
    this.NOISE_PATTERNS = [
      /^(uh|um|ah|eh|hmm|huh|er|erm|mm|mhm)$/i,           // Filler words
      /^(a|e|i|o|u)$/i,                                  // Single vowels (likely noise)
      /^[h]{1,3}$/i,                                     // Just "h" sounds
      /^(mhm|uh-huh|uh-uh|ah-hah)$/i,                   // Non-verbal responses
      /^[^a-zA-Z0-9\s]+$/,                              // Only special characters
    ];
    
    // Default thresholds (can be overridden by config)
    this.MIN_CONFIDENCE = 0.70;  // Stricter: 70% (industry: 0.65-0.75)
    this.MIN_TRANSCRIPT_LENGTH = 4;  // At least 4 characters
    this.MAX_NOISE_RATIO = 0.3;  // Max 30% of transcript can be noise patterns
    this.MIN_QUALITY_SCORE = 0.7;  // Minimum composite quality score
  }

  /**
   * Get thresholds from config (if available) or use defaults
   */
  getThresholds() {
    try {
      const audioConfig = configManager.getAudioConfig();
      const noiseFiltering = audioConfig?.noiseFiltering || {};
      
      return {
        minConfidence: noiseFiltering.minConfidence ?? this.MIN_CONFIDENCE,
        minTranscriptLength: noiseFiltering.minTranscriptLength ?? this.MIN_TRANSCRIPT_LENGTH,
        maxNoiseRatio: noiseFiltering.maxNoiseRatio ?? this.MAX_NOISE_RATIO,
        minQualityScore: noiseFiltering.minQualityScore ?? this.MIN_QUALITY_SCORE,
        enabled: noiseFiltering.enabled !== false // Default to true
      };
    } catch (err) {
      // If config not available, use defaults
      return {
        minConfidence: this.MIN_CONFIDENCE,
        minTranscriptLength: this.MIN_TRANSCRIPT_LENGTH,
        maxNoiseRatio: this.MAX_NOISE_RATIO,
        minQualityScore: this.MIN_QUALITY_SCORE,
        enabled: true
      };
    }
  }

  /**
   * Calculate noise ratio in transcript
   * @param {string} transcript - Transcript text
   * @returns {number} - Ratio of noise words (0-1)
   */
  calculateNoiseRatio(transcript) {
    if (!transcript || transcript.trim().length === 0) {
      return 1.0; // Empty = 100% noise
    }
    
    const words = transcript.trim().split(/\s+/);
    if (words.length === 0) {
      return 1.0;
    }
    
    const noiseWordCount = words.filter(word => 
      this.NOISE_PATTERNS.some(pattern => pattern.test(word))
    ).length;
    
    return noiseWordCount / words.length;
  }

  /**
   * Industry-standard multi-factor quality assessment
   * @param {string} transcript - Transcription text
   * @param {number} confidence - Confidence score (0-1)
   * @param {string} itemId - Optional item ID for tracking
   * @returns {object} - Quality assessment result
   */
  assessTranscriptionQuality(transcript, confidence, itemId = null) {
    // Get thresholds from config (or use defaults)
    const thresholds = this.getThresholds();
    
    // If noise filtering is disabled, accept all transcriptions
    if (!thresholds.enabled) {
      return {
        isHighQuality: true,
        qualityScore: 1.0,
        confidenceScore: Math.round((confidence || 1.0) * 100) / 100,
        passesConfidence: true,
        passesLength: true,
        passesPatternCheck: true,
        hasRepeatedChars: false,
        noiseRatio: 0,
        isBackgroundNoise: false,
        reason: 'filtering_disabled',
        itemId
      };
    }
    
    const trimmed = (transcript || '').trim();
    const confidenceScore = confidence || 0;
    
    // Factor 1: Confidence score (primary indicator - 40% weight)
    const passesConfidence = confidenceScore >= thresholds.minConfidence;
    
    // Factor 2: Length check (20% weight)
    const length = trimmed.length;
    const passesLength = length >= thresholds.minTranscriptLength;
    
    // Factor 3: Pattern-based noise detection (30% weight)
    const isNoisePattern = this.NOISE_PATTERNS.some(pattern => pattern.test(trimmed));
    const noiseRatio = this.calculateNoiseRatio(trimmed);
    const passesPatternCheck = !isNoisePattern && noiseRatio <= thresholds.maxNoiseRatio;
    
    // Factor 4: Character composition (10% weight)
    // Too many repeated characters = likely noise (e.g., "aaaaa", "hhhhh")
    const hasRepeatedChars = /(.)\1{4,}/.test(trimmed); // 5+ repeated chars
    
    // Composite quality score (weighted)
    const qualityScore = (
      (passesConfidence ? 0.4 : 0) +
      (passesLength ? 0.2 : 0) +
      (passesPatternCheck ? 0.3 : 0) +
      (!hasRepeatedChars ? 0.1 : 0)
    );
    
    // High quality = passes all checks AND meets minimum score
    const isHighQuality = qualityScore >= thresholds.minQualityScore && 
                         passesConfidence && 
                         passesLength && 
                         passesPatternCheck && 
                         !hasRepeatedChars;
    
    // Determine reason for filtering
    let reason = 'high_quality';
    if (!passesConfidence) {
      reason = 'low_confidence';
    } else if (!passesLength) {
      reason = 'too_short';
    } else if (isNoisePattern) {
      reason = 'noise_pattern';
    } else if (noiseRatio > thresholds.maxNoiseRatio) {
      reason = 'high_noise_ratio';
    } else if (hasRepeatedChars) {
      reason = 'repeated_chars';
    }
    
    return {
      isHighQuality,
      qualityScore: Math.round(qualityScore * 100) / 100, // Round to 2 decimals
      confidenceScore: Math.round(confidenceScore * 100) / 100,
      passesConfidence,
      passesLength,
      passesPatternCheck,
      hasRepeatedChars,
      noiseRatio: Math.round(noiseRatio * 100) / 100,
      isBackgroundNoise: !isHighQuality, // Flag for response prevention
      reason,
      itemId
    };
  }

  /**
   * Check if transcription should trigger response loop prevention
   * @param {string} transcript - Transcription text
   * @param {number} timeSinceLastResponse - Milliseconds since last agent response
   * @returns {boolean} - True if should prevent response loop
   */
  shouldPreventResponseLoop(transcript, timeSinceLastResponse) {
    const trimmed = (transcript || '').trim();
    const isRecentResponse = timeSinceLastResponse < 2000; // Within 2 seconds
    
    // If recent response and transcript looks like noise, prevent loop
    if (isRecentResponse) {
      const isNoisePattern = this.NOISE_PATTERNS.some(pattern => pattern.test(trimmed));
      const noiseRatio = this.calculateNoiseRatio(trimmed);
      
      return isNoisePattern || noiseRatio > this.MAX_NOISE_RATIO || trimmed.length < this.MIN_TRANSCRIPT_LENGTH;
    }
    
    return false;
  }
}

export default new NoiseFilterService();
