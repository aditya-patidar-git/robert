/**
 * Short phrases where the caller is checking the line / agent presence.
 * Used to relax response gating when post-TTS tail still marks audio as "playing".
 */

/**
 * @param {string} transcript
 * @returns {boolean}
 */
export function isCallerPresenceCheckPhrase(transcript) {
  const t = (transcript || '').trim().toLowerCase();
  if (t.length < 3 || t.length > 80) return false;

  const patterns = [
    /^are you (still )?there\??$/,
    /^hey[,.\s]*(are you )?(still )?there\??$/,
    /^hi[,.\s]*(are you )?(still )?there\??$/,
    /^hello\??$/,
    /^can you hear me\??$/,
    /^do you hear me\??$/,
    /^(you there|still there)\??$/,
    /^is (anybody|anyone) there\??$/,
    /^where did you go\??$/,
    /^(yo|hey)\s*[,.]?\s*can you hear( me)?\??$/,
    /^are we (still )?connected\??$/
  ];

  return patterns.some((p) => p.test(t));
}
