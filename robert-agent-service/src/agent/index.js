import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import twilio from 'twilio';
import dotenv from 'dotenv';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import configManager from './configManager.js';
import { handleMediaStreamConnection } from '../handlers/mediaStream/index.js';
import { makeCall, aiIntro, getAllCalls, handleIncomingCall } from '../handlers/callHandlers.js';
import { callStatus } from '../handlers/statusHandlers.js';
import { recordingStatus, proxyRecording } from '../handlers/recordingHandlers.js';
import sipRoutes from '../routes/sipRoutes.js';
import secretsManager from '../services/secretsManager.js';
import browserAgentService from '../services/browser/index.js';
import toolExecutor from '../tools/index.js';
import sessionManagementService from '../services/sessionManagementService.js';
import scheduler from '../jobs/scheduler.js';
import memoryCleanupJob from '../jobs/memoryCleanupJob.js';
import retentionCleanupJob from '../jobs/retentionCleanupJob.js';
import kbMigrationJob from '../jobs/kbMigrationJob.js';
import kbDriftDetectionJob from '../jobs/kbDriftDetectionJob.js';
import { initializeTelemetry, shutdownTelemetry } from '../utils/telemetry.js';
import { initializeMetrics } from '../services/metricsService.js';

// Initialize OpenTelemetry before other imports
initializeTelemetry();
// Initialize metrics after telemetry
initializeMetrics();

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
    
    // Initialize session management service (starts cleanup interval)
    console.log('✅ Session Management Service initialized');
    const metrics = sessionManagementService.getSessionMetrics();
    console.log(`📊 Session Management: TTL=${metrics.sessionTTLMinutes}min, Max=${metrics.maxSessions}, Cleanup=${metrics.cleanupIntervalSeconds}s`);
    
    // Validate SIP configuration on startup
    const sipService = (await import('../services/sipService.js')).default;
    const sipValidation = sipService.validateOnStartup();
    if (sipValidation.enabled) {
      if (sipValidation.valid) {
        console.log('✅ SIP configuration validated successfully');
        if (sipValidation.warnings.length > 0) {
          console.log('⚠️ SIP warnings:', sipValidation.warnings.join('; '));
        }
      } else {
        console.error('❌ SIP configuration validation failed:');
        sipValidation.errors.forEach(error => console.error(`   - ${error}`));
        if (sipValidation.warnings.length > 0) {
          console.log('⚠️ SIP warnings:', sipValidation.warnings.join('; '));
        }
        // Don't fail startup if SIP validation fails - Media Streams will be used as fallback
        console.log('⚠️ SIP will not be used - Media Streams will be the primary path');
      }
    } else {
      console.log('ℹ️ SIP is not enabled - Media Streams will be the primary path');
    }
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
app.get('/', async (_, res) => {
  const sipService = (await import('../services/sipService.js')).default;
  const sipStats = sipService.getStats();
  const sipValidation = sipService.validateOnStartup();
  
  res.json({ 
    status: 'ok', 
    service: 'robert-voice-agent',
    configs: {
      ai: configManager.getAIConfig() ? 'loaded' : 'not loaded',
      audio: configManager.getAudioConfig() ? 'loaded' : 'not loaded',
      telephony: configManager.getTelephonyConfig() ? 'loaded' : 'not loaded',
      tools: configManager.getAllToolConfigs().length > 0 ? 'loaded' : 'not loaded'
    },
    websocket: {
      url: TUNNEL_DOMAIN ? `wss://${TUNNEL_DOMAIN}/media-stream` : `ws://localhost:${PORT}/media-stream`,
      status: 'ready'
    },
    sip: {
      enabled: sipStats.isEnabled,
      valid: sipValidation.valid,
      activeSessions: sipStats.activeSessions,
      endpoint: sipStats.endpoint,
      errors: sipValidation.errors,
      warnings: sipValidation.warnings
    }
  });
});

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

