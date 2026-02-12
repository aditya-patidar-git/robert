/**
 * Single source of truth for "is agent audio playing".
 * Used by barge-in, transcription handling, and response creation.
 * No fixed time windows; uses precise state + dynamic bargeInTailUntil only.
 */

/**
 * @param {Object} snapshot - State snapshot with isResponding, activeResponseId, outboundAudioPacer, outboundAudioBuffer, bargeInTailUntil
 * @param {{ consentPhaseRelaxed?: boolean }} [options] - When true, only isResponding and activeResponseId (consent/language phase)
 * @returns {boolean}
 */
export function isAgentAudioPlaying(snapshot, options = {}) {
  const relaxed = options.consentPhaseRelaxed === true;
  if (relaxed) {
    return !!(snapshot?.isResponding || snapshot?.activeResponseId != null);
  }
  const hasActiveResponse = snapshot?.activeResponseId != null;
  const hasAudioPacer = snapshot?.outboundAudioPacer != null;
  const hasBufferedAudio =
    snapshot?.outboundAudioBuffer != null &&
    (Array.isArray(snapshot.outboundAudioBuffer) ? snapshot.outboundAudioBuffer.length > 0 : snapshot.outboundAudioBuffer.length > 0);
  const isAudioActivelyPlaying =
    !!snapshot?.isResponding || hasActiveResponse || hasAudioPacer || hasBufferedAudio;
  const isInBargeInTail =
    (snapshot?.bargeInTailUntil ?? 0) > 0 && Date.now() < (snapshot?.bargeInTailUntil ?? 0);
  return isAudioActivelyPlaying || isInBargeInTail;
}
