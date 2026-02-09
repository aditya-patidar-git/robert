/**
 * SIP Handlers
 * Handle OpenAI Realtime SIP webhook events (realtime.call.incoming, etc.)
 * 
 * Flow per OpenAI documentation:
 * 1. OpenAI sends realtime.call.incoming webhook with data.id (call_id) and data.sip_headers
 * 2. Server calls OpenAI's Accept API: POST /v1/realtime/calls/{call_id}/accept
 * 3. Server opens WebSocket to wss://api.openai.com/v1/realtime?call_id={call_id} to control the call
 */

import { conversations } from "../shared/state.js";
import configManager from "../agent/configManager.js";
import toolExecutor from "../tools/index.js";
import sipService from "../services/sipService.js";
import toolExecutionService from "../services/toolExecutionService.js";
import { HTTPResultSubmitter } from "../services/toolResultSubmitter.js";
import CallRecord from "../database/models/CallRecord.js";
import HandoverRecord from "../database/models/HandoverRecord.js";
import { generateSipRoutingTwiML, generateMinimalTwiML } from "../utils/twimlGenerator.js";
import abusePreventionService from "../services/abusePreventionService.js";
import { isAfterHours } from "../utils/afterHoursUtils.js";
import { incrementActiveCalls, decrementActiveCalls } from "../services/metricsService.js";
import { setDefaultRecordingConsent } from "../services/callRecordPersistenceService.js";

function escapeTwiMLText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
import WebSocket from "ws";

// Store active SIP call WebSocket connections
const sipCallWebSockets = new Map();

/**
 * Parse SIP headers array to extract From/To phone numbers
 * @param {Array} sipHeaders - Array of {name, value} objects
 * @returns {Object} - {from, to} phone numbers
 */
function parseSipHeaders(sipHeaders) {
  const result = { from: null, to: null };
  
  if (!Array.isArray(sipHeaders)) {
    return result;
  }
  
  for (const header of sipHeaders) {
    if (!header.name || !header.value) continue;
    
    const name = header.name.toLowerCase();
    const value = header.value;
    
    // Extract phone number from SIP URI format: sip:+14155551234@domain.com
    const phoneMatch = value.match(/sip:(\+?\d+)@/);
    const phone = phoneMatch ? phoneMatch[1] : null;
    
    if (name === 'from' && phone) {
      result.from = phone;
    } else if (name === 'to' && phone) {
      result.to = phone;
    }
  }
  
  return result;
}

/**
 * Accept an incoming SIP call by calling OpenAI's Accept API
 * @param {string} callId - The call ID from the webhook
 * @param {Object} sessionConfig - Session configuration for the call
 * @returns {Promise<Object>} - Accept API response
 */
async function acceptCallViaOpenAI(callId, sessionConfig) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  
  const acceptUrl = `https://api.openai.com/v1/realtime/calls/${callId}/accept`;
  
  console.log(`📞 [SIP] Calling OpenAI Accept API: ${acceptUrl}`);
  
  const response = await fetch(acceptUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(sessionConfig)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Accept API failed: ${response.status} - ${errorText}`);
  }
  
  return response.json().catch(() => ({})); // Some responses may be empty
}

/**
 * Reject an incoming SIP call via OpenAI Reject API. Logs and returns; does not throw on non-2xx.
 */
async function rejectCallViaOpenAI(callId, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(`❌ [SIP] Cannot reject - OPENAI_API_KEY not configured`);
    return;
  }
  const url = `https://api.openai.com/v1/realtime/calls/${callId}/reject`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status_code: options.status_code ?? 486 })
    });
    if (!response.ok) {
      const text = await response.text();
      console.warn(`⚠️ [SIP] Reject API returned ${response.status}: ${text}`);
    } else {
      console.log(`✅ [SIP] Call rejected via OpenAI API: ${callId}`);
    }
  } catch (err) {
    console.warn(`⚠️ [SIP] Reject API error for ${callId}:`, err?.message);
  }
}

