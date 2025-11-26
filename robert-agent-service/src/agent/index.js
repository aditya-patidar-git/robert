import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import twilio from 'twilio';
import dotenv from 'dotenv';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import configManager from './configManager.js';
import { handleMediaStreamConnection } from '../handlers/mediaStreamHandler.js';
import { makeCall, aiIntro, getAllCalls } from '../handlers/callHandlers.js';
import { callStatus } from '../handlers/statusHandlers.js';
import { recordingStatus, proxyRecording } from '../handlers/recordingHandlers.js';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (two levels up from src/agent/)
dotenv.config({ path: join(__dirname, '../../.env') });

const {
  TWILIO_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_NUMBER,
  DOMAIN,
  OPENAI_API_KEY,
  MONGO_URI,
  PORT = 3002
} = process.env;

if (!TWILIO_SID || !TWILIO_AUTH_TOKEN || !TWILIO_NUMBER || !DOMAIN || !OPENAI_API_KEY || !MONGO_URI) {
  console.error('Missing required environment variables!');
  process.exit(1);
}

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Middleware
app.use(cors());
app.use(express.json());

// Initialize config manager
await configManager.initialize();

// Health check
app.get('/', (_, res) => res.json({ 
  status: 'ok', 
  service: 'robert-voice-agent',
  configs: {
    ai: configManager.getAIConfig() ? 'loaded' : 'not loaded',
    audio: configManager.getAudioConfig() ? 'loaded' : 'not loaded',
    telephony: configManager.getTelephonyConfig() ? 'loaded' : 'not loaded'
  }
}));

// WebSocket upgrade
server.on('upgrade', (req, socket, head) => {
  if (req.url === '/media-stream' || req.url.startsWith('/media-stream?')) {
    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit('connection', ws);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', twilioWs => {
  console.log('Twilio WebSocket connected');
  handleMediaStreamConnection(twilioWs, {});
});

// API Routes
app.post('/api/outbound/make-call', makeCall);
app.post('/api/outbound/ai-intro', aiIntro);
app.get('/api/outbound/get-all-calls', getAllCalls);
app.post('/api/outbound/call-status', callStatus);
app.post('/api/outbound/recording-status', recordingStatus);
app.get('/api/outbound/recording/:callSid', proxyRecording);

// Manual call trigger (for testing)
app.get('/call', async (req, res) => {
  const to = req.query.to;
  if (!to) return res.status(400).send('Add ?to=+918120523400');

  try {
    const client = twilio(TWILIO_SID, TWILIO_AUTH_TOKEN);
    const baseUrl = DOMAIN ? `https://${DOMAIN}` : `http://localhost:${PORT}`;
    const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    const call = await client.calls.create({
      from: TWILIO_NUMBER,
      to: to,
      twiml: `<Response>
        <Connect>
          <Stream url="${wsProtocol}://${wsHost}/media-stream"/>
        </Connect>
        <Pause length="3600"/>
      </Response>`
    });
    res.send(`Calling ${to}... SID: ${call.sid}`);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

server.listen(PORT, () => {
  console.log(`\n🤖 ROBERT VOICE AGENT SERVICE READY`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Tunnel URL: https://${DOMAIN}`);
  console.log(`📋 Configs: AI=${configManager.getAIConfig() ? '✅' : '❌'}, Audio=${configManager.getAudioConfig() ? '✅' : '❌'}, Telephony=${configManager.getTelephonyConfig() ? '✅' : '❌'}`);
  console.log(`CALL NOW → http://localhost:${PORT}/call?to=+918120523400\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  configManager.destroy();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  configManager.destroy();
  server.close(() => {
    process.exit(0);
  });
});

