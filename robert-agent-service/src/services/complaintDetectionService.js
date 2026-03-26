import { conversations } from '../shared/state.js';

class ComplaintDetectionService {
  constructor() {
    // High-risk keywords that require immediate escalation
    this.highRiskKeywords = [
      'injury', 'injured', 'hurt', 'accident', 'collision', 'crash',
      'safeguarding', 'abuse', 'harassment', 'discrimination', 'discriminate',
      'legal', 'lawyer', 'solicitor', 'sue', 'lawsuit', 'legal action',
      'press', 'media', 'newspaper', 'journalist', 'reporter'
    ];

    // Medium-risk keywords that may indicate complaints
    this.mediumRiskKeywords = [
      'complaint', 'complain', 'unsatisfied', 'disappointed', 'disappointing',
      'angry', 'frustrated', 'frustration', 'upset', 'unhappy',
      'poor service', 'bad experience', 'terrible', 'awful',
      'refund', 'compensation', 'demand', 'formal complaint'
    ];

    // Complaint types
    this.complaintTypes = {
      'safety': ['injury', 'accident', 'collision', 'crash', 'safeguarding'],
      'discrimination': ['discrimination', 'harassment', 'abuse'],
      'legal': ['legal', 'lawyer', 'solicitor', 'sue', 'lawsuit'],
      'media': ['press', 'media', 'newspaper', 'journalist'],
      'service': ['complaint', 'unsatisfied', 'disappointed', 'poor service'],
      'financial': ['refund', 'compensation', 'demand']
    };
  }

  /**
   * Detect complaint keywords in text
   * @param {string} text - Text to analyze
   * @returns {object} Detection result with risk level and keywords found
   */
  detectComplaintKeywords(text) {
    if (!text || typeof text !== 'string') {
      return {
        detected: false,
        riskLevel: 'none',
        keywords: [],
        complaintType: null
      };
    }

    const lowerText = text.toLowerCase();
    const foundHighRisk = [];
    const foundMediumRisk = [];

    // Check high-risk keywords
    for (const keyword of this.highRiskKeywords) {
      if (lowerText.includes(keyword)) {
        foundHighRisk.push(keyword);
      }
    }

    // Check medium-risk keywords
    for (const keyword of this.mediumRiskKeywords) {
      if (lowerText.includes(keyword)) {
        foundMediumRisk.push(keyword);
      }
    }

    // Determine risk level
    let riskLevel = 'none';
    let complaintType = null;

    if (foundHighRisk.length > 0) {
      riskLevel = 'high';
      // Determine complaint type from high-risk keywords
      for (const [type, keywords] of Object.entries(this.complaintTypes)) {
        if (keywords.some(kw => foundHighRisk.includes(kw))) {
          complaintType = type;
          break;
        }
      }
    } else if (foundMediumRisk.length > 0) {
      riskLevel = 'medium';
      complaintType = 'service';
    }

    return {
      detected: riskLevel !== 'none',
      riskLevel,
      keywords: [...foundHighRisk, ...foundMediumRisk],
      complaintType,
      highRiskKeywords: foundHighRisk,
      mediumRiskKeywords: foundMediumRisk
    };
  }

  /**
   * Monitor transcript for complaint keywords
   * @param {string} callSid - Call SID
   * @returns {object|null} Complaint detection result or null
   */
  monitorCall(callSid) {
    const conversation = conversations[callSid];
    if (!conversation || !conversation.transcript) {
      return null;
    }

    // Only classify complaint intent from the latest user utterance.
    // Using multiple recent turns can leak prior complaint keywords into unrelated follow-up questions.
    const lastUserMessage = [...conversation.transcript]
      .reverse()
      .find(entry => entry.role === 'user' && entry.text);

    if (!lastUserMessage?.text) {
      return null;
    }

    return this.detectComplaintKeywords(lastUserMessage.text);
  }

  /**
   * Extract complaint context from transcript
   * @param {string} callSid - Call SID
   * @returns {object} Complaint context
   */
  extractComplaintContext(callSid) {
    const conversation = conversations[callSid];
    if (!conversation || !conversation.transcript) {
      return {
        who: null,
        when: null,
        where: null,
        bookingRef: null,
        desiredOutcome: null,
        summary: null
      };
    }

    const transcript = conversation.transcript;
    const fullText = transcript.map(t => t.text).join(' ');

    // Extract booking reference
    const bookingRefMatch = fullText.match(/(?:booking|ref|reference)[\s:]*([A-Z0-9-]+)/i);
    const bookingRef = bookingRefMatch ? bookingRefMatch[1] : null;

    // Extract date/time
    const dateMatch = fullText.match(/(?:on|at|during)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    const when = dateMatch ? dateMatch[1] : null;

    // Extract location
    const locationMatch = fullText.match(/(?:at|in|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
    const where = locationMatch ? locationMatch[1] : null;

    // Extract desired outcome
    const outcomeMatch = fullText.match(/(?:want|need|expect|demand|require)\s+(.+?)(?:\.|$)/i);
    const desiredOutcome = outcomeMatch ? outcomeMatch[1].trim() : null;

    // Generate summary from recent exchanges
    const recentExchanges = transcript.slice(-5);
    const summary = recentExchanges
      .filter(e => e.role === 'user')
      .map(e => e.text)
      .join(' ');

    return {
      who: conversation.from || 'unknown',
      when,
      where,
      bookingRef,
      desiredOutcome,
      summary: summary || fullText.substring(0, 500)
    };
  }

  /**
   * Check if immediate escalation is required
   * @param {object} detectionResult - Result from detectComplaintKeywords
   * @returns {boolean} True if immediate escalation required
   */
  requiresImmediateEscalation(detectionResult) {
    return detectionResult.riskLevel === 'high';
  }

  /**
   * Get escalation reason from complaint type
   * @param {string} complaintType - Complaint type
   * @returns {string} Escalation reason
   */
  getEscalationReason(complaintType) {
    const reasonMap = {
      'safety': 'safety_concern',
      'discrimination': 'discrimination',
      'legal': 'legal_threat',
      'media': 'media_inquiry',
      'service': 'customer_complaint',
      'financial': 'customer_complaint'
    };
    return reasonMap[complaintType] || 'customer_complaint';
  }
}

export default new ComplaintDetectionService();