/**
 * Open WebSocket connection to monitor/control an accepted SIP call
 * @param {string} callId - The call ID
 * @param {Object} context - Context with callbacks for events
 */
function openCallWebSocket(callId, context = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error(`❌ [SIP] Cannot open WebSocket - OPENAI_API_KEY not configured`);
    return null;
  }
  
  const wsUrl = `wss://api.openai.com/v1/realtime?call_id=${callId}`;
  
  console.log(`🔌 [SIP] Opening WebSocket for call ${callId}: ${wsUrl}`);
  
  const ws = new WebSocket(wsUrl, {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });
  
  ws.on('open', () => {
    console.log(`✅ [SIP] WebSocket connected for call ${callId}`);
    sipCallWebSockets.set(callId, ws);
    
    // Send initial response.create to make AI speak
    ws.send(JSON.stringify({
      type: 'response.create',
      response: {
        instructions: context.initialInstructions || 'Greet the caller warmly.'
      }
    }));
  });
  
  ws.on('message', (data) => {
    try {
      const event = JSON.parse(data.toString());
      console.log(`📨 [SIP] WebSocket event for call ${callId}:`, event.type);
      
      // Handle different event types
      if (event.type === 'response.done') {
        console.log(`✅ [SIP] Response completed for call ${callId}`);
      } else if (event.type === 'error') {
        console.error(`❌ [SIP] WebSocket error event for call ${callId}:`, event.error);
      }
      
      // Call context callback if provided
      if (context.onEvent) {
        context.onEvent(event);
      }
    } catch (err) {
      console.error(`❌ [SIP] Error parsing WebSocket message for call ${callId}:`, err);
    }
  });
  
  ws.on('error', (err) => {
    console.error(`❌ [SIP] WebSocket error for call ${callId}:`, err.message);
  });
  
  ws.on('close', (code, reason) => {
    console.log(`🔌 [SIP] WebSocket closed for call ${callId}: ${code} - ${reason}`);
    sipCallWebSockets.delete(callId);
    
    // Cleanup
    if (context.onClose) {
      context.onClose(code, reason);
    }
  });
  
  return ws;
}

