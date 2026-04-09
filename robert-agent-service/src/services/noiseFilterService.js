import configManager from '../agent/configManager.js';

/**
 * Noise Filter Service
 * Industry-standard background noise filtering using multi-factor quality assessment
 * Zero latency impact - uses only existing transcription data
 */
class NoiseFilterService {
  constructor() {
    // Filler-only patterns (exclude "I" and "a" - they are content words and cause false positives)
    this.NOISE_PATTERNS = [
      /^(uh|um|ah|eh|hmm|huh|er|erm|mm|mhm)$/i,
      /^[h]{1,3}$/i,
      /^(mhm|uh-huh|uh-uh|ah-hah)$/i,
    ];
    
    this.MIN_CONFIDENCE = 0.70;
    this.MIN_TRANSCRIPT_LENGTH = 4;
    this.MAX_NOISE_RATIO = 0.3;
    this.MIN_QUALITY_SCORE = 0.7;
    this.CONFIRMATION_WHITELIST = new Set(['yes', 'no', 'ok', 'okay', 'yep', 'nope', 'yeah', 'nah', 'sure', 'right']);
  }

  isConfirmationWord(trimmed) {
    return trimmed && this.CONFIRMATION_WHITELIST.has(trimmed.toLowerCase());
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
   * Calculate noise ratio in transcript (filler words only).
   * @param {string} transcript - Transcript text
   * @param {boolean} forgiveFirst - If true, ignore first noise word (avoids failing on one "um")
   * @returns {{ ratio: number, wordCount: number }} - Ratio 0-1 and word count
   */
  calculateNoiseRatio(transcript, forgiveFirst = true) {
    if (!transcript || transcript.trim().length === 0) {
      return { ratio: 1.0, wordCount: 0 };
    }
    const words = transcript.trim().split(/\s+/);
    if (words.length === 0) {
      return { ratio: 1.0, wordCount: 0 };
    }
    const noiseWordCount = words.filter(word =>
      this.NOISE_PATTERNS.some(pattern => pattern.test(word))
    ).length;
    const effectiveNoise = forgiveFirst ? Math.max(0, noiseWordCount - 1) : noiseWordCount;
    return { ratio: effectiveNoise / words.length, wordCount: words.length };
  }

  /**
   * Industry-standard multi-factor quality assessment
   * @param {string} transcript - Transcription text
   * @param {number} confidence - Confidence score (0-1)
   * @param {string} itemId - Optional item ID for tracking
   * @param {{ postBargeInGrace?: boolean, spellingMode?: boolean, digitCollectionMode?: boolean }} [options] - postBargeInGrace: relax min length briefly after barge-in; spellingMode: caller is spelling an instructor name so accept single letters; digitCollectionMode: system is collecting phone numbers/digits so accept numeric-only transcripts
   * @returns {object} - Quality assessment result
   */
  assessTranscriptionQuality(transcript, confidence, itemId = null, options = {}) {
    // Get thresholds from config (or use defaults)
    const thresholds = this.getThresholds();
    const minLen =
      (options.postBargeInGrace === true || options.spellingMode === true) ? 1 : thresholds.minTranscriptLength;
    
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

    // Zero-alpha guard: transcripts with no Latin letters are never actionable
    // (pure punctuation like ".", "...", "?", emoji, or non-Latin script when session is English).
    // Single-letter transcripts are allowed so spelling mode still works.
    // Exception: when collecting phone numbers / digits, numeric-only transcripts are valid.
    const hasAlpha = /[a-zA-Z]/.test(trimmed);
    if (trimmed.length > 0 && !hasAlpha) {
      const isDigitString = options.digitCollectionMode === true && /^[\d\s\-\+\(\)\.]+$/.test(trimmed);
      if (!isDigitString) {
        return {
          isHighQuality: false,
          qualityScore: 0,
          confidenceScore: Math.round(confidenceScore * 100) / 100,
          passesConfidence: false,
          passesLength: false,
          passesPatternCheck: false,
          hasRepeatedChars: false,
          noiseRatio: 1,
          isBackgroundNoise: true,
          reason: 'no_alpha',
          itemId
        };
      }
    }
    
    // Factor 1: Confidence score (primary indicator - 40% weight)
    const passesConfidence = confidenceScore >= thresholds.minConfidence;
    
    const length = trimmed.length;
    const passesLength = length >= minLen || this.isConfirmationWord(trimmed);
    
    // Factor 3: Pattern-based noise detection (30% weight)
    const isNoisePattern = this.NOISE_PATTERNS.some(pattern => pattern.test(trimmed));
    const { ratio: noiseRatio, wordCount } = this.calculateNoiseRatio(trimmed);
    const passesPatternCheck = !isNoisePattern && (wordCount < 4 || noiseRatio <= thresholds.maxNoiseRatio);
    
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
   * @param {{ postBargeInGrace?: boolean }} [options]
   * @returns {boolean} - True if should prevent response loop
   */
  shouldPreventResponseLoop(transcript, timeSinceLastResponse, options = {}) {
    if (options.postBargeInGrace === true) {
      return false;
    }
    const trimmed = (transcript || '').trim();
    const isRecentResponse = timeSinceLastResponse < 2000; // Within 2 seconds
    
    if (isRecentResponse) {
      if (this.isConfirmationWord(trimmed)) return false;
      const isNoisePattern = this.NOISE_PATTERNS.some(pattern => pattern.test(trimmed));
      const { ratio: noiseRatio } = this.calculateNoiseRatio(trimmed);
      return isNoisePattern || noiseRatio > this.MAX_NOISE_RATIO || trimmed.length < this.MIN_TRANSCRIPT_LENGTH;
    }
    
    return false;
  }
}

export default new NoiseFilterService();
