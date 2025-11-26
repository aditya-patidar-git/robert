import configManager from '../../agent/configManager.js';
import { connectDB } from '../../database/connection.js';

// Cache with TTL
const configCache = {
  ai: { data: null, timestamp: 0, ttl: 30000 }, // 30 seconds
  audio: { data: null, timestamp: 0, ttl: 30000 },
  telephony: { data: null, timestamp: 0, ttl: 30000 }
};

export async function getConfigResource(uri) {
  await ensureDBConnection();

  const now = Date.now();
  let configType;

  if (uri === 'config://ai') {
    configType = 'ai';
    if (configCache.ai.data && (now - configCache.ai.timestamp) < configCache.ai.ttl) {
      return configCache.ai.data;
    }
    const config = configManager.getAIConfig();
    configCache.ai = { data: config, timestamp: now };
    return config;
  } else if (uri === 'config://audio') {
    configType = 'audio';
    if (configCache.audio.data && (now - configCache.audio.timestamp) < configCache.audio.ttl) {
      return configCache.audio.data;
    }
    const config = configManager.getAudioConfig();
    configCache.audio = { data: config, timestamp: now };
    return config;
  } else if (uri === 'config://telephony') {
    configType = 'telephony';
    if (configCache.telephony.data && (now - configCache.telephony.timestamp) < configCache.telephony.ttl) {
      return configCache.telephony.data;
    }
    const config = configManager.getTelephonyConfig();
    configCache.telephony = { data: config, timestamp: now };
    return config;
  }

  throw new Error(`Unknown config URI: ${uri}`);
}

async function ensureDBConnection() {
  const mongoose = await import('mongoose');
  if (mongoose.default.connection.readyState !== 1) {
    await connectDB();
  }
}

