/**
 * Proactive Assistance Service
 * Analyzes conversation patterns and provides proactive suggestions
 */

import { conversations } from "../shared/state.js";
import configManager from "../agent/configManager.js";

class ProactiveAssistanceService {
  constructor() {
    this.analysisCache = new Map(); // callSid -> { lastAnalysis, suggestions }
  }

  /**
   * Analyze conversation for patterns
   * @param {string} callSid - Call SID
   * @returns {Object} - Analysis results
   */
  analyzeConversation(callSid) {
    const conversation = conversations[callSid];
    if (!conversation || !conversation.transcript) {
      return { patterns: [], suggestions: [] };
    }

    const transcript = conversation.transcript;
    const config = configManager.getConversationBehaviorConfig();
    
    if (!config?.proactiveAssistance?.enabled) {
      return { patterns: [], suggestions: [] };
    }

    const patterns = [];
    const suggestions = [];

    // Analyze recent transcript entries (last 10)
    const recentEntries = transcript.slice(-10);
    
    // Detect hesitation patterns
    const hesitationPatterns = this.detectHesitation(recentEntries, config);
    if (hesitationPatterns.length > 0) {
      patterns.push(...hesitationPatterns);
      suggestions.push({
        type: 'hesitation',
        message: "Would you like me to help you with that?",
        confidence: 0.7
      });
    }

    // Detect incomplete requests
    const incompleteRequests = this.detectIncompleteRequests(recentEntries);
    if (incompleteRequests.length > 0) {
      patterns.push(...incompleteRequests);
      suggestions.push({
        type: 'incomplete',
        message: "I can help you with that. What would you like to know?",
        confidence: 0.6
      });
    }

    // Detect confusion indicators
    const confusionIndicators = this.detectConfusion(recentEntries);
    if (confusionIndicators.length > 0) {
      patterns.push(...confusionIndicators);
      suggestions.push({
        type: 'confusion',
        message: "Let me clarify that for you.",
        confidence: 0.8
      });
    }

    // Detect common follow-up opportunities
    if (config.proactiveAssistance.enableFollowUpSuggestions) {
      const followUps = this.detectFollowUpOpportunities(recentEntries);
      if (followUps.length > 0) {
        suggestions.push(...followUps);
      }
    }

    return { patterns, suggestions };
  }

