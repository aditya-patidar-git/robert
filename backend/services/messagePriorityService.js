import flowDetectionService from './flowDetectionService.js';

class MessagePriorityService {
  constructor() {
    // Priority constants
    this.PRIORITY_SYSTEM = 10;
    this.PRIORITY_ESCALATION = 9;
    this.PRIORITY_TOOL_CALL = 8;
    this.PRIORITY_IMPORTANT_USER = 7;
    this.PRIORITY_USER_QUESTION = 7;
    this.PRIORITY_RECENT = 6;
    this.PRIORITY_MEDIUM = 5;
    this.PRIORITY_NORMAL = 4;
    this.PRIORITY_OLDER = 3;
    this.PRIORITY_GREETING = 2;
    this.PRIORITY_LOW = 1;
  }

  /**
   * Assign priority score to a message
   * @param {Object} message - Message object
   * @param {Object} context - Context information (index, totalMessages, etc.)
   * @returns {number} - Priority score (0-10)
   */
  assignPriority(message, context = {}) {
    const { index, totalMessages } = context;
    const content = (message.content || '').toLowerCase();
    const role = message.role || 'user';

    // System messages always have highest priority
    if (role === 'system') {
      return this.PRIORITY_SYSTEM;
    }

    // Recent messages (last 5 exchanges = 10 messages) have higher priority
    const isRecent = totalMessages - index <= 10;
    if (isRecent) {
      // Check for high-priority content in recent messages
      if (this.hasEscalationKeywords(content)) {
        return this.PRIORITY_ESCALATION;
      }
      if (this.hasToolCall(message)) {
        return this.PRIORITY_TOOL_CALL;
      }
      if (this.hasImportantKeywords(content)) {
        return this.PRIORITY_IMPORTANT_USER;
      }
      if (this.isQuestion(content)) {
        return this.PRIORITY_USER_QUESTION;
      }
      return this.PRIORITY_RECENT;
    }

    // Older messages - check for importance
    if (this.hasEscalationKeywords(content)) {
      return this.PRIORITY_ESCALATION;
    }
    
    if (this.hasToolCall(message)) {
      return this.PRIORITY_TOOL_CALL;
    }
    
    if (this.hasImportantKeywords(content)) {
      return this.PRIORITY_IMPORTANT_USER;
    }
    
    if (this.isQuestion(content)) {
      return this.PRIORITY_USER_QUESTION;
    }
    
    // Check if it's a greeting (low priority)
    if (this.isGreeting(content)) {
      return this.PRIORITY_GREETING;
    }

    // Medium priority for middle conversation
    if (index > totalMessages * 0.3 && index < totalMessages * 0.7) {
      return this.PRIORITY_MEDIUM;
    }

    // Normal priority
    if (index > totalMessages * 0.7) {
      return this.PRIORITY_NORMAL;
    }

    // Older messages have lower priority
    return this.PRIORITY_OLDER;
  }

  /**
   * Check if message should be preserved (is important)
   * @param {Object} message - Message object
   * @returns {boolean} - True if message is important
   */
  isImportant(message) {
    const priority = this.assignPriority(message);
    return priority >= this.PRIORITY_IMPORTANT_USER;
  }

  /**
   * Check if message contains escalation keywords
   * @param {string} content - Message content
   * @returns {boolean}
   */
  hasEscalationKeywords(content) {
    const escalationKeywords = [
      'human', 'agent', 'representative', 'speak to someone',
      'transfer', 'escalate', 'manager', 'supervisor',
      'complaint', 'unsatisfied', 'angry', 'frustrated'
    ];
    return escalationKeywords.some(keyword => content.includes(keyword));
  }

  /**
   * Check if message has tool call
   * @param {Object} message - Message object
   * @returns {boolean}
   */
  hasToolCall(message) {
    const content = (message.content || '').toLowerCase();
    return !!(message.tool_calls && message.tool_calls.length > 0) ||
           !!(message.tool_call_id) ||
           (content.includes('tool') && (content.includes('result') || content.includes('executed')));
  }

  /**
   * Check if message contains important keywords
   * @param {string} content - Message content
   * @returns {boolean}
   */
  hasImportantKeywords(content) {
    const importantKeywords = [
      'book', 'booking', 'schedule', 'appointment',
      'cancel', 'refund', 'payment', 'price', 'cost',
      'confirm', 'confirmed', 'verification',
      'name', 'email', 'phone', 'address',
      'problem', 'issue', 'error', 'wrong'
    ];
    return importantKeywords.some(keyword => content.includes(keyword));
  }

  /**
   * Check if message is a question
   * @param {string} content - Message content
   * @returns {boolean}
   */
  isQuestion(content) {
    const questionWords = ['what', 'how', 'when', 'where', 'why', 'who', 'which'];
    const questionMarks = content.includes('?');
    const startsWithQuestion = questionWords.some(word => 
      content.trim().toLowerCase().startsWith(word)
    );
    return questionMarks || startsWithQuestion;
  }

  /**
   * Check if message is a greeting
   * @param {string} content - Message content
   * @returns {boolean}
   */
  isGreeting(content) {
    const greetings = [
      'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
      'greetings', 'how are you', 'how do you do'
    ];
    const trimmed = content.trim().toLowerCase();
    return greetings.some(greeting => 
      trimmed.startsWith(greeting) || trimmed === greeting
    );
  }

  /**
   * Get priority level name
   * @param {number} priority - Priority score
   * @returns {string} - Priority level name
   */
  getPriorityLevel(priority) {
    if (priority >= this.PRIORITY_SYSTEM) return 'system';
    if (priority >= this.PRIORITY_ESCALATION) return 'critical';
    if (priority >= this.PRIORITY_TOOL_CALL) return 'high';
    if (priority >= this.PRIORITY_IMPORTANT_USER) return 'important';
    if (priority >= this.PRIORITY_RECENT) return 'recent';
    if (priority >= this.PRIORITY_MEDIUM) return 'medium';
    if (priority >= this.PRIORITY_NORMAL) return 'normal';
    if (priority >= this.PRIORITY_OLDER) return 'older';
    return 'low';
  }
}

export default new MessagePriorityService();

