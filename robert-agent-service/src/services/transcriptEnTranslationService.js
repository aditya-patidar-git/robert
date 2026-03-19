/**
 * Optional English translation for CallRecord transcripts (admin portal).
 * Disabled when TRANSCRIPT_EN_ENABLED=false. Otherwise requires OPENAI_API_KEY.
 */
import OpenAI from 'openai';

let client = null;

function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

/**
 * @param {string} text
 * @param {'user'|'agent'} role
 * @returns {Promise<string|null>} English text, or null to skip storing transcriptEn
 */
export async function translateTranscriptToEnglish(text, role = 'user') {
  if (process.env.TRANSCRIPT_EN_ENABLED === 'false') {
    return null;
  }
  const s = typeof text === 'string' ? text.trim() : '';
  if (s.length < 2) {
    return s || null;
  }
  const openai = getClient();
  if (!openai) {
    return null;
  }
  const model = process.env.TRANSCRIPT_EN_MODEL || 'gpt-4o-mini';
  const label = role === 'agent' ? 'assistant' : 'caller';
  try {
    const res = await openai.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 800,
      messages: [
        {
          role: 'system',
          content:
            `Translate the following phone-call ${label} utterance into clear English for an admin dashboard. ` +
            'If it is already plain English, return it unchanged (fix only obvious typos). ' +
            'Preserve names, numbers, dates, and booking references. Output only the English text, no quotes or preamble.'
        },
        { role: 'user', content: s }
      ]
    });
    const out = res?.choices?.[0]?.message?.content?.trim();
    return out && out.length > 0 ? out : s;
  } catch (e) {
    console.warn('[transcriptEn] translation failed:', e?.message || e);
    return null;
  }
}
