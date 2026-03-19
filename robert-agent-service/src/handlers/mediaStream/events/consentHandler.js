import { MemoryManager } from '../utils/memoryManager.js';
import { getConversationFlowState } from '../utils/conversationStateHelpers.js';
import { classifyRecordingConsent } from '../../../services/recordingConsentClassifier.js';

/**
 * Consent Handler
 * Handles recording consent and memory consent detection from transcriptions.
 * Only runs when we're past language selection (so e.g. "Let's go with English" is not treated as consent).
 */
/** Strip trailing punctuation so e.g. "Certainly." matches consent patterns */
function normalizeForConsent(transcript) {
  if (typeof transcript !== 'string') return '';
  return transcript.trim().replace(/[.!?,;:]+$/, '').toLowerCase();
}

export class ConsentHandler {
  constructor(stateManager, memoryManager) {
    this.state = stateManager;
    this.memoryManager = memoryManager;
  }

  /**
   * Detect consent from transcript
   */
  detectConsent(transcript) {
    const transcriptLower = normalizeForConsent(transcript);
    
    const explicitConsentPatterns = [
      /^(yes|yeah|yep|yup|okay|ok|sure|absolutely|definitely|of course|certainly|i consent|i agree|i do|go ahead|please do)$/i,
      /^(yes|yeah|yep|okay|ok|sure|i consent|i agree|please do)\s/i,
      /\b(yes|yeah|yep|okay|ok|sure|i consent|i agree|go ahead|please do)\b/i
    ];
    
    const explicitDeclinePatterns = [
      /^(no|nope|nah|not|don't|do not|refuse|decline|disagree|i don't|i do not)\s/i,
      /\b(no|nope|refuse|decline|disagree|don't consent|do not consent|i don't want|i do not want)\b/i,
      /\b(not|don't|do not)\s+(consent|agree|want|allow|permit)\b/i
    ];
    
    const ambiguousDeclinePatterns = [
      /\b(not sure|unsure|maybe|perhaps|i don't know|i'm not sure|i think not|probably not)\b/i,
      /\b(no thanks|no thank you|that's ok|that's okay)\b/i
    ];
    
    let consentDetected = false;
    let declineDetected = false;
    
    // First check for explicit decline (highest priority)
    for (const pattern of explicitDeclinePatterns) {
      if (pattern.test(transcriptLower)) {
        declineDetected = true;
        break;
      }
    }
    
    // Check for ambiguous phrases that should default to decline
    if (!declineDetected) {
      for (const pattern of ambiguousDeclinePatterns) {
        if (pattern.test(transcriptLower)) {
          declineDetected = true;
          break;
        }
      }
    }
    
    // Only check for consent if no decline detected
    if (!declineDetected) {
      for (const pattern of explicitConsentPatterns) {
        if (pattern.test(transcriptLower)) {
          // Double-check it's not a negative phrase
          if (!transcriptLower.match(/\b(not|don't|do not|no)\s+(yes|okay|ok|sure|consent|agree)\b/i)) {
            consentDetected = true;
            break;
          }
        }
      }
    }
    
    return { consentDetected, declineDetected };
  }

  /**
   * Handle recording consent detection
   */
  async handleRecordingConsent(transcript) {
    const { conversations } = await import('../../../shared/state.js');
    const conv = conversations[this.state.callSid];
    if (!conv?.recordingConsent) return;
    const flowState = getConversationFlowState(this.state.callSid, this.state);
    if (flowState.waitingForLanguage && !flowState.languageSelected) {
      return;
    }
    if (!this.state.recordingConsentState.requested || this.state.recordingConsentState.given !== null) {
      return;
    }
    const { consentDetected, declineDetected } = this.detectConsent(transcript);
    let accept = consentDetected && !declineDetected;
    let decline = declineDetected;

    if (!accept && !decline && transcript && transcript.trim().length >= 2) {
      const llmOk =
        process.env.CONSENT_LLM_CLASSIFY_ENABLED !== 'false' && !!process.env.OPENAI_API_KEY;
      if (llmOk) {
        conv.recordingConsent._consentLlmTries = conv.recordingConsent._consentLlmTries || 0;
        if (conv.recordingConsent._consentLlmTries < 3) {
          conv.recordingConsent._consentLlmTries += 1;
          const decision = await classifyRecordingConsent(transcript);
          const notYetAnswered = /\b(haven't|have not|didn't|did not|haven’t|didn’t)\s+(given|said|say|respond|answer|consent|decide)/i.test(transcript) ||
            /\b(what does that mean|can you repeat|say that again|in english|in \w+ please)\b/i.test(transcript);
          if (decision === 'accept') {
            accept = true;
            console.log(
              `🤖 [${this.state.callSid}] Recording consent via LLM: accept — "${String(transcript).substring(0, 80)}"`
            );
          } else if (decision === 'decline' && !notYetAnswered) {
            decline = true;
            console.log(
              `🤖 [${this.state.callSid}] Recording consent via LLM: decline — "${String(transcript).substring(0, 80)}"`
            );
          } else if (decision === 'decline' && notYetAnswered) {
            console.log(
              `🔄 [${this.state.callSid}] Recording consent: treating as unclear (not yet answered) — "${String(transcript).substring(0, 80)}"`
            );
          }
        }
      }
    }

    // Do NOT default to opt-in or opt-out on timeout or unclear response.
    // We only set given = true/false when the caller clearly accepts or declines.

    const isUnclearResponse = !accept && !decline;

    if (accept) {
      // Clear timeout immediately
      if (this.state.consentTimeout) {
        clearTimeout(this.state.consentTimeout);
        this.state.consentTimeout = null;
      }
      
      const consentData = {
        requested: conv.recordingConsent?.requested || false,
        given: true,
        requestedAt: conv.recordingConsent?.requestedAt || null,
        respondedAt: new Date(),
        optOutReason: null
      };
      
      this.state.recordingConsentState.given = true;
      this.state.recordingConsentState.respondedAt = consentData.respondedAt;
      conv.recordingConsent.given = true;
      conv.recordingConsent.respondedAt = consentData.respondedAt;
      if (conv.recordingConsent.unclearCount) conv.recordingConsent.unclearCount = 0;
      conv.recordingConsent.needsRepeat = false;
      
      // CRITICAL: Save consent to CallRecord immediately so it's available when recording webhook arrives
      try {
        const CallRecord = (await import('../../../database/models/CallRecord.js')).default;
        await CallRecord.findOneAndUpdate(
          { callSid: this.state.callSid },
          {
            $set: {
              recordingConsent: consentData
            }
          },
          { upsert: true }
        );
        console.log(`✅ [${this.state.callSid}] Recording consent saved to CallRecord (user gave consent)`);
      } catch (dbError) {
        console.error(`⚠️ [${this.state.callSid}] Error saving consent to CallRecord:`, dbError);
        // Continue even if DB save fails - consent is still in memory
      }
      
      console.log(`✅ [${this.state.callSid}] Recording consent GIVEN by user: "${transcript}"`);
      
      // CRITICAL: After consent is given, proceed to main follow-up
      this.state.waitingForLanguage = false;
      if (conv) conv.waitingForLanguage = false;
      console.log(`✅ [${this.state.callSid}] Consent given - proceeding to main follow-up`);
    } else if (decline) {
      // Clear timeout immediately
      if (this.state.consentTimeout) {
        clearTimeout(this.state.consentTimeout);
        this.state.consentTimeout = null;
      }
      
      this.state.recordingConsentState.given = false;
      this.state.recordingConsentState.respondedAt = new Date();
      conv.recordingConsent.given = false;
      conv.recordingConsent.respondedAt = new Date();
      conv.recordingConsent.optOutReason = transcript;
      if (conv.recordingConsent.unclearCount) conv.recordingConsent.unclearCount = 0;
      conv.recordingConsent.needsRepeat = false;
      this.state.waitingForLanguage = false;
      if (conv) conv.waitingForLanguage = false;
      console.log(`❌ [${this.state.callSid}] Recording consent DECLINED by user: "${transcript}"`);
      console.log(`✅ [${this.state.callSid}] Consent declined - proceeding to main follow-up (call continues without recording)`);
    } else if (isUnclearResponse) {
      if (!conv.recordingConsent.unclearCount) conv.recordingConsent.unclearCount = 0;
      conv.recordingConsent.unclearCount++;
      console.log(`⚠️ [${this.state.callSid}] Unclear consent response (attempt ${conv.recordingConsent.unclearCount}), waiting for clarification: "${transcript}"`);
      if (conv.recordingConsent.unclearCount >= 1) {
        conv.recordingConsent.needsRepeat = true;
        console.log(`🔄 [${this.state.callSid}] Marking consent question for repeat due to unclear response`);
      }
    }
  }

  /**
   * Handle memory consent detection
   */
  async handleMemoryConsent(transcript) {
    const { conversations } = await import('../../../shared/state.js');
    const flowState = getConversationFlowState(this.state.callSid, this.state);
    if (flowState.waitingForLanguage && !flowState.languageSelected) {
      return;
    }
    if (!conversations[this.state.callSid]?.memoryConsent?.requested || conversations[this.state.callSid]?.memoryConsent?.given !== null) {
      return;
    }
    const { consentDetected, declineDetected } = this.detectConsent(transcript);
    
    // Check if this is an unclear response
    const isUnclearResponse = !consentDetected && !declineDetected;
    
    if (consentDetected && !declineDetected) {
      conversations[this.state.callSid].memoryConsent.given = true;
      conversations[this.state.callSid].memoryConsent.respondedAt = new Date();
      // Clear any unclear count when consent is given
      if (conversations[this.state.callSid].memoryConsent.unclearCount) {
        conversations[this.state.callSid].memoryConsent.unclearCount = 0;
      }
      conversations[this.state.callSid].memoryConsent.needsRepeat = false;
      console.log(`✅ [${this.state.callSid}] Memory consent GIVEN by user: "${transcript}"`);
      
      // Inject full memory context now that consent is given
      await this.memoryManager.injectMemoryContext();
    } else if (declineDetected) {
      conversations[this.state.callSid].memoryConsent.given = false;
      conversations[this.state.callSid].memoryConsent.respondedAt = new Date();
      // Clear any unclear count when consent is declined
      if (conversations[this.state.callSid].memoryConsent.unclearCount) {
        conversations[this.state.callSid].memoryConsent.unclearCount = 0;
      }
      conversations[this.state.callSid].memoryConsent.needsRepeat = false;
      console.log(`❌ [${this.state.callSid}] Memory consent DECLINED by user: "${transcript}"`);
    } else if (isUnclearResponse) {
      // Track unclear responses
      if (!conversations[this.state.callSid].memoryConsent.unclearCount) {
        conversations[this.state.callSid].memoryConsent.unclearCount = 0;
      }
      conversations[this.state.callSid].memoryConsent.unclearCount++;
      
      console.log(`⚠️ [${this.state.callSid}] Unclear memory consent response (attempt ${conversations[this.state.callSid].memoryConsent.unclearCount}), waiting for clarification: "${transcript}"`);
      
      // Mark that we need to repeat the question
      if (conversations[this.state.callSid].memoryConsent.unclearCount >= 1) {
        conversations[this.state.callSid].memoryConsent.needsRepeat = true;
        console.log(`🔄 [${this.state.callSid}] Marking memory consent question for repeat due to unclear response`);
      }
    }
  }
}

