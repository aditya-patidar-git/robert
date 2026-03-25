/**
 * Uncertainty Gate Service (Agent Service)
 * Validates search results against confidence thresholds and provenance requirements
 * Ported from backend service for agent service use
 */

class UncertaintyGateService {
  constructor() {
    this.defaultThreshold = 0.7;
    this.minPassages = 1; // Default minimum passages
    this.maxUncertaintyAttempts = 3;
  }

  /**
   * Validate search results against uncertainty gate
   * @param {Object} searchResults - Search results object with results array
   * @param {Object} options - Validation options
   * @param {number} options.threshold - Confidence threshold (0-1)
   * @param {number} options.minPassages - Minimum number of passages required
   * @param {boolean} options.requireProvenance - Whether to require provenance validation
   * @returns {Promise<Object>} Validation result
   */
  async validateResults(searchResults, options = {}) {
    try {
      const {
        threshold = this.defaultThreshold,
        minPassages = this.minPassages,
        requireProvenance = true
      } = options;

      const validation = {
        passed: false,
        confidence: 0,
        passages: searchResults.results || [],
        provenance: [],
        recommendations: [],
        fallbackAction: 'transfer',
        threshold: threshold,
        minPassages: minPassages
      };

      // Check if we have enough results
      if (validation.passages.length < minPassages) {
        validation.confidence = this.calculateConfidence(validation.passages);
        validation.recommendations.push(`Need at least ${minPassages} passages, found ${validation.passages.length}`);
        validation.fallbackAction = 'clarify';
        return validation;
      }

      // Check similarity scores
      const validPassages = validation.passages.filter(p => {
        const score = p.similarityScore || p.similarity_score || 0;
        return score >= threshold;
      });
      
      if (validPassages.length < minPassages) {
        validation.confidence = this.calculateConfidence(validation.passages);
        validation.recommendations.push(`Need at least ${minPassages} passages above ${threshold} threshold, found ${validPassages.length}`);
        validation.fallbackAction = 'clarify';
        return validation;
      }

      // Calculate overall confidence
      validation.confidence = this.calculateConfidence(validPassages);
      
      // Check provenance requirements (simplified - just check fileId exists)
      if (requireProvenance) {
        validation.provenance = this.validateProvenance(validPassages);
        if (validation.provenance.length === 0) {
          validation.recommendations.push('No valid provenance found (missing file IDs)');
          validation.fallbackAction = 'transfer';
          return validation;
        }
      }

      // Check for conflicting information
      const conflicts = this.detectConflicts(validPassages);
      if (conflicts.length > 0) {
        validation.recommendations.push(`Found ${conflicts.length} conflicting information sources`);
        validation.fallbackAction = 'clarify';
        return validation;
      }

      // All checks passed
      validation.passed = true;
      validation.recommendations.push('All uncertainty gate checks passed');
      validation.passages = validPassages; // Use only valid passages

      return validation;

    } catch (error) {
      console.error('Error validating results:', error);
      return {
        passed: false,
        confidence: 0,
        passages: [],
        provenance: [],
        recommendations: [`Validation error: ${error.message}`],
        fallbackAction: 'transfer',
        threshold: options.threshold || this.defaultThreshold,
        minPassages: options.minPassages || this.minPassages
      };
    }
  }

  /**
   * Calculate confidence score from passages
   * @param {Array} passages - Array of passage objects with similarityScore
   * @returns {number} Confidence score (0-1)
   */
  calculateConfidence(passages) {
    if (passages.length === 0) return 0;

    const scores = passages.map(p => p.similarityScore || p.similarity_score || 0);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    // Boost confidence for multiple sources
    const sourceBoost = Math.min(passages.length * 0.1, 0.3);
    
    return Math.min(averageScore + sourceBoost, 1.0);
  }

  /**
   * Validate provenance (simplified - check fileId exists)
   * @param {Array} passages - Array of passage objects
   * @returns {Array} Validated provenance array
   */
  validateProvenance(passages) {
    const provenance = [];
    
    for (const passage of passages) {
      if (passage.fileId || passage.file_id) {
        provenance.push({
          fileId: passage.fileId || passage.file_id,
          fileName: passage.fileName || passage.filename || 'Unknown',
          similarityScore: passage.similarityScore || passage.similarity_score || 0
        });
      }
    }

    return provenance;
  }

