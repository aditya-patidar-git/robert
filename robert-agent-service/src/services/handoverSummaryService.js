import { conversations } from '../shared/state.js';
import kbaService from './kbaService.js';

class HandoverSummaryService {
  /**
   * Extract caller first name from transcript
   * @param {Array} transcript - Conversation transcript
   * @returns {string} Caller first name or 'Customer'
   */
  extractCallerName(transcript) {
    if (!transcript || transcript.length === 0) {
      return 'Customer';
    }

    // Look for name patterns in user messages
    const namePatterns = [
      /(?:my name is|i'm|i am|this is|call me)\s+([A-Z][a-z]+)/i,
      /(?:name|called)\s+([A-Z][a-z]+)/i
    ];

    for (const entry of transcript) {
      if (entry.role === 'user' && entry.text) {
        for (const pattern of namePatterns) {
          const match = entry.text.match(pattern);
          if (match && match[1]) {
            return match[1];
          }
        }
      }
    }

    return 'Customer';
  }

  /**
   * Summarize conversation for handover
   * @param {string} callSid - Call SID
   * @param {string} escalationReason - Reason for escalation
   * @returns {Promise<string>} Handover summary text
   */
  async generateHandoverSummary(callSid, escalationReason = 'user_request') {
    try {
      const conversation = conversations[callSid];
      if (!conversation || !conversation.transcript) {
        return `Customer calling. Escalation reason: ${escalationReason}. No transcript available.`;
      }

      const transcript = conversation.transcript;
      const callerName = this.extractCallerName(transcript);
      
      // Get KBA status
      const kbaStatus = kbaService.getKBAStatus(callSid);
      const kbaMethod = kbaStatus.verified ? kbaStatus.method : 'not_verified';

      // Extract main issue from last few exchanges
      const recentExchanges = transcript.slice(-5);
      const mainIssue = recentExchanges
        .filter(e => e.role === 'user')
        .map(e => e.text)
        .join(' ');

      // Extract actions taken (tool calls from agent messages)
      const actionsTaken = [];
      for (const entry of transcript) {
        if (entry.role === 'agent' && entry.text) {
          // Look for tool-related messages
          if (entry.text.includes('checked') || entry.text.includes('searched') || entry.text.includes('found')) {
            actionsTaken.push(entry.text.substring(0, 100));
          }
        }
      }

      // Extract desired outcome
      const desiredOutcome = this.extractDesiredOutcome(transcript);

      // Build summary
      let summary = `Hello, this is Robert, the AI phone agent for Universal Motorcycle Training. `;
      summary += `I have ${callerName} on the line regarding ${mainIssue || 'their inquiry'}. `;
      
      if (kbaStatus.verified) {
        summary += `They've verified their identity using ${this.formatKBAMethod(kbaMethod)}. `;
      } else {
        summary += `Identity verification has not been completed. `;
      }

      if (actionsTaken.length > 0) {
        summary += `Actions taken so far: ${actionsTaken.slice(0, 2).join('; ')}. `;
      }

      if (desiredOutcome) {
        summary += `They're hoping for ${desiredOutcome}. `;
      }

      summary += `Escalation reason: ${escalationReason}. Please review the full transcript for complete context.`;

      return summary;
    } catch (error) {
      console.error(`❌ [${callSid}] Error generating handover summary:`, error);
      return `Customer calling. Escalation reason: ${escalationReason}. Error generating summary: ${error.message}`;
    }
  }

  /**
   * Format KBA method for spoken announcement
   * @param {string} method - KBA method
   * @returns {string} Formatted method description
   */
  formatKBAMethod(method) {
    const methodMap = {
      'email_postcode_bookingref': 'email, postcode, and booking reference',
      'email_postcode_bookingref_otp': 'email, postcode, booking reference, and OTP verification'
    };
    return methodMap[method] || method || 'standard verification';
  }

  /**
   * Extract desired outcome from transcript
   * @param {Array} transcript - Conversation transcript
   * @returns {string|null} Desired outcome or null
   */
  extractDesiredOutcome(transcript) {
    if (!transcript || transcript.length === 0) {
      return null;
    }

    // Look for outcome indicators in recent user messages
    const outcomePatterns = [
      /(?:want|need|looking for|hoping for|would like)\s+(.+?)(?:\.|$)/i,
      /(?:to|for)\s+(book|cancel|change|find|get|check)\s+(.+?)(?:\.|$)/i
    ];

    const recentUserMessages = transcript
      .filter(e => e.role === 'user')
      .slice(-3)
      .map(e => e.text);

    for (const message of recentUserMessages) {
      for (const pattern of outcomePatterns) {
        const match = message.match(pattern);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
    }

    return null;
  }

  /**
   * Generate spoken handover announcement for human agent
   * @param {string} callSid - Call SID
   * @param {string} escalationReason - Reason for escalation
   * @returns {Promise<string>} Spoken announcement text
   */
  async generateSpokenAnnouncement(callSid, escalationReason) {
    const summary = await this.generateHandoverSummary(callSid, escalationReason);
    return summary;
  }
}

export default new HandoverSummaryService();

