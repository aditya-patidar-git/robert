import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import OpenAI from 'openai';
import CallRecord from '../database/models/CallRecord.js';
import configManager from '../agent/configManager.js';

let openaiClient = null;
function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

/**
 * Fetch recording audio buffer from Twilio URL.
 * @param {string} recordingUrl
 * @returns {Promise<Buffer|null>}
 */
async function fetchRecordingBuffer(recordingUrl) {
  let url = recordingUrl.endsWith('.mp3') ? recordingUrl : `${recordingUrl}.mp3`;
  if (url && url.startsWith('/')) {
    url = 'https://api.twilio.com' + url;
  }
  const response = await axios.get(url, {
    auth: {
      username: process.env.TWILIO_SID || '',
      password: process.env.TWILIO_AUTH_TOKEN || ''
    },
    responseType: 'arraybuffer',
    timeout: 60000,
    validateStatus: (s) => s === 200
  });
  if (response.status !== 200) return null;
  return Buffer.from(response.data);
}

/**
 * Transcribe recording and return segments for CallRecord.
 * Does not persist; caller (job/handler) updates CallRecord.
 * @param {string} callSid
 * @returns {Promise<Array<{role, text, timestamp, confidence?}>|null>} transcript segments or null if skipped/failed
 */
export async function transcribeRecording(callSid) {
  const audioConfig = configManager.getAudioConfig();
  const afterCall = audioConfig?.afterCallTranscription;
  if (!afterCall?.enabled) return null;

  const record = await CallRecord.findOne({ callSid }).lean();
  if (!record) return null;
  if (record.recordingConsent?.given === false) return null;
  if (!record.recordingUrl) return null;

  let buffer;
  try {
    buffer = await fetchRecordingBuffer(record.recordingUrl);
  } catch (err) {
    console.warn(`[afterCallTranscription] ${callSid} fetch recording failed:`, err.message);
    return null;
  }
  if (!buffer || buffer.length === 0) return null;

  const model = audioConfig.transcriptionModel || 'whisper-1';
  const tmpDir = os.tmpdir();
  const tmpPath = path.join(tmpDir, `rec-${callSid}-${Date.now()}.mp3`);
  try {
    fs.writeFileSync(tmpPath, buffer);
    const openai = getOpenAIClient();
    if (model === 'whisper-1') {
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tmpPath),
        model: 'whisper-1',
        response_format: 'verbose_json'
      });
      const segments = (transcription.segments || []).map((seg) => ({
        role: 'user',
        text: seg.text?.trim() || '',
        timestamp: new Date(),
        confidence: 0.9
      }));
      if (segments.length === 0 && transcription.text) {
        segments.push({
          role: 'user',
          text: transcription.text.trim(),
          timestamp: new Date(),
          confidence: 0.9
        });
      }
      return segments;
    }
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tmpPath),
      model: 'gpt-4o-transcribe'
    });
    const text = (transcription && transcription.text) ? String(transcription.text).trim() : '';
    if (!text) return [];
    return [{
      role: 'user',
      text,
      timestamp: new Date(),
      confidence: 0.9
    }];
  } catch (err) {
    console.warn(`[afterCallTranscription] ${callSid} OpenAI transcription failed:`, err.message);
    return null;
  } finally {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
  }
}

export default { transcribeRecording };