// API Routes - Diagnostics (non-intrusive, optional)
app.get('/api/diagnostic/call/:callSid', async (req, res) => {
  try {
    const { callSid } = req.params;
    const audioDiagnosticService = (await import('../services/audioDiagnosticService.js')).default;
    const { conversations } = await import('../shared/state.js');
    
    const conversation = conversations[callSid];
    const diagnostic = audioDiagnosticService.getDiagnostics(callSid);
    
    // Get additional state if available
    const stateManager = conversation?.stateManager || null;
    
    const response = {
      callSid,
      hasConversation: !!conversation,
      diagnostic: diagnostic || null,
      audioMetrics: stateManager ? {
        outboundChunks: stateManager.outboundAudioChunkCount || 0,
        inboundChunks: stateManager.inboundAudioChunkCount || 0,
        audioBufferSize: stateManager.outboundAudioBuffer?.length || 0,
        lastAudioChunkTime: stateManager.lastAudioChunkTime || null,
        isResponding: stateManager.isResponding || false,
        activeResponseId: stateManager.activeResponseId || null
      } : null,
      openaiStatus: stateManager ? {
        websocketReady: stateManager.openaiWs?.readyState === 1,
        errorCount: stateManager.errorCount || 0,
        hasMaxErrors: stateManager.hasMaxErrors?.() || false
      } : null,
      responseStatus: stateManager ? {
        hasInitialGreeting: stateManager.hasInitialGreetingBeenSent || false,
        waitingForUser: stateManager.waitingForUser || false,
        isInterrupted: stateManager.isInterrupted || false
      } : null
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error getting diagnostic:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/diagnostic/all', async (req, res) => {
  try {
    const audioDiagnosticService = (await import('../services/audioDiagnosticService.js')).default;
    const diagnostics = audioDiagnosticService.getAllDiagnostics();
    res.json({ diagnostics, count: diagnostics.length });
  } catch (error) {
    console.error('Error getting all diagnostics:', error);
    res.status(500).json({ error: error.message });
  }
});

// API Routes - SIP (OpenAI Realtime SIP webhooks)
// Add diagnostic logging middleware for ALL SIP webhook requests
app.use('/api/sip', (req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`🔍 [SIP WEBHOOK] ${timestamp} - ${req.method} ${req.path}`);
  console.log(`🔍 [SIP WEBHOOK] Headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`🔍 [SIP WEBHOOK] Body:`, JSON.stringify(req.body, null, 2));
  console.log(`🔍 [SIP WEBHOOK] Query:`, JSON.stringify(req.query, null, 2));
  console.log(`🔍 [SIP WEBHOOK] IP: ${req.ip}, User-Agent: ${req.get('user-agent')}`);
  next();
});

app.use('/api/sip', sipRoutes);

// API Routes - Tools (for admin portal to discover available tools)
app.get('/api/tools/definitions', (req, res) => {
  try {
    const toolDefinitions = toolExecutor.getToolDefinitions();
    const availableTools = toolExecutor.getAvailableTools();
    
    // Map to expected format with descriptions
    const tools = toolDefinitions.map(def => ({
      name: def.name,
      description: def.description || '',
      parameters: def.parameters || {}
    }));
    
    res.json({ 
      success: true, 
      tools,
      count: tools.length
    });
  } catch (error) {
    console.error('Error fetching tool definitions:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// API Route - Browser Agent Service (for CRM browser tool)
app.post('/api/tools/browser/execute', async (req, res) => {
  try {
    const { task, args, callContext } = req.body;
    
    if (!task) {
      return res.status(400).json({ 
        success: false, 
        error: 'Task is required' 
      });
    }

    const browserAgentService = (await import('../services/browser/index.js')).default;
    const result = await browserAgentService.executeTask(task, args || {}, callContext || {});
    
    res.json({ 
      success: true, 
      result 
    });
  } catch (error) {
    console.error('Error executing browser task:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// API Route - ITM Booking Demo (for testing)
// Note: This endpoint requires the backend to manage browser instance
// and pass page data, which is complex over HTTP. 
// For now, we'll return an error suggesting to use the backend directly
app.post('/api/booking/itm/demo', async (req, res) => {
  try {
    res.status(501).json({ 
      success: false, 
      error: 'ITM Booking Demo requires browser instance management. Use backend endpoint directly for testing.' 
    });
  } catch (error) {
    console.error('Error in ITM booking demo:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Manual call trigger (for testing)
app.get('/call', async (req, res) => {
  const to = req.query.to?.trim(); // Trim phone number to remove leading/trailing spaces
  if (!to) return res.status(400).send('Add ?to=+918120523400');

  try {
    console.log(`📞 [DEBUG] Call request received for: ${to}`);
    const client = twilio(TWILIO_SID, TWILIO_AUTH_TOKEN);
    const baseUrl = TUNNEL_DOMAIN ? `https://${TUNNEL_DOMAIN}` : `http://localhost:${PORT}`;
    const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const wsUrl = `${wsProtocol}://${wsHost}/media-stream`;
    
    // Build status callback URL
    const statusCallbackUrl = TUNNEL_DOMAIN 
      ? `https://${TUNNEL_DOMAIN}/api/outbound/call-status`
      : `http://localhost:${PORT}/api/outbound/call-status`;
    
    // Prepare Media Streams options (used as fallback or primary)
    const mediaStreamsOptions = {
      to,
      from: TWILIO_NUMBER,
      statusCallback: statusCallbackUrl,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      twiml: `<Response>
        <Connect>
          <Stream url="${wsUrl}"/>
        </Connect>
        <Pause length="3600"/>
      </Response>`
    };

    // Use routing logic to decide between SIP and Media Streams
    const sipCallRouter = (await import('../services/sip/sipCallRouter.js')).default;
    const telephonyConfig = configManager.getTelephonyConfig();
    
    const { call, method } = await sipCallRouter.routeCall(
      client,
      to,
      TWILIO_NUMBER,
      telephonyConfig,
      mediaStreamsOptions
    );

    if (!call) {
      console.error('❌ [DEBUG] Failed to create call');
      return res.status(500).send('Failed to create call');
    }

    console.log(`✅ [DEBUG] Twilio call created - SID: ${call.sid}, Status: ${call.status}, Method: ${method}`);
    res.send(`Call ${method} created: ${call.sid}`);
  } catch (err) {
    console.error('❌ [DEBUG] Error creating call:', err);
    res.status(500).send(`Error: ${err.message}`);
  }
});

server.listen(PORT, async () => {
  console.log(`\n🤖 ROBERT VOICE AGENT SERVICE READY`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Tunnel URL: https://${TUNNEL_DOMAIN}`);
  const toolConfigsCount = configManager.getAllToolConfigs().length;
  console.log(`📋 Configs: AI=${configManager.getAIConfig() ? '✅' : '❌'}, Audio=${configManager.getAudioConfig() ? '✅' : '❌'}, Telephony=${configManager.getTelephonyConfig() ? '✅' : '❌'}, Tools=${toolConfigsCount > 0 ? `✅ (${toolConfigsCount})` : '❌'}`);
  
  // Initialize scheduled jobs
  try {
    scheduler.registerJob(memoryCleanupJob.name, memoryCleanupJob.schedule, memoryCleanupJob.run);
    scheduler.registerJob(retentionCleanupJob.name, retentionCleanupJob.schedule, retentionCleanupJob.run);
    scheduler.registerJob(kbMigrationJob.name, kbMigrationJob.schedule, kbMigrationJob.run);
    scheduler.registerJob(kbDriftDetectionJob.name, kbDriftDetectionJob.schedule, kbDriftDetectionJob.run);
    scheduler.start();
    console.log(`⏰ Scheduled jobs initialized: ${scheduler.getJobs().length} jobs registered`);
  } catch (error) {
    console.error('❌ Error initializing scheduled jobs:', error);
    // Don't fail startup if jobs fail to initialize
  }
  
  console.log(`CALL NOW → http://localhost:${PORT}/call?to=+918120523400\n`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  scheduler.stop();
  await browserAgentService.cleanup();
  configManager.destroy();
  await shutdownTelemetry();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  scheduler.stop();
  await browserAgentService.cleanup();
  configManager.destroy();
  await shutdownTelemetry();
  server.close(() => {
    process.exit(0);
  });
});

