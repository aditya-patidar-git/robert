/**
 * Single source of truth for "is agent audio playing".
 * Used by barge-in, transcription handling, and response creation.
 * Uses precise state + dynamic bargeInTailUntil; optional Twilio playout window for barge-in only.
 */

import configManager from '../../../agent/configManager.js';

function getTwilioPlayoutAfterLastFrameMs() {
  const v = configManager.getConversationBehaviorConfig()?.bargeInTail?.twilioPlayoutAfterLastFrameMs;
  if (typeof v === 'number' && v >= 0 && v <= 60000) {
    return v;
  }
  return 4500;
}

/**
 * @param {Object} snapshot - State snapshot with isResponding, activeResponseId, outboundAudioPacer, outboundAudioBuffer, bargeInTailUntil, lastOutboundSendTime
 * @param {{ consentPhaseRelaxed?: boolean, forBargeIn?: boolean }} [options] - relaxed: consent/language; forBargeIn: count recent Twilio frames as still playing (caller may still hear audio after OpenAI response.done)
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
  // After response.done we clear isResponding/activeResponseId and drain the buffer, but the callee may still hear audio already sent to Twilio. Only the barge-in path uses this (not transcription gating).
  const lastSend = snapshot?.lastOutboundSendTime ?? 0;
  const isInTwilioPlayoutTail =
    options.forBargeIn === true &&
    lastSend > 0 &&
    Date.now() - lastSend < getTwilioPlayoutAfterLastFrameMs();
  return isAudioActivelyPlaying || isInBargeInTail || isInTwilioPlayoutTail;
}
