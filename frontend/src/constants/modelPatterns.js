// Model ID Patterns for Detection
export const MODEL_PATTERNS = {
  REALTIME: ['realtime', 'gpt-realtime'],
  TTS: ['tts', 'tts-1'],
  AUDIO: ['whisper']
};

// Model Capability Checks
export const checkModelSupportsRealtime = (modelId, model) => {
  if (!modelId) return false;
  return model?.capabilities?.realtime || 
         MODEL_PATTERNS.REALTIME.some(pattern => modelId.includes(pattern));
};

export const checkModelSupportsTTS = (modelId) => {
  if (!modelId) return false;
  return MODEL_PATTERNS.TTS.some(pattern => modelId.includes(pattern));
};

export const checkModelSupportsAudio = (modelId, model) => {
  if (!modelId) return false;
  return model?.capabilities?.audio || 
         checkModelSupportsRealtime(modelId, model) || 
         checkModelSupportsTTS(modelId) ||
         MODEL_PATTERNS.AUDIO.some(pattern => modelId.includes(pattern));
};

