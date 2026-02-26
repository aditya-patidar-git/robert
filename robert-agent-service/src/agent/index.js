// Load .env first so process.env is set before any module (e.g. tools) is evaluated
import './loadEnv.js';

import express from 'express';
import { createServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import twilioClient from '../utils/twilioClient.js';
import cors from 'cors';
import configManager from './configManager.js';
import { handleMediaStreamConnection } from '../handlers/mediaStream/index.js';
import { handleTestClientConnection } from '../handlers/mediaStream/testClientHandler.js';
import { makeCall, aiIntro, getAllCalls, handleIncomingCall, afterHoursTransfer, voicemailRecordingStatus } from '../handlers/callHandlers.js';
import { callStatus } from '../handlers/statusHandlers.js';
import { recordingStatus, proxyRecording } from '../handlers/recordingHandlers.js';
import { twilioWebhookAuth } from '../middleware/twilioWebhookAuth.js';
import sipRoutes from '../routes/sipRoutes.js';
import gmailOAuthRoutes from '../routes/gmailOAuth.js';
import secretsManager from '../services/secretsManager.js';
import browserAgentService from '../services/browser/index.js';
import toolExecutor from '../tools/index.js';
import sessionManagementService from '../services/sessionManagementService.js';
import healthCheckService from '../services/healthCheckService.js';
import distributedStateService from '../services/distributedStateService.js';
import { validateAndLogStartupConfig } from '../utils/configValidator.js';
import scheduler from '../jobs/scheduler.js';
import memoryCleanupJob from '../jobs/memoryCleanupJob.js';
import retentionCleanupJob from '../jobs/retentionCleanupJob.js';
import afterCallTranscriptionJob from '../jobs/afterCallTranscriptionJob.js';
import kbMigrationJob from '../jobs/kbMigrationJob.js';
import kbDriftDetectionJob from '../jobs/kbDriftDetectionJob.js';
import { initializeTelemetry, shutdownTelemetry } from '../utils/telemetry.js';
import { initializeMetrics } from '../services/metricsService.js';
import configSyncClient from '../services/configSyncClient.js';

// Initialize OpenTelemetry before other imports
initializeTelemetry();
// Initialize metrics after telemetry
initializeMetrics();

// Initialize secrets manager and validate required secrets
(async () => {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 ROBERT AGENT SERVICE STARTING');
    console.log('='.repeat(80) + '\n');

    await secretsManager.initialize();
    console.log('✅ Secrets Manager initialized successfully');

    // Initialize session management service AFTER environment variables are loaded
    // This ensures Twilio Sync can access env vars during initialization
    await sessionManagementService.initialize();
    console.log('✅ Session Management Service initialized');
    const metrics = await sessionManagementService.getSessionMetrics();
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
  VERIFIED_CALLER_ID,
  CALL_TO,
  TUNNEL_DOMAIN,
  OPENAI_API_KEY,
  MONGO_URI,
  PORT = 3002
} = process.env;

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

// In-memory lock to prevent duplicate calls (simple debouncing)
const pendingCalls = new Map(); // phoneNumber -> timestamp

// Cached sipService for root health route (avoids repeated dynamic import)
let _sipService = null;

// Add error handler to WebSocket server
wss.on('error', (error) => {
  console.error('❌ WebSocket server error:', error.message);
});

// Trust proxy so req.protocol and req.ip are correct when behind a reverse proxy (needed for Twilio webhook URL validation)
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Required for Twilio form-encoded callbacks

// Initialize config manager
await configManager.initialize();
if (process.env.BACKEND_URL) {
  configSyncClient.start(configManager);
}

// Basic health check (backward compatible)
app.get('/', async (_, res) => {
  if (_sipService === null) {
    _sipService = (await import('../services/sipService.js')).default;
  }
  const sipStats = _sipService.getStats();
  const sipValidation = _sipService.validateOnStartup();

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

// Comprehensive health endpoint (for load balancers and monitoring)
app.get('/health', async (req, res) => {
  try {
    const healthStatus = await healthCheckService.getFullStatus({
      sessionManagementService,
      browserAgentService,
      distributedStateService
    });

    const httpStatus = healthStatus.status === 'unhealthy' ? 503 : 200;

    // Production: always return minimal response (no components, connections, or execution details)
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction || req.query.minimal === 'true') {
      return res.status(httpStatus).json({
        status: healthStatus.status,
        uptime: healthStatus.uptime,
        ...(isProduction && { timestamp: new Date().toISOString() })
      });
    }

    res.status(httpStatus).json(healthStatus);
  } catch (error) {
    console.error('❌ [Health] Error getting health status:', error);
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(503).json({
      status: 'unhealthy',
      error: isProduction ? 'Unavailable' : error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Quick health check (minimal computation, for frequent polling)
app.get('/health/quick', (req, res) => {
  const quickStatus = healthCheckService.getQuickStatus();
  const httpStatus = quickStatus.status === 'unhealthy' ? 503 : 200;
  // Production: return only status and uptime (no session/heap metrics)
  if (process.env.NODE_ENV === 'production') {
    return res.status(httpStatus).json({
      status: quickStatus.status,
      uptime: quickStatus.uptime
    });
  }
  res.status(httpStatus).json(quickStatus);
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
  if (req.url === '/media-stream' || req.url.startsWith('/media-stream?')) {
    try {
      wss.handleUpgrade(req, socket, head, ws => {
        // Attach request object to WebSocket so it can be passed to handler
        ws._req = req;
        wss.emit('connection', ws, req);
      });
    } catch (error) {
      console.error('❌ Error during WebSocket upgrade:', error.message);
      socket.destroy();
    }
  } else if (req.url === '/media-stream-test' || req.url.startsWith('/media-stream-test?')) {
    try {
      wss.handleUpgrade(req, socket, head, ws => {
        ws._req = req;
        wss.emit('test-connection', ws, req);
      });
    } catch (error) {
      console.error('❌ Error during test client WebSocket upgrade:', error.message);
      socket.destroy();
    }
  } else {
    socket.destroy();
  }
});

wss.on('connection', (twilioWs, req) => {
  try {
    const requestObj = req || twilioWs._req || {};
    handleMediaStreamConnection(twilioWs, requestObj);
  } catch (error) {
    console.error('❌ Error calling handleMediaStreamConnection:', error.message);
  }
});

wss.on('test-connection', (testWs, req) => {
  try {
    const requestObj = req || testWs._req || {};
    handleTestClientConnection(testWs, requestObj);
  } catch (error) {
    console.error('❌ Error calling handleTestClientConnection:', error.message);
    if (testWs.readyState === 0 || testWs.readyState === 1) {
      testWs.close(1011, 'Internal server error');
    }
  }
});

// API Routes - Outbound (make-call and ai-intro are not Twilio callbacks; call-status and recording-status are)
app.post('/api/outbound/make-call', makeCall);
app.post('/api/outbound/ai-intro', twilioWebhookAuth, aiIntro);
app.get('/api/outbound/get-all-calls', getAllCalls);
app.post('/api/outbound/call-status', twilioWebhookAuth, callStatus);
app.post('/api/outbound/recording-status', twilioWebhookAuth, recordingStatus);
app.get('/api/outbound/recording/:callSid', proxyRecording);

// API Routes - Inbound (all POSTs are Twilio webhooks)
app.post('/api/inbound/incoming-call', twilioWebhookAuth, handleIncomingCall);
app.post('/api/inbound/handle-call', twilioWebhookAuth, handleIncomingCall);
app.post('/api/inbound/after-hours-transfer', twilioWebhookAuth, afterHoursTransfer);
app.post('/api/inbound/voicemail-recording-status', twilioWebhookAuth, voicemailRecordingStatus);
app.post('/api/inbound/call-status', twilioWebhookAuth, callStatus);
app.post('/api/inbound/recording-status', twilioWebhookAuth, recordingStatus);
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

// API Route - Email Connection Test
app.get('/api/test/email-connection', async (req, res) => {
  try {
    const emailService = (await import('../services/emailService.js')).default;
    const result = await emailService.testConnection();

    // Mask sensitive information in config
    const maskEmail = (email) => {
      if (!email) return 'Not configured';
      const [local, domain] = email.split('@');
      return local ? `${local.substring(0, 3)}***@${domain}` : `***@${domain}`;
    };

    res.json({
      success: result.connected,
      connected: result.connected,
      message: result.connected
        ? 'SMTP connection test successful'
        : `SMTP connection test failed: ${result.error}`,
      error: result.error || null,
      config: {
        host: process.env.SMTP_HOST || 'Not configured',
        port: process.env.SMTP_PORT || 'Not configured',
        user: maskEmail(process.env.SMTP_USER),
        from: process.env.SMTP_FROM || 'robert@universalmct.co.uk',
        secure: process.env.SMTP_SECURE === 'true'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error testing email connection:', error);
    res.status(500).json({
      success: false,
      connected: false,
      message: 'Error testing email connection',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.use('/api/gmail', gmailOAuthRoutes);

// API Routes - SIP (OpenAI Realtime SIP webhooks) - verbose logging only when SIP_DEBUG=true
app.use('/api/sip', (req, res, next) => {
  const timestamp = new Date().toISOString();
  if (process.env.SIP_DEBUG === 'true') {
    console.log(`🔍 [SIP WEBHOOK] ${timestamp} - ${req.method} ${req.path}`);
    console.log(`🔍 [SIP WEBHOOK] Headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`🔍 [SIP WEBHOOK] Body:`, JSON.stringify(req.body, null, 2));
    console.log(`🔍 [SIP WEBHOOK] Query:`, JSON.stringify(req.query, null, 2));
    console.log(`🔍 [SIP WEBHOOK] IP: ${req.ip}, User-Agent: ${req.get('user-agent')}`);
  } else {
    console.log(`🔍 [SIP WEBHOOK] ${timestamp} ${req.method} ${req.path}`);
  }
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
// Now refactored to handle browser management internally for service separation
app.post('/api/booking/itm/execute', async (req, res) => {
  try {
    const { chromium } = await import('playwright');
    const itmBookingService = (await import('../services/itmBooking/index.js')).default;

    console.log('🚀 [AGENT] Starting ITM booking execution via API...');

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      const result = await itmBookingService.executeITMBookingDemo(page);
      res.json({ success: true, result });
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error('❌ [AGENT] Error in ITM booking execution:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API Route - Text Similarity and Content Fetching (for KB Mapping)
app.post('/api/utils/similarity', async (req, res) => {
  try {
    const { url, kbContent } = req.body;
    const kbDriftDetectionService = (await import('../services/kbDriftDetectionService.js')).default;

    if (!url || !kbContent) {
      return res.status(400).json({ success: false, error: 'URL and kbContent are required' });
    }

    const websiteContent = await kbDriftDetectionService.fetchWebsiteContent(url);
    const similarity = kbDriftDetectionService.calculateSimilarity(kbContent, websiteContent);

    res.json({
      success: true,
      similarity,
      difference: 1 - similarity,
      isStale: (1 - similarity) > kbDriftDetectionService.driftThreshold,
      kbContentLength: kbContent.length,
      websiteContentLength: websiteContent.length
    });
  } catch (error) {
    console.error('❌ [AGENT] Error in similarity check:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manual call trigger (for testing): VERIFIED_CALLER_ID calls CALL_TO (simulated inbound). TWILIO_NUMBER unchanged elsewhere.
app.get('/call', async (req, res) => {
  const to = req.query.to?.trim() || CALL_TO;
  if (!to) return res.status(400).send('Add ?to=<number> or set CALL_TO in .env');

  const from = VERIFIED_CALLER_ID;
  if (!from) return res.status(500).send('VERIFIED_CALLER_ID is required for /call');

  try {
    const now = Date.now();
    const key = `${from}:${to}`;
    const lastCallTime = pendingCalls.get(key);
    if (lastCallTime && (now - lastCallTime) < 3000) {
      console.warn(`⚠️ [DEBUG] Duplicate call prevented for ${key} (last ${now - lastCallTime}ms ago)`);
      return res.status(429).send(`Call already in progress. Please wait.`);
    }
    pendingCalls.set(key, now);
    for (const [k, timestamp] of pendingCalls.entries()) {
      if (now - timestamp > 10000) pendingCalls.delete(k);
    }

    console.log(`📞 [DEBUG] Call: ${from} → ${to}`);
    const baseUrl = TUNNEL_DOMAIN ? `https://${TUNNEL_DOMAIN}` : `http://localhost:${PORT}`;
    const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const wsUrl = `${wsProtocol}://${wsHost}/media-stream`;
    const statusCallbackUrl = TUNNEL_DOMAIN
      ? `https://${TUNNEL_DOMAIN}/api/outbound/call-status`
      : `http://localhost:${PORT}/api/outbound/call-status`;

    const mediaStreamsOptions = {
      to,
      from,
      statusCallback: statusCallbackUrl,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      twiml: `<Response>
        <Connect>
          <Stream url="${wsUrl}"/>
        </Connect>
        <Pause length="3600"/>
      </Response>`
    };

    const sipCallRouter = (await import('../services/sip/sipCallRouter.js')).default;
    const telephonyConfig = configManager.getTelephonyConfig();

    const { call, method } = await sipCallRouter.routeCall(
      twilioClient,
      to,
      from,
      telephonyConfig,
      mediaStreamsOptions
    );

    if (!call) {
      pendingCalls.delete(key);
      return res.status(500).send('Failed to create call');
    }
    pendingCalls.delete(key);

    res.send(`Call ${method} created: ${call.sid}`);
  } catch (err) {
    console.error('❌ [DEBUG] Error creating call:', err);
    const key = `${VERIFIED_CALLER_ID}:${req.query.to?.trim() || CALL_TO}`;
    pendingCalls.delete(key);
    res.status(500).send(`Error: ${err.message}`);
  }
});

server.listen(PORT, async () => {
  console.log(`\n🤖 ROBERT VOICE AGENT SERVICE READY`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Tunnel URL: https://${TUNNEL_DOMAIN}`);
  const toolConfigsCount = configManager.getAllToolConfigs().length;
  console.log(`📋 Configs: AI=${configManager.getAIConfig() ? '✅' : '❌'}, Audio=${configManager.getAudioConfig() ? '✅' : '❌'}, Telephony=${configManager.getTelephonyConfig() ? '✅' : '❌'}, Tools=${toolConfigsCount > 0 ? `✅ (${toolConfigsCount})` : '❌'}`);

  // Validate all configurations at startup
  validateAndLogStartupConfig();

  // Initialize browser agent service (includes pool initialization)
  try {
    await browserAgentService.initialize();
    const poolStatus = browserAgentService.getPoolStatus();
    if (poolStatus) {
      console.log(`🏊 Browser Pool: size=${poolStatus.config.size}, mode=${poolStatus.mode}, available=${poolStatus.available}`);
    } else {
      console.log(`🏊 Browser Pool: disabled (VPN mode or single browser)`);
    }
  } catch (error) {
    console.error('❌ Error initializing browser agent service:', error);
    // Don't fail startup if browser pool fails to initialize
  }

  // Initialize scheduled jobs
  try {
    scheduler.registerJob(memoryCleanupJob.name, memoryCleanupJob.schedule, memoryCleanupJob.run);
    scheduler.registerJob(retentionCleanupJob.name, retentionCleanupJob.schedule, retentionCleanupJob.run);
    scheduler.registerJob(afterCallTranscriptionJob.name, afterCallTranscriptionJob.schedule, afterCallTranscriptionJob.run);
    scheduler.registerJob(kbMigrationJob.name, kbMigrationJob.schedule, kbMigrationJob.run);
    scheduler.registerJob(kbDriftDetectionJob.name, kbDriftDetectionJob.schedule, kbDriftDetectionJob.run);
    scheduler.start();
    console.log(`⏰ Scheduled jobs initialized: ${scheduler.getJobs().length} jobs registered`);
    const abusePreventionService = (await import('../services/abusePreventionService.js')).default;
    abusePreventionService.startPruneInterval?.();
  } catch (error) {
    console.error('❌ Error initializing scheduled jobs:', error);
    // Don't fail startup if jobs fail to initialize
  }

  const callTo = CALL_TO || '<CALL_TO>';
  console.log(`CALL NOW → http://localhost:${PORT}/call?to=${callTo} (${VERIFIED_CALLER_ID || 'VERIFIED_CALLER_ID'} → ${callTo})\n`);
});

/**
 * Clean up all active Media Stream connections on shutdown.
 * Stops ping intervals and closes WebSockets so pong logs stop immediately.
 */
async function cleanupAllActiveConnections() {
  const { realtimeClients } = await import('../shared/state.js');
  const callSids = Object.keys(realtimeClients);

  if (callSids.length === 0) return;

  console.log(`Cleaning up ${callSids.length} active connection(s)...`);

  for (const callSid of callSids) {
    const client = realtimeClients[callSid];
    if (client?.connectionManager) {
      client.connectionManager.cleanup();
    }
    if (client?.openaiWs) {
      if (client.openaiWs.readyState === WebSocket.OPEN) {
        client.openaiWs.close(1000, 'Server shutting down');
      }
    }
    if (client?.twilioWs) {
      if (client.twilioWs.readyState === WebSocket.OPEN) {
        client.twilioWs.close(1000, 'Server shutting down');
      }
    }
  }

  for (const key of Object.keys(realtimeClients)) {
    delete realtimeClients[key];
  }
}

// Graceful shutdown (single path to avoid double cleanup when both SIGTERM and SIGINT fire)
let shuttingDown = false;
async function doShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('Shutting down gracefully...');
  configSyncClient.stop();
  await cleanupAllActiveConnections();
  scheduler.stop();
  await browserAgentService.shutdown();
  configManager.destroy();
  await shutdownTelemetry();
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', () => { doShutdown(); });
process.on('SIGINT', () => { doShutdown(); });

