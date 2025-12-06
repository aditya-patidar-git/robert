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
import { makeCall, aiIntro, getAllCalls, handleIncomingCall } from '../handlers/callHandlers.js';
import { callStatus } from '../handlers/statusHandlers.js';
import { recordingStatus, proxyRecording } from '../handlers/recordingHandlers.js';
import sipRoutes from '../routes/sipRoutes.js';
import secretsManager from '../services/secretsManager.js';
import browserAgentService from '../services/browserAgentService.js';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (two levels up from src/agent/)
dotenv.config({ path: join(__dirname, '../../.env') });

// Initialize secrets manager and validate required secrets
(async () => {
  try {
    await secretsManager.initialize();
    console.log('✅ Secrets Manager initialized successfully');
  } catch (error) {
    console.error('❌ Secrets Manager initialization failed:', error.message);
    console.error('❌ Application cannot start without required secrets');
    process.exit(1);
  }
})();

const {
  TWILIO_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_NUMBER,
  TUNNEL_DOMAIN,
  OPENAI_API_KEY,
  MONGO_URI,
  PORT = 3002
} = process.env;

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Add error handler to WebSocket server
wss.on('error', (error) => {
  console.error('❌ [DEBUG] WebSocket server error:', error);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Required for Twilio form-encoded callbacks

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
  },
  websocket: {
    url: TUNNEL_DOMAIN ? `wss://${TUNNEL_DOMAIN}/media-stream` : `ws://localhost:${PORT}/media-stream`,
    status: 'ready'
  }
}));

