import provenanceService from './provenanceService.js';

class UncertaintyGateService {
  constructor() {
    this.defaultThreshold = 0.7;
    this.minPassages = 2;
    this.maxUncertaintyAttempts = 3;
  }

  // Validate search results against uncertainty gate
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
        fallbackAction: 'transfer'
      };

      // Check if we have enough results
      if (validation.passages.length < minPassages) {
        validation.confidence = this.calculateConfidence(validation.passages);
        validation.recommendations.push(`Need at least ${minPassages} passages, found ${validation.passages.length}`);
        validation.fallbackAction = 'clarify';
        return validation;
      }

      // Check similarity scores
      const validPassages = validation.passages.filter(p => p.similarityScore >= threshold);
      if (validPassages.length < minPassages) {
        validation.confidence = this.calculateConfidence(validation.passages);
        validation.recommendations.push(`Need at least ${minPassages} passages above ${threshold} threshold, found ${validPassages.length}`);
        validation.fallbackAction = 'clarify';
        return validation;
      }

      // Calculate overall confidence
      validation.confidence = this.calculateConfidence(validPassages);
      
      // Check provenance requirements
      if (requireProvenance) {
        validation.provenance = await this.validateProvenance(validPassages);
        if (validation.provenance.length === 0) {
          validation.recommendations.push('No valid provenance found');
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

      return validation;

    } catch (error) {
      console.error('Error validating results:', error);
      return {
        passed: false,
        confidence: 0,
        passages: [],
        provenance: [],
        recommendations: [`Validation error: ${error.message}`],
        fallbackAction: 'transfer'
      };
    }
  }

  // Calculate confidence score
  calculateConfidence(passages) {
    if (passages.length === 0) return 0;

    const scores = passages.map(p => p.similarityScore ?? p.similarity_score ?? 0);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    // Boost confidence for multiple sources
    const sourceBoost = Math.min(passages.length * 0.1, 0.3);
    
    return Math.min(averageScore + sourceBoost, 1.0);
  }

  // Validate provenance
  async validateProvenance(passages) {
    try {
      const provenance = [];
      
      for (const passage of passages) {
        if (passage.fileId) {
          // Check if file exists and is active
          const fileStats = await provenanceService.getFileUsageStats(passage.fileId);
          if (fileStats.totalUsage > 0) {
            provenance.push({
              fileId: passage.fileId,
              fileName: passage.fileName,
              similarityScore: passage.similarityScore,
              usageCount: fileStats.totalUsage,
              lastUsed: fileStats.lastUsed
            });
          }
        }
      }

      return provenance;

    } catch (error) {
      console.error('Error validating provenance:', error);
      return [];
    }
  }

  // Detect conflicting information
  detectConflicts(passages) {
    const conflicts = [];
    
    // Simple conflict detection based on content similarity
    for (let i = 0; i < passages.length; i++) {
      for (let j = i + 1; j < passages.length; j++) {
        const passage1 = passages[i];
        const passage2 = passages[j];
        
        // Check for contradictory keywords
        if (this.hasContradictoryKeywords(passage1.content, passage2.content)) {
          conflicts.push({
            passage1: passage1.fileName,
            passage2: passage2.fileName,
            reason: 'Contradictory keywords detected'
          });
        }
      }
    }

    return conflicts;
  }

  // Check for contradictory keywords
  hasContradictoryKeywords(content1, content2) {
    if (!content1 || !content2) return false;

    const contradictions = [
      ['yes', 'no'],
      ['required', 'optional'],
      ['free', 'paid'],
      ['available', 'unavailable'],
      ['open', 'closed']
    ];

    const content1Lower = content1.toLowerCase();
    const content2Lower = content2.toLowerCase();

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

  // Generate uncertainty response
  generateUncertaintyResponse(validation) {
    const responses = {
      clarify: [
        "I need to clarify a few details to give you the most accurate information.",
        "Let me ask a few questions to better understand what you're looking for.",
        "I want to make sure I give you the right information. Can you tell me more about...?"
      ],
      transfer: [
        "I'd like to connect you with one of our training specialists who can provide more detailed information.",
        "Let me transfer you to someone who can give you the most up-to-date information.",
        "I'll connect you with our team who can help with that specific question."
      ]
    };

    const action = validation.fallbackAction;
    const responseOptions = responses[action] || responses.transfer;
    
    return {
      action,
      message: responseOptions[Math.floor(Math.random() * responseOptions.length)],
      confidence: validation.confidence,
      reasons: validation.recommendations
    };
  }

  // Track uncertainty events
  async trackUncertaintyEvent(eventData) {
    try {
      const {
        callId,
        sessionId,
        userId,
        query,
        results,
        validation,
        response
      } = eventData;

      // Track in provenance
      await provenanceService.trackFileUsage({
        callId,
        sessionId,
        userId,
        query,
        results: results.results || [],
        model: 'gpt-realtime',
        confidence: validation.confidence,
        response: response.message,
        metadata: {
          uncertaintyGate: {
            passed: validation.passed,
            threshold: validation.threshold,
            passages: validation.passages.length,
            provenance: validation.provenance.length,
            recommendations: validation.recommendations
          }
        }
      });

    } catch (error) {
      console.error('Error tracking uncertainty event:', error);
      // Don't throw error as this is tracking only
    }
  }

  // Get uncertainty gate configuration
  getConfiguration() {
    return {
      defaultThreshold: this.defaultThreshold,
      minPassages: this.minPassages,
      maxUncertaintyAttempts: this.maxUncertaintyAttempts
    };
  }

  // Update uncertainty gate configuration
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





