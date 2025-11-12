class FlowDetectionService {
  constructor() {
    // Booking-related keywords
    this.bookingKeywords = [
      'book', 'booking', 'schedule', 'appointment', 'reserve', 'reservation',
      'availability', 'available', 'slot', 'time', 'date', 'when can',
      'make an appointment', 'set up', 'arrange'
    ];

    // Complaint-related keywords
    this.complaintKeywords = [
      'complaint', 'complain', 'issue', 'problem', 'unsatisfied', 'disappointed',
      'angry', 'frustrated', 'unhappy', 'poor service', 'bad experience',
      'wrong', 'mistake', 'error', 'not working', 'broken', 'refund'
    ];

    // Human transfer request keywords
    this.transferKeywords = [
      'human', 'person', 'agent', 'representative', 'speak to someone',
      'talk to someone', 'transfer', 'escalate', 'escalation', 'manager',
      'supervisor', 'help me', 'can\'t help', 'need help'
    ];

    // Information request indicators (more general)
    this.informationKeywords = [
      'what', 'how', 'when', 'where', 'why', 'tell me', 'explain',
      'information', 'question', 'inquire', 'policy', 'procedure'
    ];
  }

  /**
   * Main method to detect flow type from conversation
   * @param {string} conversationText - Full conversation text
   * @param {Array} transcript - Array of transcript entries
   * @param {Object} callContext - Call context information
   * @returns {string} - Detected flow type
   */
  detectFlow(conversationText, transcript = [], callContext = {}) {
    if (!conversationText) {
      return 'default';
    }

    const text = conversationText.toLowerCase();
    const recentText = this.getRecentConversation(transcript, 3); // Last 3 exchanges

    // Check for explicit transfer requests first (highest priority)
    if (this.hasTransferRequest(text) || this.hasTransferRequest(recentText)) {
      return 'human_transfer';
    }

    // Check for complaints
    if (this.hasComplaintKeywords(text) || this.hasComplaintKeywords(recentText)) {
      return 'complaint';
    }

    // Check for booking requests
    if (this.hasBookingKeywords(text) || this.hasBookingKeywords(recentText)) {
      return 'booking';
    }

    // Check for information requests
    if (this.hasInformationKeywords(text) || this.hasInformationKeywords(recentText)) {
      return 'information';
    }

    // Check call context for hints
    if (callContext.complaint?.hasComplaint) {
      return 'complaint';
    }

    if (callContext.escalation?.escalated) {
      return 'human_transfer';
    }

    // Default fallback
    return 'default';
  }

  /**
   * Classify user intent from text
   * @param {string} text - Text to classify
   * @returns {string} - Intent classification
   */
  classifyIntent(text) {
    if (!text) return 'unknown';

    const lowerText = text.toLowerCase();

    if (this.hasTransferRequest(lowerText)) return 'transfer';
    if (this.hasComplaintKeywords(lowerText)) return 'complaint';
    if (this.hasBookingKeywords(lowerText)) return 'booking';
    if (this.hasInformationKeywords(lowerText)) return 'information';

    return 'general';
  }

  /**
   * Check if text contains booking-related keywords
   * @param {string} text - Text to check
   * @returns {boolean}
   */
  hasBookingKeywords(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return this.bookingKeywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Check if text contains complaint-related keywords
   * @param {string} text - Text to check
   * @returns {boolean}
   */
  hasComplaintKeywords(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return this.complaintKeywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Check if text contains transfer request keywords
   * @param {string} text - Text to check
   * @returns {boolean}
   */
  hasTransferRequest(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return this.transferKeywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Check if text contains information request keywords
   * @param {string} text - Text to check
   * @returns {boolean}
   */
  hasInformationKeywords(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return this.informationKeywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Get recent conversation from transcript
   * @param {Array} transcript - Transcript array
   * @param {number} numExchanges - Number of recent exchanges to include
   * @returns {string} - Recent conversation text
   */
  getRecentConversation(transcript, numExchanges = 3) {
    if (!Array.isArray(transcript) || transcript.length === 0) {
      return '';
    }

    // Get last N exchanges (user + agent pairs)
    const recent = transcript.slice(-numExchanges * 2);
    return recent.map(entry => entry.text || '').join(' ');
  }
}

export default new FlowDetectionService();