/**
 * Handle OpenAI Realtime SIP realtime.call.incoming webhook
 * This is called when OpenAI receives an incoming SIP call
 * 
 * Per OpenAI docs, we must:
 * 1. Extract call_id from data.id (OpenAI uses "id" field, not "call_id")
 * 2. Parse sip_headers for From/To
 * 3. Call POST /v1/realtime/calls/{call_id}/accept with session config
 * 4. Open WebSocket to control the call
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export const handleCallAccept = async (req, res) => {
  const timestamp = new Date().toISOString();
  
  // ENHANCED DIAGNOSTIC LOGGING
  console.log(`📞 [SIP] ========== CALL ACCEPT WEBHOOK ==========`);
  console.log(`📞 [SIP] Timestamp: ${timestamp}`);
  console.log(`📞 [SIP] Full request body:`, JSON.stringify(req.body, null, 2));
  console.log(`📞 [SIP] Request headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`📞 [SIP] Request IP: ${req.ip}`);
  console.log(`📞 [SIP] =========================================`);

  try {
    // Parse OpenAI's webhook format: { type, data: { id, sip_headers } }
    const { type, data } = req.body;
    
    // Validate event type
    if (type !== 'realtime.call.incoming') {
      console.log(`ℹ️ [SIP] Received non-call event type: ${type}`);
      // Return 200 for other event types to acknowledge receipt
      return res.status(200).json({ received: true, type });
    }
    
    // Extract call_id from data object (OpenAI uses "id" field, not "call_id")
    const call_id = data?.id || data?.call_id;
    const sipHeaders = data?.sip_headers || [];
    
    // Parse From/To from SIP headers
    const { from, to } = parseSipHeaders(sipHeaders);
    
    console.log(`📞 [SIP] Parsed webhook - call_id: ${call_id}, from: ${from}, to: ${to}`);
    console.log(`📞 [SIP] SIP Headers:`, JSON.stringify(sipHeaders, null, 2));

    if (!call_id) {
      console.error(`❌ [SIP] Missing call_id in realtime.call.incoming webhook`);
      return res.status(400).json({ error: 'Missing call_id in data' });
    }

    console.log(`📞 [SIP] Processing incoming call - call_id: ${call_id}, from: ${from}, to: ${to}`);

    const sessionManagementService = (await import('../services/sessionManagementService.js')).default;

    const rateLimitCheck = await abusePreventionService.checkRateLimit(from);
    if (!rateLimitCheck.allowed) {
      console.log(`🚫 [SIP] Call rejected: rate limit - ${rateLimitCheck.reason}`);
      await rejectCallViaOpenAI(call_id);
      await CallRecord.findOneAndUpdate(
        { callSid: call_id },
        { callSid: call_id, callType: 'SIP', callStatus: 'rejected', rejectReason: 'rate_limit', from, to, startTime: new Date() },
        { upsert: true }
      ).catch(() => {});
      return res.status(200).json({ received: true, call_id, rejected: true, reason: 'rate_limit' });
    }

    if (abusePreventionService.isBlocked(from)) {
      console.log(`🚫 [SIP] Call rejected: caller blocked`);
      await rejectCallViaOpenAI(call_id);
      await CallRecord.findOneAndUpdate(
        { callSid: call_id },
        { callSid: call_id, callType: 'SIP', callStatus: 'rejected', rejectReason: 'caller_blocked', from, to, startTime: new Date() },
        { upsert: true }
      ).catch(() => {});
      return res.status(200).json({ received: true, call_id, rejected: true, reason: 'caller_blocked' });
    }

    if (!sessionManagementService.canAcceptNewCall()) {
      console.log(`🚫 [SIP] Call rejected: concurrent limit reached`);
      await rejectCallViaOpenAI(call_id);
      await CallRecord.findOneAndUpdate(
        { callSid: call_id },
        { callSid: call_id, callType: 'SIP', callStatus: 'rejected', rejectReason: 'concurrent_limit_reached', from, to, startTime: new Date() },
        { upsert: true }
      ).catch(() => {});
      return res.status(200).json({ received: true, call_id, rejected: true, reason: 'concurrent_limit_reached' });
    }

    const telephonyConfig = configManager.getTelephonyConfig();
    if (telephonyConfig?.afterHoursPolicy && isAfterHours(telephonyConfig.afterHoursPolicy)) {
      console.log(`🚫 [SIP] Call rejected: after hours`);
      await rejectCallViaOpenAI(call_id);
      await CallRecord.findOneAndUpdate(
        { callSid: call_id },
        { callSid: call_id, callType: 'SIP', callStatus: 'rejected', rejectReason: 'after_hours', from, to, startTime: new Date() },
        { upsert: true }
      ).catch(() => {});
      return res.status(200).json({ received: true, call_id, rejected: true, reason: 'after_hours' });
    }

    // Initialize conversation state
    if (!conversations[call_id]) {
      sessionManagementService.initializeSession(call_id, {
        language: 'en-GB',
        from: from,
        to: to,
        callType: 'SIP',
        recordingConsent: {
          requested: false,
          given: null,
          requestedAt: null,
          respondedAt: null
        },
        memoryConsent: {
          requested: false,
          given: null,
          requestedAt: null,
          respondedAt: null
        }
      });
    }

    // Create SIP session and track status
    sipService.createSession(call_id, {
      from: from,
      to: to,
      callType: 'SIP'
    });
    sipService.trackStatus(call_id, 'incoming', { from, to });

    await setDefaultRecordingConsent(call_id, 'SIP');

    // Get configuration
    const phoneNumber = from || to;
    const currentLanguage = conversations[call_id]?.language || 'en';
    const config = configManager.getConfigForNumber(phoneNumber, currentLanguage);
    const tools = toolExecutor.getToolDefinitions();

    // Build session config for OpenAI Accept API
    const sessionConfig = {
      type: 'realtime',
      model: config.model?.id ?? config.model ?? 'gpt-realtime',
      instructions: config.instructions || 'You are a helpful assistant.',
      voice: config.voice?.id || 'alloy',
      tools: tools.map(tool => ({
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      })),
      // Audio configuration
      input_audio_format: 'g711_ulaw',
      output_audio_format: 'g711_ulaw',
      // Turn detection
      turn_detection: {
        type: 'server_vad',
        threshold: config.vadThreshold ? config.vadThreshold / 1000 : 0.5,
        prefix_padding_ms: config.startPadding || 300,
        silence_duration_ms: config.endPadding || 500
      }
    };

    console.log(`📞 [SIP] Session config for Accept API:`, JSON.stringify(sessionConfig, null, 2));

    // Create CallRecord
    try {
      await CallRecord.findOneAndUpdate(
        { callSid: call_id },
        {
          callSid: call_id,
          callType: 'SIP',
          callStatus: 'accepting',
          from: from,
          to: to,
          startTime: new Date()
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error(`❌ [SIP] Error creating CallRecord:`, err);
    }

    // IMPORTANT: Return 200 immediately to acknowledge webhook receipt
    // Then process the call asynchronously
    res.status(200).json({ received: true, call_id });
    
    console.log(`✅ [SIP] Acknowledged webhook for call_id: ${call_id}`);

    // Process call acceptance asynchronously
    setImmediate(async () => {
      try {
        abusePreventionService.recordCall(from, call_id, { direction: 'inbound', timestamp: new Date() });

        console.log(`📞 [SIP] Accepting call via OpenAI API: ${call_id}`);
        await acceptCallViaOpenAI(call_id, sessionConfig);
        console.log(`✅ [SIP] Call accepted via OpenAI API: ${call_id}`);

        incrementActiveCalls({ entry_path: 'SIP' });
        sipService.trackStatus(call_id, 'accepted', { from, to });

        await CallRecord.findOneAndUpdate(
          { callSid: call_id },
          { callStatus: 'in-progress' }
        ).catch(err => console.error(`❌ [SIP] Error updating CallRecord:`, err));

        openCallWebSocket(call_id, {
          initialInstructions: config.instructions,
          onEvent: (event) => {
            if (event.type === 'conversation.item.created' && event.item?.type === 'function_call') {
              console.log(`🔧 [SIP] Tool call received for ${call_id}:`, event.item.name);
            }
          },
          onClose: async (code, reason) => {
            console.log(`📞 [SIP] Call ended: ${call_id}`);
            decrementActiveCalls({ entry_path: 'SIP' });
            if (conversations[call_id]) delete conversations[call_id];
            sipService.trackStatus(call_id, 'completed', { code, reason });
            sipService.deleteSession(call_id);
            await CallRecord.findOneAndUpdate(
              { callSid: call_id },
              { callStatus: 'completed', endTime: new Date() }
            ).catch(err => console.error(`❌ [SIP] Error updating CallRecord:`, err));
          }
        });
      } catch (error) {
        console.error(`❌ [SIP] Error accepting call ${call_id}:`, error);
        decrementActiveCalls({ entry_path: 'SIP' });
        if (conversations[call_id]) delete conversations[call_id];
        sipService.trackStatus(call_id, 'failed', { error: error.message });
        await CallRecord.findOneAndUpdate(
          { callSid: call_id },
          { callStatus: 'failed' }
        ).catch(err => console.error(`❌ [SIP] Error updating CallRecord:`, err));
      }
    });

  } catch (error) {
    console.error(`❌ [SIP] Error handling call accept:`, error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * Close WebSocket connection for a call
 * @param {string} callId - The call ID
 */