  /**
   * Detect conflicting information between passages
   * @param {Array} passages - Array of passage objects
   * @returns {Array} Array of conflict objects
   */
  detectConflicts(passages) {
    const conflicts = [];
    
    // Simple conflict detection based on content similarity
    for (let i = 0; i < passages.length; i++) {
      for (let j = i + 1; j < passages.length; j++) {
        const passage1 = passages[i];
        const passage2 = passages[j];
        
        // Same source file can mention both sides of a contrast (e.g. pricing tiers); only flag cross-file clashes
        const fid1 = passage1.fileId || passage1.file_id;
        const fid2 = passage2.fileId || passage2.file_id;
        if (fid1 && fid2 && fid1 === fid2) {
          continue;
        }

        // Check for contradictory keywords
        if (this.hasContradictoryKeywords(passage1.content, passage2.content)) {
          conflicts.push({
            passage1: passage1.fileName || passage1.filename || 'Unknown',
            passage2: passage2.fileName || passage2.filename || 'Unknown',
            reason: 'Contradictory keywords detected'
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Check for contradictory keywords in content
   * @param {string} content1 - First content string
   * @param {string} content2 - Second content string
   * @returns {boolean} True if contradictions found
   */
  hasContradictoryKeywords(content1, content2) {
    if (!content1 || !content2) return false;

    const contradictions = [
      ['yes', 'no'],
      ['required', 'optional'],
      ['free', 'paid'],
      ['available', 'unavailable'],
      ['open', 'closed'],
      ['included', 'excluded'],
      ['allowed', 'prohibited'],
      ['permitted', 'forbidden']
    ];

    const content1Lower = (content1 || '').toLowerCase();
    const content2Lower = (content2 || '').toLowerCase();

    for (const [word1, word2] of contradictions) {
      if (content1Lower.includes(word1) && content2Lower.includes(word2)) {
        return true;
      }
      if (content1Lower.includes(word2) && content2Lower.includes(word1)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate uncertainty response message
   * @param {Object} validation - Validation result object
   * @returns {Object} Response object with action and message
   */
  generateUncertaintyResponse(validation) {
    const responses = {
      clarify: [
        "I need to clarify a few details to give you the most accurate information.",
        "Let me ask a few questions to better understand what you're looking for.",
        "I want to make sure I give you the right information. Can you tell me more about what you need?",
        "I'd like to understand your question better. Could you provide a bit more detail?"
      ],
      transfer: [
        "I'd like to connect you with one of our training specialists who can provide more detailed information.",
        "Let me transfer you to someone who can give you the most up-to-date information.",
        "I'll connect you with our team who can help with that specific question.",
        "I don't have a definitive answer on that. Let me connect you to a colleague who can help."
      ]
    };

    const action = validation.fallbackAction || 'transfer';
    const responseOptions = responses[action] || responses.transfer;
    
    return {
      action,
      message: responseOptions[Math.floor(Math.random() * responseOptions.length)],
      confidence: validation.confidence,
      reasons: validation.recommendations
    };
  }

  /**
   * Get uncertainty gate configuration
   * @returns {Object} Configuration object
   */
  getConfiguration() {
    return {
      defaultThreshold: this.defaultThreshold,
      minPassages: this.minPassages,
      maxUncertaintyAttempts: this.maxUncertaintyAttempts
    };
  }

  /**
   * Update uncertainty gate configuration
   * @param {Object} config - Configuration updates
   */
  updateConfiguration(config) {
    if (config.defaultThreshold !== undefined) {
      this.defaultThreshold = Math.max(0, Math.min(1, config.defaultThreshold));
    }
    if (config.minPassages !== undefined) {
      this.minPassages = Math.max(1, config.minPassages);
    }
    if (config.maxUncertaintyAttempts !== undefined) {
      this.maxUncertaintyAttempts = Math.max(1, config.maxUncertaintyAttempts);
    }
  }
}

export default new UncertaintyGateService();

