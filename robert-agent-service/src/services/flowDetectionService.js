/**
 * Flow Detection Service
 * Detects conversation flow type for applying flow-specific configurations
 */

class FlowDetectionService {
  constructor() {
    // Booking-related keywords
    this.bookingKeywords = [
      'book', 'booking', 'schedule', 'appointment', 'lesson', 'course',
      'reserve', 'reservation', 'enroll', 'enrollment', 'sign up', 'signup'
    ];
    
    // Complaint-related keywords
    this.complaintKeywords = [
      'complaint', 'issue', 'problem', 'unhappy', 'dissatisfied', 'refund',
      'cancel', 'cancellation', 'disappointed', 'poor', 'bad', 'wrong',
      'error', 'mistake', 'fault', 'broken'
    ];
    
    // Information-related keywords
    this.informationKeywords = [
      'information', 'info', 'tell me', 'what', 'how', 'when', 'where',
      'price', 'cost', 'fee', 'fees', 'duration', 'time', 'location',
      'address', 'contact', 'phone', 'email', 'website', 'hours'
    ];
    
    // Transfer-related keywords
    this.transferKeywords = [
      'human', 'agent', 'representative', 'person', 'speak to someone',
      'transfer', 'operator', 'supervisor', 'manager', 'help'
    ];
  }

  /**
   * Detect flow type from conversation text
   * @param {string} text - Conversation text to analyze
   * @param {Array} transcript - Conversation transcript (optional)
   * @param {Object} callContext - Call context (optional)
   * @returns {string} - Detected flow type: 'booking', 'complaint', 'information', 'human_transfer', or 'default'
   */
  detectFlow(text, transcript = [], callContext = {}) {
    if (!text || typeof text !== 'string') {
      return 'default';
    }

    const normalizedText = text.toLowerCase();
    
    // Get recent conversation for context
    const recentText = this.getRecentConversation(transcript, 3);
    const combinedText = `${normalizedText} ${recentText.toLowerCase()}`;
    
    // Check for explicit transfer requests (highest priority)
    if (this.hasKeywords(combinedText, this.transferKeywords)) {
      return 'human_transfer';
    }
    
    // Check for complaints
    if (this.hasKeywords(combinedText, this.complaintKeywords)) {
      return 'complaint';
    }
    
    // Check for booking requests
    if (this.hasKeywords(combinedText, this.bookingKeywords)) {
      return 'booking';
    }
    
    // Check for information requests
    if (this.hasKeywords(combinedText, this.informationKeywords)) {
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
   * Check if text contains any of the keywords
   * @param {string} text - Text to search
   * @param {Array<string>} keywords - Keywords to search for
   * @returns {boolean} - True if any keyword found
   */
  hasKeywords(text, keywords) {
    return keywords.some(keyword => text.includes(keyword));
  }

  /**
   * Get recent conversation text from transcript
   * @param {Array} transcript - Transcript array
   * @param {number} count - Number of recent entries to include
   * @returns {string} - Combined recent text
   */
  getRecentConversation(transcript, count = 3) {
    if (!Array.isArray(transcript) || transcript.length === 0) {
      return '';
    }
    
    const recent = transcript.slice(-count);
    return recent
      .map(entry => entry.text || entry.content || '')
      .join(' ');
  }
}

export default new FlowDetectionService();