export function closeSipCallWebSocket(callId) {
  const ws = sipCallWebSockets.get(callId);
  if (ws) {
    console.log(`🔌 [SIP] Closing WebSocket for call ${callId}`);
    ws.close(1000, 'Call ended');
    sipCallWebSockets.delete(callId);
  }
}

/**
 * Get WebSocket connection for a call (for external control)
 * @param {string} callId - The call ID
 * @returns {WebSocket|null} - The WebSocket connection or null
 */
export function getSipCallWebSocket(callId) {
  return sipCallWebSockets.get(callId) || null;
}

/**
 * Handle OpenAI Realtime SIP call status updates
 * Handles event types like realtime.call.completed, realtime.call.failed, etc.
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export const handleCallStatus = async (req, res) => {
  try {
    const timestamp = new Date().toISOString();

    // ENHANCED DIAGNOSTIC LOGGING
    console.log(`📞 [SIP] ========== CALL STATUS WEBHOOK ==========`);
    console.log(`📞 [SIP] Timestamp: ${timestamp}`);
    console.log(`📞 [SIP] Full request body:`, JSON.stringify(req.body, null, 2));
    console.log(`📞 [SIP] Request headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`📞 [SIP] =========================================`);

    // Parse OpenAI's event format: { type, data: { id, ... } }
    const { type, data } = req.body;
    
    // Extract call_id - OpenAI uses "id" field, support fallbacks for compatibility
    const call_id = data?.id || data?.call_id || req.body.call_id;
    
    // Derive status from event type (e.g., realtime.call.completed -> completed)
    let status = req.body.status;
    if (!status && type) {
      // Extract status from event type like "realtime.call.completed" -> "completed"
      const parts = type.split('.');
      status = parts[parts.length - 1]; // Get last part
    }

    if (!call_id) {
      console.error(`❌ [SIP] Missing call_id in call status webhook`);
      return res.status(400).json({ error: 'Missing call_id' });
    }

    console.log(`📞 [SIP] Call status update - call_id: ${call_id}, status: ${status}, type: ${type}`);

    // Track status change
    sipService.trackStatus(call_id, status);

    // Update CallRecord
    try {
      const updateData = { callStatus: status };
      if (['completed', 'failed', 'busy', 'no-answer'].includes(status)) {
        updateData.endTime = new Date();
      }
      
      await CallRecord.findOneAndUpdate(
        { callSid: call_id },
        updateData,
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error(`❌ [SIP] Error updating CallRecord:`, err);
    }

    // Cleanup on terminal states
    const sessionManagementService = (await import('../services/sessionManagementService.js')).default;
    if (['completed', 'failed', 'busy', 'no-answer', 'ended'].includes(status)) {
      console.log(`🧹 [SIP] Cleaning up resources for call ${call_id}`);
      
      // Close WebSocket if open
      closeSipCallWebSocket(call_id);
      
      // Clean up tool execution state
      toolExecutionService.cleanup(call_id);
      
      sessionManagementService.deleteSession(call_id);
      sipService.deleteSession(call_id);
    }

    res.status(200).json({ received: true, call_id, status });
  } catch (error) {
    console.error(`❌ [SIP] Error handling call status:`, error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * Handle OpenAI Realtime SIP tool execution webhook
 * This is called when OpenAI needs to execute a tool during a SIP call
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export const handleToolExecution = async (req, res) => {
  try {
    // Parse webhook payload - OpenAI may send different formats
    // Support both formats: {call_id, tool_call_id, name, arguments} or {call_id, item: {call_id, name, arguments}}
    let call_id, tool_call_id, name, args;
    
    if (req.body.item) {
      // Format from Realtime API event structure
      call_id = req.body.call_id || req.body.item.call_id;
      tool_call_id = req.body.item.call_id || req.body.tool_call_id;
      name = req.body.item.name;
      args = req.body.item.arguments;
    } else {
      // Direct format
      call_id = req.body.call_id;
      tool_call_id = req.body.tool_call_id || req.body.call_id;
      name = req.body.name;
      args = req.body.arguments;
    }

    if (!call_id) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing call_id' 
      });
    }

    if (!tool_call_id) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing tool_call_id' 
      });
    }

    if (!name) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing tool name' 
      });
    }

    // ENHANCED DIAGNOSTIC LOGGING
    const timestamp = new Date().toISOString();
    console.log(`🔧 [SIP] ========== TOOL EXECUTION WEBHOOK ==========`);
    console.log(`🔧 [SIP] Timestamp: ${timestamp}`);
    console.log(`🔧 [SIP] call_id: ${call_id}, tool: ${name}, tool_call_id: ${tool_call_id}`);
    console.log(`🔧 [SIP] Full request body:`, JSON.stringify(req.body, null, 2));
    console.log(`🔧 [SIP] Request headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`🔧 [SIP] =========================================`);

    console.log(`🔧 [SIP] Tool execution webhook received - call_id: ${call_id}, tool: ${name}, tool_call_id: ${tool_call_id}`);

    // Get SIP session to retrieve phone number and track tool call
    const sipSession = sipService.getSession(call_id);
    const phoneNumber = sipSession?.from || sipSession?.to || null;
    const conversation = conversations[call_id] || {};

    // Track pending tool call
    if (sipSession) {
      sipService.updateSession(call_id, {
        lastActivity: Date.now()
      });
    }

    // Execute tool using unified service
    const executionResult = await toolExecutionService.executeTool({
      callId: call_id,
      callSid: call_id, // For SIP, call_id is the same as callSid
      toolCallId: tool_call_id,
      toolName: name,
      arguments: args,
      phoneNumber: phoneNumber,
      stateManager: null, // SIP doesn't use state manager
      progressCallback: null // SIP doesn't support progress callbacks
    });

    // Format result for HTTP response
    const resultSubmitter = new HTTPResultSubmitter();
    const response = await resultSubmitter.submitResult(
      call_id,
      tool_call_id,
      executionResult
    );

    // Return HTTP response
    if (executionResult.success === false) {
      return res.status(200).json(response); // Return 200 even for errors (OpenAI expects 200)
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error(`❌ [SIP] Error handling tool execution:`, error);
    
    // Return error in expected format
    const call_id = req.body?.call_id || req.body?.item?.call_id || 'unknown';
    const tool_call_id = req.body?.tool_call_id || req.body?.item?.call_id || 'unknown';
    
    return res.status(200).json({
      success: false,
      error: error.message || 'Internal server error',
      result: {
        success: false,
        error: error.message || 'Internal server error',
        details: error.toString()
      },
      tool_call_id: tool_call_id,
      call_id: call_id
    });
  }
};

/**
 * Handle Twilio webhook for SIP connector calls
 * Returns minimal TwiML to keep call alive while trunk routes to OpenAI
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export const handleSipCallHandler = async (req, res) => {
  try {
    const { CallSid, From, To, CallStatus, Direction } = req.body;
    const timestamp = new Date().toISOString();
    
    // ENHANCED DIAGNOSTIC LOGGING
    console.log(`📞 [SIP] ========== CALL HANDLER WEBHOOK ==========`);
    console.log(`📞 [SIP] Timestamp: ${timestamp}`);
    console.log(`📞 [SIP] CallSid: ${CallSid}`);
    console.log(`📞 [SIP] From: ${From}, To: ${To}`);
    console.log(`📞 [SIP] Status: ${CallStatus}, Direction: ${Direction}`);
    console.log(`📞 [SIP] Full request body:`, JSON.stringify(req.body, null, 2));
    console.log(`📞 [SIP] Request headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`📞 [SIP] Request IP: ${req.ip}`);
    console.log(`📞 [SIP] Request method: ${req.method}`);
    console.log(`📞 [SIP] Request path: ${req.path}`);
    
    // Check if this is coming from SIP Trunk
    const sipTrunkSid = req.body.SipTrunkSid || req.headers['x-twilio-sip-trunk-sid'] || req.headers['x-sip-trunk-sid'];
    const sipTrunkName = req.body.SipTrunkName || req.headers['x-twilio-sip-trunk-name'];
    console.log(`📞 [SIP] SIP Trunk SID: ${sipTrunkSid || 'NOT DETECTED'}`);
    console.log(`📞 [SIP] SIP Trunk Name: ${sipTrunkName || 'NOT DETECTED'}`);
    
    // Check for any SIP-related headers
    const sipHeaders = Object.keys(req.headers).filter(key => 
      key.toLowerCase().includes('sip') || 
      key.toLowerCase().includes('twilio')
    );
    if (sipHeaders.length > 0) {
      console.log(`📞 [SIP] SIP-related headers:`, sipHeaders.map(h => `${h}: ${req.headers[h]}`).join(', '));
    }
    
    console.log(`📞 [SIP] =========================================`);
    
    // For SIP connector, we return TwiML with <Sip> verb to route call to OpenAI
    // Get OpenAI SIP endpoint from service
    const sipEndpoint = sipService.getSipEndpoint();
    
    if (!sipEndpoint) {
      console.error(`❌ [SIP] OpenAI SIP endpoint not configured - falling back to minimal TwiML`);
      // Fallback to minimal TwiML if endpoint not configured
      const twiml = generateMinimalTwiML();
      res.type('text/xml');
      res.send(twiml);
      return;
    }
    
    console.log(`📞 [SIP] Routing call to OpenAI SIP endpoint: ${sipEndpoint}`);
    
    // Return TwiML with <Dial><Sip> to route call to OpenAI's SIP endpoint
    // The <Dial><Sip> verb routes the call to OpenAI, which will then send call.accept webhook
    // Note: <Sip> must be wrapped in <Dial> for proper routing
    const twiml = generateSipRoutingTwiML(sipEndpoint);
    
    res.type('text/xml');
    res.send(twiml);
    
    console.log(`✅ [SIP] Call handler responded with SIP routing TwiML for CallSid: ${CallSid}`);
    console.log(`✅ [SIP] Call routed to OpenAI SIP endpoint: ${sipEndpoint}`);
    console.log(`✅ [SIP] Waiting for OpenAI call.accept webhook...`);
  } catch (error) {
    console.error(`❌ [SIP] Error handling SIP call handler:`, error);
    console.error(`❌ [SIP] Error stack:`, error.stack);
    const twiml = generateMinimalTwiML();
    res.type('text/xml');
    res.send(twiml);
  }
};

/**
 * GET /api/sip/agent-call-handler?originalCallSid=...
 * Twilio requests this URL when the outbound call to the agent connects.
 * Returns TwiML: Say handover summary then Dial agent into same conference as caller.
 */
