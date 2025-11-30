import { conversations } from '../shared/state.js';

class ResponseValidationService {
  constructor() {
    this.minConfidenceThreshold = 0.7; // Minimum confidence for responses
    this.hallucinationKeywords = [
      'i don\'t know', 'i\'m not sure', 'i can\'t find', 'i don\'t have',
      'unclear', 'uncertain', 'maybe', 'possibly', 'perhaps'
    ];
  }

  /**
   * Validate AI response against KB sources
   * @param {string} callSid - Call SID
   * @param {string} responseText - AI response text
   * @param {Array} kbSources - Knowledge base sources used
   * @returns {Promise<{valid: boolean, confidence: number, issues: Array, shouldEscalate: boolean}>}
   */
  async validateResponse(callSid, responseText, kbSources = []) {
    try {
      const validation = {
        valid: true,
        confidence: 1.0,
        issues: [],
        shouldEscalate: false
      };

      // Check 1: Response has content
      if (!responseText || responseText.trim().length === 0) {
        validation.valid = false;
        validation.confidence = 0;
        validation.issues.push('Empty response');
        validation.shouldEscalate = true;
        return validation;
      }

      // Check 2: Check for hallucination indicators
      const responseLower = responseText.toLowerCase();
      const hallucinationCount = this.hallucinationKeywords.filter(keyword => 
        responseLower.includes(keyword)
      ).length;

      if (hallucinationCount > 2) {
        validation.valid = false;
        validation.confidence = Math.max(0, 1.0 - (hallucinationCount * 0.2));
        validation.issues.push(`Multiple uncertainty indicators detected (${hallucinationCount})`);
        validation.shouldEscalate = true;
      }

      // Check 3: Verify KB sources were used (if response claims facts)
      if (kbSources.length === 0 && this.containsFactualClaims(responseText)) {
        validation.valid = false;
        validation.confidence = 0.5;
        validation.issues.push('Factual claims made without KB sources');
        validation.shouldEscalate = true;
      }

      // Check 4: Check for unsupported claims
      const unsupportedClaims = this.detectUnsupportedClaims(responseText, kbSources);
      if (unsupportedClaims.length > 0) {
        validation.valid = false;
        validation.confidence = Math.max(0, validation.confidence - 0.3);
        validation.issues.push(`Unsupported claims: ${unsupportedClaims.join(', ')}`);
        validation.shouldEscalate = true;
      }

      // Check 5: Confidence threshold check
      if (validation.confidence < this.minConfidenceThreshold) {
        validation.shouldEscalate = true;
      }

      return validation;
    } catch (error) {
      console.error(`❌ [${callSid}] Error validating response:`, error);
      return {
        valid: false,
        confidence: 0,
        issues: [`Validation error: ${error.message}`],
        shouldEscalate: true
      };
    }
  }

  /**
   * Check if response contains factual claims
   * @param {string} responseText - Response text
   * @returns {boolean} True if contains factual claims
   */
  containsFactualClaims(responseText) {
    const factualIndicators = [
      'costs', 'price', 'fee', '£', 'pounds',
      'date', 'time', 'schedule', 'available',
      'requires', 'needs', 'must', 'should',
      'located', 'address', 'location'
    ];

    const responseLower = responseText.toLowerCase();
    return factualIndicators.some(indicator => responseLower.includes(indicator));
  }

  /**
   * Detect unsupported claims in response
   * @param {string} responseText - Response text
   * @param {Array} kbSources - KB sources
   * @returns {Array} List of unsupported claims
   */
  detectUnsupportedClaims(responseText, kbSources) {
    const unsupported = [];

    // Extract specific claims (dates, prices, requirements)
    const datePattern = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g;
    const pricePattern = /£\d+|\d+\s*pounds?/gi;
    const requirementPattern = /(?:must|required|need|should)\s+[^\.]+/gi;

    const dates = responseText.match(datePattern) || [];
    const prices = responseText.match(pricePattern) || [];
    const requirements = responseText.match(requirementPattern) || [];

    // Check if these claims are supported by KB sources
    const kbContent = kbSources.map(s => s.content || '').join(' ').toLowerCase();

    dates.forEach(date => {
      if (!kbContent.includes(date)) {
        unsupported.push(`Date: ${date}`);
      }
    });

    prices.forEach(price => {
      if (!kbContent.includes(price.toLowerCase())) {
        unsupported.push(`Price: ${price}`);
      }
    });

    return unsupported;
  }

  /**
   * Verify factual statements against KB
   * @param {string} statement - Statement to verify
   * @param {Array} kbSources - KB sources
   * @returns {boolean} True if verified
   */
  verifyFactualStatement(statement, kbSources) {
    if (!kbSources || kbSources.length === 0) {
      return false;
    }

    const statementLower = statement.toLowerCase();
    const kbContent = kbSources.map(s => s.content || '').join(' ').toLowerCase();

    // Simple keyword matching (can be enhanced with semantic similarity)
    const statementKeywords = statementLower.split(/\s+/).filter(w => w.length > 3);
    const matchingKeywords = statementKeywords.filter(keyword => 
      kbContent.includes(keyword)
    );

    // At least 50% of keywords should match
    return matchingKeywords.length / statementKeywords.length >= 0.5;
  }

  /**
   * Flag potential hallucinations
   * @param {string} responseText - Response text
   * @returns {boolean} True if potential hallucination detected
   */
  flagPotentialHallucination(responseText) {
    const responseLower = responseText.toLowerCase();
    
    // Check for multiple uncertainty indicators
    const uncertaintyCount = this.hallucinationKeywords.filter(keyword => 
      responseLower.includes(keyword)
    ).length;

    // Check for made-up details (specific numbers, dates without sources)
    const specificDetails = responseText.match(/\d+/g) || [];
    if (specificDetails.length > 3 && uncertaintyCount > 1) {
      return true;
    }

    return uncertaintyCount > 2;
  }
}

export default new ResponseValidationService();

