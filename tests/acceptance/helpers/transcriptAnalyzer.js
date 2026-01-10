/**
 * Transcript Analyzer
 * Transcript parsing and citation detection utilities
 * Single responsibility: transcript analysis only
 */

class TranscriptAnalyzer {
  /**
   * Extract citations from transcript
   */
  extractCitations(transcript) {
    const citationPatterns = [
      /according to ([^,\.]+)/i,
      /as set out in ([^,\.]+)/i,
      /per ([^,\.]+)/i,
      /from ([^,\.]+)/i,
      /in ([^,\.]+) (?:it|we|they) (?:states?|says?|mentions?)/i
    ];

    const citations = [];
    
    for (const pattern of citationPatterns) {
      const matches = transcript.matchAll(new RegExp(pattern.source, 'gi'));
      for (const match of matches) {
        citations.push({
          text: match[1]?.trim(),
          fullMatch: match[0],
          pattern: pattern.source
        });
      }
    }

    return citations;
  }

  /**
   * Check if transcript contains citation
   */
  hasCitation(transcript, expectedCitation) {
    const citations = this.extractCitations(transcript);
    const lowerExpected = expectedCitation.toLowerCase();
    
    return citations.some(citation => 
      citation.text.toLowerCase().includes(lowerExpected)
    );
  }

  /**
   * Extract tool calls from transcript metadata
   */
  extractToolCalls(transcriptMetadata) {
    if (!transcriptMetadata || !transcriptMetadata.toolCalls) {
      return [];
    }

    return transcriptMetadata.toolCalls;
  }

  /**
   * Find tool call by name
   */
  findToolCall(transcriptMetadata, toolName) {
    const toolCalls = this.extractToolCalls(transcriptMetadata);
    return toolCalls.find(call => 
      call.name === toolName || call.tool === toolName
    );
  }

  /**
   * Extract agent announcements (e.g., "I'll check online...")
   */
  extractAnnouncements(transcript) {
    const announcementPatterns = [
      /i'?ll check online/i,
      /i'm checking online/i,
      /let me check/i,
      /one moment/i,
      /just a moment/i
    ];

    const announcements = [];
    
    for (const pattern of announcementPatterns) {
      if (pattern.test(transcript)) {
        const match = transcript.match(pattern);
        announcements.push({
          text: match[0],
          pattern: pattern.source
        });
      }
    }

    return announcements;
  }

  /**
   * Check if transcript contains announcement
   */
  hasAnnouncement(transcript, expectedAnnouncement) {
    const announcements = this.extractAnnouncements(transcript);
    const lowerExpected = expectedAnnouncement.toLowerCase();
    
    return announcements.some(announcement =>
      announcement.text.toLowerCase().includes(lowerExpected)
    );
  }

  /**
   * Extract language from transcript
   */
  detectLanguage(transcript) {
    // Simple language detection based on common phrases
    const languageIndicators = {
      fr: ['français', 'francais', 'oui', 'merci', 'bonjour'],
      en: ['english', 'yes', 'thank you', 'hello'],
      de: ['deutsch', 'ja', 'danke', 'hallo'],
      es: ['español', 'sí', 'gracias', 'hola'],
      it: ['italiano', 'sì', 'grazie', 'ciao']
    };

    const lowerTranscript = transcript.toLowerCase();
    
    for (const [lang, indicators] of Object.entries(languageIndicators)) {
      if (indicators.some(indicator => lowerTranscript.includes(indicator))) {
        return lang;
      }
    }

    return 'en'; // Default to English
  }

  /**
   * Extract user preferences from transcript
   */
  extractPreferences(transcript) {
    const preferences = [];
    
    // Pattern: "I prefer X" or "I always X"
    const preferencePatterns = [
      /i prefer ([^\.]+)/i,
      /i always ([^\.]+)/i,
      /i like ([^\.]+)/i
    ];

    for (const pattern of preferencePatterns) {
      const matches = transcript.matchAll(new RegExp(pattern.source, 'gi'));
      for (const match of matches) {
        preferences.push(match[1]?.trim());
      }
    }

    return preferences;
  }
}

export const transcriptAnalyzer = new TranscriptAnalyzer();
export default transcriptAnalyzer;

