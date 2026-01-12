/**
 * Valid OpenAI Realtime API voices
 * These are the only voices supported by OpenAI Realtime API
 * Source: OpenAI Realtime API error message
 */
export const VALID_REALTIME_VOICES = [
  'alloy',
  'ash',
  'ballad',  // Note: singular, not "ballads"
  'coral',
  'echo',
  'sage',
  'shimmer',
  'verse',
  'marin',
  'cedar'
];

/**
 * Check if a voice ID is valid for OpenAI Realtime API
 * @param {string} voiceId - Voice ID to check
 * @returns {boolean} - True if voice is valid
 */
export const isValidRealtimeVoice = (voiceId) => {
  if (!voiceId) return false;
  return VALID_REALTIME_VOICES.includes(voiceId.toLowerCase());
};

/**
 * Filter voices array to only include valid Realtime voices
 * @param {Array} voices - Array of voice objects
 * @returns {Array} - Filtered array of valid voices
 */
export const filterValidRealtimeVoices = (voices) => {
  if (!Array.isArray(voices)) return [];
  return voices.filter(voice => {
    const voiceId = voice?.id || voice?.voiceId || voice;
    return isValidRealtimeVoice(voiceId);
  });
};
