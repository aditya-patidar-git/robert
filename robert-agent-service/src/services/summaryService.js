import OpenAI from "openai";
// dotenv is already loaded in index.js, no need to reload here

// Lazy initialization: Create OpenAI client only when needed (after dotenv loads)
let openaiClient = null;
function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

/**
 * Summary Service
 * Generates structured call summaries using OpenAI API
 */
class SummaryService {
  /**
   * Generate structured call summary from transcript
   * @param {Array} transcript - Array of {role: 'user'|'agent', text: string} objects
   * @param {Object} callContext - Call context including callSid, from, to, etc.
   * @returns {Promise<Object>} - Structured summary with purpose, outcome, nextSteps, keyFacts
   */
  async generateCallSummary(transcript, callContext = {}) {
    try {
      if (!transcript || transcript.length === 0) {
        return {
          purpose: "No transcript available",
          outcome: "error",
          nextSteps: "",
          keyFacts: []
        };
      }

      // Format transcript for OpenAI
      const transcriptText = transcript
        .map(t => `${t.role === "agent" ? "Agent" : "User"}: ${t.text}`)
        .join("\n");

      const prompt = `You are analyzing a phone call transcript for Universal Motorcycle Training. Generate a structured summary in JSON format.

Transcript:
${transcriptText}

Generate a JSON object with the following structure:
{
  "purpose": "1-2 sentence description of why the caller contacted (e.g., 'Caller wanted to reschedule their CBT booking from Tuesday to Thursday')",
  "outcome": "One of: resolved, escalated, needs-follow-up, voicemail, error",
  "nextSteps": "Brief description of any follow-up actions needed (empty string if none)",
  "keyFacts": ["fact1", "fact2", ...] // Array of important facts (max 5), with PII masked (e.g., use 'customer' instead of names, 'email@domain.com' -> 'e***@domain.com')
}

Important:
- Mask PII: Replace full names with "customer", mask email addresses (keep domain visible), mask phone numbers (keep last 4 digits)
- Be concise: purpose should be 1-2 sentences max
- Outcome should accurately reflect the call result
- Key facts should be the most important information (booking references, dates, issues, etc.)
- Return ONLY valid JSON, no additional text`;

      // Get OpenAI client (lazy initialization)
      const openai = getOpenAIClient();
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Use cheaper model for summaries
        messages: [
          {
            role: "system",
            content: "You are a call analysis assistant. Always return valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3 // Lower temperature for more consistent summaries
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No content in OpenAI response");
      }

      const summary = JSON.parse(content);

      // Validate and sanitize
      return {
        purpose: summary.purpose || "Call purpose not determined",
        outcome: this.validateOutcome(summary.outcome) || "resolved",
        nextSteps: summary.nextSteps || "",
        keyFacts: Array.isArray(summary.keyFacts) ? summary.keyFacts.slice(0, 5) : []
      };
    } catch (error) {
      console.error(`❌ Error generating call summary for ${callContext.callSid}:`, error);
      
      // Fallback to simple summary
      return {
        purpose: `Call transcript with ${transcript.length} exchanges`,
        outcome: "resolved",
        nextSteps: "",
        keyFacts: []
      };
    }
  }

  /**
   * Validate outcome value
   * @param {string} outcome - Outcome value to validate
   * @returns {string} - Valid outcome value
   */
  validateOutcome(outcome) {
    const validOutcomes = ['resolved', 'escalated', 'needs-follow-up', 'voicemail', 'error'];
    if (validOutcomes.includes(outcome)) {
      return outcome;
    }
    return 'resolved'; // Default
  }
}

export default new SummaryService();