  /**
   * Detect hesitation patterns in transcript
   * @private
   */
  detectHesitation(entries, config) {
    const patterns = [];
    const hesitationWords = ['um', 'uh', 'er', 'well', 'hmm', 'let me think'];
    const threshold = config.proactiveAssistance.hesitationThresholdMs || 3000;

    for (let i = 0; i < entries.length - 1; i++) {
      const entry = entries[i];
      const nextEntry = entries[i + 1];
      
      if (entry.role === 'user' && nextEntry.role === 'user') {
        const timeDiff = new Date(nextEntry.timestamp) - new Date(entry.timestamp);
        
        // Check for long pauses between user messages
        if (timeDiff > threshold) {
          patterns.push({
            type: 'hesitation',
            description: 'Long pause detected',
            timestamp: entry.timestamp
          });
        }
      }

      // Check for hesitation words
      if (entry.role === 'user' && entry.text) {
        const text = entry.text.toLowerCase();
        const hasHesitation = hesitationWords.some(word => text.includes(word));
        if (hasHesitation) {
          patterns.push({
            type: 'hesitation',
            description: 'Hesitation word detected',
            timestamp: entry.timestamp
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Detect incomplete requests
   * @private
   */
  detectIncompleteRequests(entries) {
    const patterns = [];
    const incompleteIndicators = [
      /^i (want|need|would like)/i,
      /^can you/i,
      /^could you/i,
      /^i'm (looking|trying)/i
    ];

    const lastUserEntry = entries.filter(e => e.role === 'user').pop();
    if (lastUserEntry && lastUserEntry.text) {
      const text = lastUserEntry.text.trim();
      
      // Check if ends with question mark but seems incomplete
      if (text.endsWith('?') && text.length < 30) {
        patterns.push({
          type: 'incomplete',
          description: 'Short question detected',
          timestamp: lastUserEntry.timestamp
        });
      }

      // Check for incomplete sentence patterns
      for (const pattern of incompleteIndicators) {
        if (pattern.test(text) && !text.endsWith('.') && !text.endsWith('?') && !text.endsWith('!')) {
          patterns.push({
            type: 'incomplete',
            description: 'Incomplete request pattern detected',
            timestamp: lastUserEntry.timestamp
          });
          break;
        }
      }
    }

    return patterns;
  }

  /**
   * Detect confusion indicators
   * @private
   */
  detectConfusion(entries) {
    const patterns = [];
    const confusionWords = ['confused', 'unclear', 'not sure', 'don\'t understand', 'what do you mean', 'i don\'t get it'];

    for (const entry of entries) {
      if (entry.role === 'user' && entry.text) {
        const text = entry.text.toLowerCase();
        const hasConfusion = confusionWords.some(word => text.includes(word));
        if (hasConfusion) {
          patterns.push({
            type: 'confusion',
            description: 'Confusion indicator detected',
            timestamp: entry.timestamp
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Detect follow-up opportunities
   * @private
   */
  detectFollowUpOpportunities(entries) {
    const suggestions = [];
    
    // Look for booking-related entries
    const hasBooking = entries.some(e => 
      e.text && /book|booking|schedule|appointment/i.test(e.text)
    );

    if (hasBooking) {
      suggestions.push({
        type: 'follow_up',
        message: "I can also help you with rescheduling or cancelling bookings if needed.",
        confidence: 0.5
      });
    }

    // Look for availability checks
    const hasAvailability = entries.some(e =>
      e.text && /available|availability|when|schedule/i.test(e.text)
    );

    if (hasAvailability) {
      suggestions.push({
        type: 'follow_up',
        message: "Would you like me to check availability for other course types?",
        confidence: 0.4
      });
    }

    return suggestions;
  }

  /**
   * Determine if proactive assistance should be offered
   * @param {string} callSid - Call SID
   * @returns {boolean} - True if assistance should be offered
   */
  shouldOfferAssistance(callSid) {
    const config = configManager.getConversationBehaviorConfig();
    if (!config?.proactiveAssistance?.enabled) {
      return false;
    }

    const analysis = this.analyzeConversation(callSid);
    
    // Offer assistance if we have high-confidence suggestions
    const highConfidenceSuggestions = analysis.suggestions.filter(s => s.confidence >= 0.7);
    return highConfidenceSuggestions.length > 0;
  }

  /**
   * Generate proactive suggestion
   * @param {string} callSid - Call SID
   * @param {Object} context - Additional context
   * @returns {string|null} - Suggestion message or null
   */
  generateProactiveSuggestion(callSid, context = {}) {
    const analysis = this.analyzeConversation(callSid);
    
    if (analysis.suggestions.length === 0) {
      return null;
    }

    // Get highest confidence suggestion
    const bestSuggestion = analysis.suggestions.reduce((best, current) => {
      return current.confidence > (best?.confidence || 0) ? current : best;
    }, null);

    return bestSuggestion ? bestSuggestion.message : null;
  }

  /**
   * Track caller intent
   * @param {string} callSid - Call SID
   * @param {string} intent - Intent type (e.g., 'booking', 'inquiry', 'support')
   */
  trackCallerIntent(callSid, intent) {
    if (!conversations[callSid]) {
      conversations[callSid] = {};
    }

    if (!conversations[callSid].intentTracking) {
      conversations[callSid].intentTracking = {
        primaryIntent: null,
        intentHistory: []
      };
    }

    const tracking = conversations[callSid].intentTracking;
    tracking.intentHistory.push({
      intent,
      timestamp: Date.now()
    });

    // Update primary intent (most frequent)
    const intentCounts = {};
    tracking.intentHistory.forEach(entry => {
      intentCounts[entry.intent] = (intentCounts[entry.intent] || 0) + 1;
    });

    tracking.primaryIntent = Object.keys(intentCounts).reduce((a, b) => 
      intentCounts[a] > intentCounts[b] ? a : b
    );

    console.log(`📊 [${callSid}] Intent tracked: ${intent} (primary: ${tracking.primaryIntent})`);
  }

  /**
   * Clear analysis cache for a call
   * @param {string} callSid - Call SID
   */
  clearCache(callSid) {
    this.analysisCache.delete(callSid);
  }
}

export default new ProactiveAssistanceService();

