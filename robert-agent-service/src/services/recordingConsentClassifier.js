/**
 * Optional LLM classification when regex-based consent detection misses (e.g. non-English ASR).
 * Disabled when CONSENT_LLM_CLASSIFY_ENABLED=false or OPENAI_API_KEY missing.
 */
import OpenAI from 'openai';

let client = null;

function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

/**
 * @param {string} transcript
 * @returns {Promise<'accept'|'decline'|'unclear'|null>} null = skipped (disabled/error)
 */
export async function classifyRecordingConsent(transcript) {
  if (process.env.CONSENT_LLM_CLASSIFY_ENABLED === 'false') {
    return null;
  }
  const text = typeof transcript === 'string' ? transcript.trim() : '';
  if (text.length < 2) {
    return null;
  }
  const openai = getClient();
  if (!openai) {
    return null;
  }
  const model = process.env.CONSENT_LLM_MODEL || 'gpt-4o-mini';
  try {
    const res = await openai.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 80,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'The assistant just asked whether the user consents to the phone call being recorded. ' +
            'Classify the user\'s latest utterance. Reply with JSON only: {"decision":"accept"|"decline"|"unclear"}. ' +
            'accept = clear agreement to be recorded (yes, sure, okay, haan, oui, sí, ja, any language). ' +
            'decline = clear refusal. unclear = off-topic, asking a question back, silence-like filler, or ambiguous. ' +
            'Phrases that mean the user has not yet answered (e.g. "I haven\'t given an answer", "what does that mean", "can you repeat", "in English please") must be unclear, never decline.'
        },
        { role: 'user', content: `User said: ${JSON.stringify(text)}` }
      ]
    });
    const raw = res?.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const d = String(parsed.decision || '').toLowerCase();
    if (d === 'accept' || d === 'decline' || d === 'unclear') {
      return d;
    }
    return null;
  } catch (e) {
    console.warn('[recordingConsentClassifier] classify failed:', e?.message || e);
    return null;
  }
}

export default { classifyRecordingConsent };
