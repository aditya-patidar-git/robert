/**
 * After-call transcription job
 * Runs every 10 minutes; transcribes recordings with Whisper/gpt-4o-transcribe when enabled
 */

import CallRecord from '../database/models/CallRecord.js';
import { transcribeRecording } from '../services/afterCallTranscriptionService.js';
import configManager from '../agent/configManager.js';

const BATCH_SIZE = 10;
const MAX_AGE_HOURS = 24;

async function runAfterCallTranscription() {
  const audioConfig = configManager.getAudioConfig();
  if (!audioConfig?.afterCallTranscription?.enabled) return { processed: 0 };

  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - MAX_AGE_HOURS);
  const query = {
    recordingUrl: { $exists: true, $ne: null, $ne: '' },
    'recordingConsent.given': { $ne: false },
    createdAt: { $gte: cutoff },
    $or: [
      { transcriptFromRecording: { $exists: false } },
      { transcriptFromRecording: { $size: 0 } },
      { afterCallTranscriptionPending: true }
    ]
  };
  const records = await CallRecord.find(query).select('callSid').limit(BATCH_SIZE).lean();
  let processed = 0;
  const preferOverRealtime = !!audioConfig.afterCallTranscription.preferOverRealtime;

  for (const rec of records) {
    try {
      const segments = await transcribeRecording(rec.callSid);
      if (segments === null) continue;
      const update = {
        transcriptFromRecording: segments,
        afterCallTranscriptionPending: false
      };
      if (preferOverRealtime && segments.length > 0) {
        update.transcript = segments;
      }
      await CallRecord.findOneAndUpdate(
        { callSid: rec.callSid },
        { $set: update }
      );
      processed++;
    } catch (err) {
      console.warn(`[afterCallTranscriptionJob] ${rec.callSid} failed:`, err.message);
    }
  }

  if (processed > 0) {
    console.log(`[afterCallTranscriptionJob] Processed ${processed} call(s)`);
  }
  return { processed };
}

export default {
  name: 'after-call-transcription',
  schedule: '*/10 * * * *',
  run: runAfterCallTranscription
};
