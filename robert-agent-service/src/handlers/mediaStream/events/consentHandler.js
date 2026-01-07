import { MemoryManager } from '../utils/memoryManager.js';

/**
 * Consent Handler
 * Handles recording consent and memory consent detection from transcriptions
 */
export class ConsentHandler {
  constructor(stateManager, memoryManager) {
    this.state = stateManager;
    this.memoryManager = memoryManager;
  }

  /**
   * Detect consent from transcript
   */
  detectConsent(transcript) {
    const transcriptLower = transcript.toLowerCase().trim();
    
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
    
    if (!this.state.recordingConsentState.requested || this.state.recordingConsentState.given !== null) {
      return; // Consent not requested or already responded
    }
    
    const { consentDetected, declineDetected } = this.detectConsent(transcript);
    
    // Reset timeout when user speaks (if not obvious consent/decline)
    const quickConsentCheck = /^(yes|yeah|yep|yup|okay|ok|sure|absolutely|definitely|of course|certainly|i consent|i agree|i do|go ahead)$/i.test(transcript.toLowerCase().trim());
    const quickDeclineCheck = /^(no|nope|nah|not|don't|do not|refuse|decline|disagree|i don't|i do not)\s/i.test(transcript.toLowerCase().trim());
    
    if (this.state.consentTimeout && transcript && transcript.trim().length > 0 && !quickConsentCheck && !quickDeclineCheck) {
      clearTimeout(this.state.consentTimeout);
      this.state.consentTimeout = null;
      // Restart timeout
      this.state.consentTimeout = setTimeout(() => {
        if (this.state.recordingConsentState.given === null && conversations[this.state.callSid].recordingConsent.given === null) {
          this.state.recordingConsentState.given = false;
          this.state.recordingConsentState.respondedAt = new Date();
          conversations[this.state.callSid].recordingConsent.given = false;
          conversations[this.state.callSid].recordingConsent.respondedAt = new Date();
          conversations[this.state.callSid].recordingConsent.optOutReason = "No response within timeout - defaulting to opt-out for GDPR compliance";
          console.log(`⏰ [${this.state.callSid}] Recording consent timeout expired - defaulting to opt-out (GDPR compliance)`);
        }
      }, this.state.CONSENT_TIMEOUT_MS);
      console.log(`⏱️ [${this.state.callSid}] Consent timeout reset - user is speaking, extending response window`);
    }
    
    // Check if this is an unclear response (no clear yes/no detected)
    const isUnclearResponse = !consentDetected && !declineDetected;
    
    if (consentDetected && !declineDetected) {
      // Clear timeout immediately
      if (this.state.consentTimeout) {
        clearTimeout(this.state.consentTimeout);
        this.state.consentTimeout = null;
      }
      
      this.state.recordingConsentState.given = true;
      this.state.recordingConsentState.respondedAt = new Date();
      conversations[this.state.callSid].recordingConsent.given = true;
      conversations[this.state.callSid].recordingConsent.respondedAt = new Date();
      // Clear any unclear count when consent is given
      if (conversations[this.state.callSid].recordingConsent.unclearCount) {
        conversations[this.state.callSid].recordingConsent.unclearCount = 0;
      }
      conversations[this.state.callSid].recordingConsent.needsRepeat = false;
      console.log(`✅ [${this.state.callSid}] Recording consent GIVEN by user: "${transcript}"`);
    } else if (declineDetected) {
      // Clear timeout immediately
      if (this.state.consentTimeout) {
        clearTimeout(this.state.consentTimeout);
        this.state.consentTimeout = null;
      }
      
      this.state.recordingConsentState.given = false;
      this.state.recordingConsentState.respondedAt = new Date();
      conversations[this.state.callSid].recordingConsent.given = false;
      conversations[this.state.callSid].recordingConsent.respondedAt = new Date();
      conversations[this.state.callSid].recordingConsent.optOutReason = transcript;
      // Clear any unclear count when consent is declined
      if (conversations[this.state.callSid].recordingConsent.unclearCount) {
        conversations[this.state.callSid].recordingConsent.unclearCount = 0;
      }
      conversations[this.state.callSid].recordingConsent.needsRepeat = false;
      console.log(`❌ [${this.state.callSid}] Recording consent DECLINED by user: "${transcript}"`);
    } else if (isUnclearResponse) {
      // Track unclear responses
      if (!conversations[this.state.callSid].recordingConsent.unclearCount) {
        conversations[this.state.callSid].recordingConsent.unclearCount = 0;
      }
      conversations[this.state.callSid].recordingConsent.unclearCount++;
      
      console.log(`⚠️ [${this.state.callSid}] Unclear consent response (attempt ${conversations[this.state.callSid].recordingConsent.unclearCount}), waiting for clarification: "${transcript}"`);
      
      // If unclear response detected, mark that we need to repeat the question
      // This will be handled by the OpenAI integration checking the state
      if (conversations[this.state.callSid].recordingConsent.unclearCount >= 1) {
        // Mark that we need to repeat the question
        conversations[this.state.callSid].recordingConsent.needsRepeat = true;
        console.log(`🔄 [${this.state.callSid}] Marking consent question for repeat due to unclear response`);
      }
    }
  }

  /**
   * Handle memory consent detection
   */
  async handleMemoryConsent(transcript) {
    const { conversations } = await import('../../../shared/state.js');
    
    if (!conversations[this.state.callSid]?.memoryConsent?.requested || conversations[this.state.callSid]?.memoryConsent?.given !== null) {
      return; // Consent not requested or already responded
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