// WebSocket test endpoint
app.get('/test-websocket', (_, res) => {
  res.send(`
    <html>
      <head><title>WebSocket Test</title></head>
      <body>
        <h1>WebSocket Connection Test</h1>
        <div id="status">Connecting...</div>
        <div id="messages"></div>
        <script>
          const ws = new WebSocket('${TUNNEL_DOMAIN ? `wss://${TUNNEL_DOMAIN}` : `ws://localhost:${PORT}`}/media-stream');
          const status = document.getElementById('status');
          const messages = document.getElementById('messages');
          
          ws.onopen = () => {
            status.textContent = '✅ WebSocket Connected!';
            status.style.color = 'green';
            messages.innerHTML += '<p>WebSocket opened successfully</p>';
          };
          
          ws.onerror = (error) => {
            status.textContent = '❌ WebSocket Error';
            status.style.color = 'red';
            messages.innerHTML += '<p>Error: ' + error + '</p>';
          };
          
          ws.onclose = () => {
            status.textContent = 'WebSocket Closed';
            messages.innerHTML += '<p>Connection closed</p>';
          };
          
          ws.onmessage = (event) => {
            messages.innerHTML += '<p>Message: ' + event.data + '</p>';
          };
        </script>
      </body>
    </html>
  `);
});

// WebSocket upgrade
server.on('upgrade', (req, socket, head) => {
  console.log('🔌 [DEBUG] WebSocket upgrade request received');
  console.log('🔌 [DEBUG] Request URL:', req.url);
  console.log('🔌 [DEBUG] Request method:', req.method);
  console.log('🔌 [DEBUG] Request headers:', {
    'upgrade': req.headers.upgrade,
    'connection': req.headers.connection,
    'sec-websocket-key': req.headers['sec-websocket-key'] ? 'present' : 'missing',
    'host': req.headers.host
  });
  
  if (req.url === '/media-stream' || req.url.startsWith('/media-stream?')) {
    console.log('✅ [DEBUG] URL matches /media-stream, handling upgrade...');
    try {
      wss.handleUpgrade(req, socket, head, ws => {
        console.log('✅ [DEBUG] WebSocket upgrade completed, emitting connection event');
        console.log('✅ [DEBUG] WebSocket readyState:', ws.readyState, '(OPEN=1)');
        wss.emit('connection', ws);
      });
    } catch (error) {
      console.error('❌ [DEBUG] Error during WebSocket upgrade:', error);
      console.error('❌ [DEBUG] Error stack:', error.stack);
      socket.destroy();
    }
  } else {
    console.log('❌ [DEBUG] URL does not match /media-stream');
    console.log('❌ [DEBUG] Expected: /media-stream or /media-stream?..., Got:', req.url);
    socket.destroy();
  }
});

wss.on('connection', twilioWs => {
  console.log('Twilio WebSocket connected');
  try {
    console.log('📞 [DEBUG] About to call handleMediaStreamConnection');
    console.log('📞 [DEBUG] WebSocket readyState:', twilioWs?.readyState);
    console.log('📞 [DEBUG] WebSocket type:', typeof twilioWs);
    handleMediaStreamConnection(twilioWs, {});
    console.log('✅ [DEBUG] handleMediaStreamConnection called successfully');
  } catch (error) {
    console.error('❌ [DEBUG] Error calling handleMediaStreamConnection:', error);
    console.error('❌ [DEBUG] Error stack:', error.stack);
  }
});

// API Routes - Outbound
app.post('/api/outbound/make-call', makeCall);
app.post('/api/outbound/ai-intro', aiIntro);
app.get('/api/outbound/get-all-calls', getAllCalls);
app.post('/api/outbound/call-status', callStatus);
app.post('/api/outbound/recording-status', recordingStatus);
app.get('/api/outbound/recording/:callSid', proxyRecording);

// API Routes - Inbound
app.post('/api/inbound/incoming-call', handleIncomingCall);
app.post('/api/inbound/call-status', callStatus);
app.post('/api/inbound/recording-status', recordingStatus);
app.get('/api/inbound/recording/:callSid', proxyRecording);

// API Routes - SIP (OpenAI Realtime SIP webhooks)
app.use('/api/sip', sipRoutes);

// Manual call trigger (for testing)
app.get('/call', async (req, res) => {
  const to = req.query.to;
  if (!to) return res.status(400).send('Add ?to=+918120523400');

  try {
    console.log(`📞 [DEBUG] Call request received for: ${to}`);
    const client = twilio(TWILIO_SID, TWILIO_AUTH_TOKEN);
    const baseUrl = TUNNEL_DOMAIN ? `https://${TUNNEL_DOMAIN}` : `http://localhost:${PORT}`;
    const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const wsUrl = `${wsProtocol}://${wsHost}/media-stream`;
    
    console.log(`📞 [DEBUG] Creating Twilio call with WebSocket URL: ${wsUrl}`);
    
    // Build status callback URL
    const statusCallbackUrl = TUNNEL_DOMAIN 
      ? `https://${TUNNEL_DOMAIN}/api/outbound/call-status`
      : `http://localhost:${PORT}/api/outbound/call-status`;
    
    console.log(`📞 [DEBUG] Status callback URL: ${statusCallbackUrl}`);
    
    const call = await client.calls.create({
      from: TWILIO_NUMBER,
      to: to,
      statusCallback: statusCallbackUrl,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      twiml: `<Response>
        <Connect>
          <Stream url="${wsUrl}"/>
        </Connect>
        <Pause length="3600"/>
      </Response>`
    });
    
    console.log(`✅ [DEBUG] Twilio call created - SID: ${call.sid}, Status: ${call.status}`);
    res.send(`Calling ${to}... SID: ${call.sid}`);
  } catch (err) {
    console.error('❌ [DEBUG] Error creating call:', err);
    res.status(500).send(err.message);
  }
});

server.listen(PORT, () => {
  console.log(`\n🤖 ROBERT VOICE AGENT SERVICE READY`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Tunnel URL: https://${TUNNEL_DOMAIN}`);
  console.log(`📋 Configs: AI=${configManager.getAIConfig() ? '✅' : '❌'}, Audio=${configManager.getAudioConfig() ? '✅' : '❌'}, Telephony=${configManager.getTelephonyConfig() ? '✅' : '❌'}`);
  console.log(`CALL NOW → http://localhost:${PORT}/call?to=+918120523400\n`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await browserAgentService.cleanup();
  configManager.destroy();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await browserAgentService.cleanup();
  configManager.destroy();
  server.close(() => {
    process.exit(0);
  });
});