export const handleAgentCallHandler = async (req, res) => {
  try {
    const originalCallSid = req.query.originalCallSid;
    if (!originalCallSid) {
      console.error(`❌ [SIP] agent-call-handler: missing originalCallSid`);
      res.type('text/xml');
      res.send('<Response><Say>Transfer configuration error. Please try again.</Say><Hangup/></Response>');
      return;
    }
    const record = await HandoverRecord.findOne({ callSid: originalCallSid }).sort({ createdAt: -1 }).lean();
    if (!record || !record.conferenceName) {
      console.error(`❌ [SIP] agent-call-handler: no HandoverRecord or conferenceName for ${originalCallSid}`);
      res.type('text/xml');
      res.send('<Response><Say>Transfer setup not found. Please try again.</Say><Hangup/></Response>');
      return;
    }
    const sayText = escapeTwiMLText(record.handoverSummary || 'Incoming transfer from Robert.');
    const twiml = `<Response><Say>${sayText}</Say><Dial><Conference>${escapeTwiMLText(record.conferenceName)}</Conference></Dial></Response>`;
    res.type('text/xml');
    res.send(twiml);
    console.log(`✅ [SIP] agent-call-handler: TwiML returned for originalCallSid=${originalCallSid}, conference=${record.conferenceName}`);
  } catch (error) {
    console.error(`❌ [SIP] agent-call-handler:`, error);
    res.type('text/xml');
    res.send('<Response><Say>An error occurred. Please try again.</Say><Hangup/></Response>');
  }
};

