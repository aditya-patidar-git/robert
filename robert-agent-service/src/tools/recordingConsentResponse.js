import { conversations } from '../shared/state.js';
import { updateRecordingConsent } from '../shared/conversationStateAccessor.js';

/**
 * Model-driven recording consent: the conversation model calls this when it has
 * heard a clear yes or no from the caller (in any language). Primary source of
 * consent state; transcript-based detection remains as fallback.
 */
class RecordingConsentResponseTool {
  async execute(parameters, callContext = {}) {
    const { given } = parameters || {};
    const { callSid, stateManager } = callContext;

    if (!callSid || !stateManager) {
      return { success: false, error: 'Missing call context for recording_consent_response' };
    }

    const conv = conversations[callSid];
    if (!conv?.recordingConsent) {
      return { success: false, error: 'Recording consent not requested for this call' };
    }
    if (conv.recordingConsent.given !== null) {
      return {
        success: true,
        alreadySet: true,
        message: 'Recording consent was already recorded; no change.'
      };
    }

    const givenBool = given === true;
    const respondedAt = new Date();

    stateManager.recordingConsentState.given = givenBool;
    stateManager.recordingConsentState.respondedAt = respondedAt;
    conv.recordingConsent.given = givenBool;
    conv.recordingConsent.respondedAt = respondedAt;
    conv.recordingConsent.optOutReason = givenBool ? null : (conv.recordingConsent.optOutReason || 'Declined via model');
    if (conv.recordingConsent.unclearCount) conv.recordingConsent.unclearCount = 0;
    conv.recordingConsent.needsRepeat = false;
    stateManager.waitingForLanguage = false;
    conv.waitingForLanguage = false;

    updateRecordingConsent(callSid, {
      given: givenBool,
      respondedAt,
      optOutReason: givenBool ? null : conv.recordingConsent.optOutReason
    });

    if (givenBool) {
      try {
        const CallRecord = (await import('../database/models/CallRecord.js')).default;
        await CallRecord.findOneAndUpdate(
          { callSid },
          {
            $set: {
              recordingConsent: {
                requested: conv.recordingConsent?.requested ?? true,
                given: true,
                respondedAt,
                optOutReason: null
              }
            }
          },
          { upsert: true }
        );
        console.log(`✅ [${callSid}] Recording consent saved to CallRecord (model: consent given)`);
      } catch (dbError) {
        console.error(`⚠️ [${callSid}] Error saving consent to CallRecord:`, dbError);
      }
      console.log(`✅ [${callSid}] Recording consent GIVEN (via model tool)`);
    } else {
      console.log(`❌ [${callSid}] Recording consent DECLINED (via model tool)`);
    }
    console.log(`✅ [${callSid}] Consent recorded - proceeding to main follow-up`);

    return {
      success: true,
      given: givenBool,
      message: givenBool
        ? 'Recording consent recorded. You may now say the main follow-up question.'
        : 'Recording declined. Acknowledge briefly and say the main follow-up question.'
    };
  }
}

export default new RecordingConsentResponseTool();
