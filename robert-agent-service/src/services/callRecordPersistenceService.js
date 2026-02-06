import CallRecord from "../database/models/CallRecord.js";
import twilioClient from "../utils/twilioClient.js";

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

    while (retries > 0 && !recordingUrl) {
      try {
        const recordings = await twilioClient.recordings.list({ callSid, limit: 1 });
        if (recordings?.length > 0) {
          recordingUrl = recordings[0].uri.replace(".json", "");
          break;
        }
      } catch (err) {
        if (err.status === 404 || err.code === 20404) {
          retries--;
          if (retries > 0) await new Promise((r) => setTimeout(r, delay));
          delay *= 2;
        } else throw err;
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
