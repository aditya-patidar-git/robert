import CallRecord from "../database/models/CallRecord.js";
import twilioClient from "../utils/twilioClient.js";
import { conversations } from "../shared/state.js";
import { isRetryableError } from "../utils/isRetryableError.js";

/**
 * Build caller identity update object with only truthy from/to.
 * Prevents overwriting existing values with undefined.
 */
export function buildCallerIdentityUpdate(from, to) {
  const out = {};
  if (from != null && from !== "") out.from = from;
  if (to != null && to !== "") out.to = to;
  return out;
}

/**
 * Fetch from/to from Twilio call resource. Returns null on error.
 */
export async function fetchCallerIdentityFromTwilio(callSid) {
  try {
    const call = await twilioClient.calls(callSid).fetch();
    return call ? { from: call.from, to: call.to } : null;
  } catch (err) {
    console.warn(`⚠️ [${callSid}] Could not fetch caller identity from Twilio:`, err?.message);
    return null;
  }
}

/**
 * Ensure CallRecord has from/to: update from args when present, then fetch from Twilio if still missing.
 */
export async function ensureCallRecordCallerIdentity(callSid, { from, to }) {
  const identity = buildCallerIdentityUpdate(from, to);
  if (Object.keys(identity).length > 0) {
    await CallRecord.findOneAndUpdate(
      { callSid },
      { $set: identity },
      { upsert: true }
    );
  }
  const existing = await CallRecord.findOne({ callSid }).select("from to").lean();
  const needsFrom = existing?.from == null || existing?.from === "";
  const needsTo = existing?.to == null || existing?.to === "";
  if (!needsFrom && !needsTo) return;
  const twilioIdentity = await fetchCallerIdentityFromTwilio(callSid);
  if (!twilioIdentity) return;
  const backfill = buildCallerIdentityUpdate(twilioIdentity.from, twilioIdentity.to);
  if (Object.keys(backfill).length > 0) {
    await CallRecord.findOneAndUpdate(
      { callSid },
      { $set: backfill },
      { upsert: true }
    );
    console.log(`✅ [${callSid}] Caller identity backfilled from Twilio`);
  }
}

/**
 * If CallRecord has consent and duration but no recordingUrl, fetch from Twilio and save.
 * Fire-and-forget safe; reads consent/duration from DB.
 */
export async function backfillRecordingUrlIfMissing(callSid) {
  try {
    const rec = await CallRecord.findOne({ callSid }).select("recordingUrl recordingConsent duration").lean();
    if (!rec) return;
    if (rec.recordingUrl) return;
    if (rec.recordingConsent?.given === false) return;
    const duration = rec.duration;
    if (duration != null && duration <= 0) return;

    await new Promise((r) => setTimeout(r, 5000));
    let recordingUrl = null;
    let retries = 3;
    let delay = 3000;
    const maxDelay = 15000;

    while (retries > 0 && !recordingUrl) {
      try {
        const recordings = await twilioClient.recordings.list({ callSid, limit: 1 });
        if (recordings?.length > 0) {
          recordingUrl = recordings[0].uri.replace(".json", "");
          if (recordingUrl && recordingUrl.startsWith("/")) {
            recordingUrl = "https://api.twilio.com" + recordingUrl;
          }
          break;
        }
      } catch (err) {
        const isRetryable = err.status === 404 || err.code === 20404 || isRetryableError(err);
        if (isRetryable) {
          retries--;
          if (retries > 0) {
            await new Promise((r) => setTimeout(r, delay));
            delay = Math.min(delay * 2, maxDelay);
          }
        } else {
          throw err;
        }
      }
    }

    if (recordingUrl) {
      await CallRecord.findOneAndUpdate(
        { callSid },
        { $set: { recordingUrl } },
        { upsert: true }
      );
      console.log(`✅ [${callSid}] Recording URL backfilled from Twilio`);
    }
  } catch (err) {
    console.error(`❌ [${callSid}] Error backfilling recording URL:`, err?.message);
  }
}

/**
 * Save recording consent to CallRecord. Shared by callHandlers and sipHandlers.
 */
export async function saveConsentToCallRecord(callSid, consentData) {
  try {
    await CallRecord.findOneAndUpdate(
      { callSid },
      { $set: { recordingConsent: consentData } },
      { upsert: true }
    );
    console.log(`✅ [${callSid}] Recording consent saved to CallRecord`);
  } catch (dbError) {
    console.error(`⚠️ [${callSid}] Error saving consent to CallRecord:`, dbError);
  }
}

/**
 * Set default recording consent for a call from PrivacyConfig; persist to CallRecord.
 * Caller must ensure conversations[callSid] exists. Shared by callHandlers and sipHandlers.
 */
export async function setDefaultRecordingConsent(callSid, callType = 'Twilio') {
  if (!conversations[callSid]) return;
  try {
    const PrivacyConfig = (await import('../database/models/PrivacyConfig.js')).default;
    const privacySettings = await PrivacyConfig.findOne({ isActive: true }).lean().catch(() => null);
    const requireExplicitConsent = privacySettings?.recording?.requireExplicitConsent !== false;
    if (!requireExplicitConsent) {
      if (!conversations[callSid].recordingConsent) {
        conversations[callSid].recordingConsent = {
          requested: false,
          given: null,
          requestedAt: null,
          respondedAt: null
        };
      }
      const consentData = {
        requested: false,
        given: true,
        respondedAt: new Date(),
        optOutReason: null
      };
      conversations[callSid].recordingConsent.requested = consentData.requested;
      conversations[callSid].recordingConsent.given = consentData.given;
      conversations[callSid].recordingConsent.respondedAt = consentData.respondedAt;
      conversations[callSid].recordingConsent.optOutReason = consentData.optOutReason;
      await saveConsentToCallRecord(callSid, consentData);
      console.log(`✅ [${callSid}] Recording consent set to opt-in by default for inbound ${callType} call (given: true)`);
    } else {
      console.log(`📋 [${callSid}] Recording consent will be requested explicitly for inbound ${callType} call`);
    }
  } catch (err) {
    console.error(`⚠️ [${callSid}] Error setting consent for inbound ${callType} call:`, err);
  }
}
