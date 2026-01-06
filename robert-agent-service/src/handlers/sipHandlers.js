/**
 * SIP Handlers
 * Handle OpenAI Realtime SIP webhook events (call.accept, etc.)
 */

import { conversations } from "../shared/state.js";
import configManager from "../agent/configManager.js";
import toolExecutor from "../tools/index.js";
import sipService from "../services/sipService.js";
import toolExecutionService from "../services/toolExecutionService.js";
import { HTTPResultSubmitter } from "../services/toolResultSubmitter.js";
import CallRecord from "../database/models/CallRecord.js";

/**
 * Handle OpenAI Realtime SIP call.accept webhook
 * This is called when OpenAI receives an incoming SIP call
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export const handleCallAccept = async (req, res) => {
  try {
    const { call_id, from, to } = req.body;

    if (!call_id) {
      return res.status(400).json({ error: 'Missing call_id' });
    }

    console.log(`📞 [SIP] Call accept webhook received - call_id: ${call_id}, from: ${from}, to: ${to}`);

    // Initialize conversation state
    const sessionManagementService = (await import('../services/sessionManagementService.js')).default;
    if (!conversations[call_id]) {
      sessionManagementService.initializeSession(call_id, {
        language: 'en-US',
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
    sipService.trackStatus(call_id, 'accepted', { from, to });

    // Get configuration
    const phoneNumber = from || to;
    const currentLanguage = conversations[call_id]?.language || 'en';
    const config = configManager.getConfigForNumber(phoneNumber, currentLanguage);
    const tools = toolExecutor.getToolDefinitions();

    // Configure SIP session
    const sipConfig = sipService.configureSipSession({
      voice: config.voice.id,
      instructions: config.instructions,
      tools: tools,
      vadThreshold: config.vadThreshold / 1000, // Convert ms to seconds
      startPadding: config.startPadding,
      endPadding: config.endPadding,
      temperature: config.temperature,
      sessionParams: {
        tool_choice: 'auto'
      }
    });

    // Validate configuration
    const validation = sipService.validateSipConfig(sipConfig);
    if (!validation.valid) {
      console.error(`❌ [SIP] Invalid SIP configuration:`, validation.errors);
      return res.status(400).json({ error: 'Invalid SIP configuration', details: validation.errors });
    }

    // Create CallRecord
    try {
      await CallRecord.findOneAndUpdate(
        { callSid: call_id },
        {
          callSid: call_id,
          callType: 'SIP',
          callStatus: 'in-progress',
          from: from,
          to: to,
          startTime: new Date()
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error(`❌ [SIP] Error creating CallRecord:`, err);
    }

    // Return configuration to OpenAI
    // OpenAI will use this to configure the SIP session
    const response = {
      session: sipConfig.session,
      voice: sipConfig.voice,
      instructions: sipConfig.instructions,
      tools: sipConfig.tools
    };

    // Include tool execution webhook URL if configured
    // Note: OpenAI may require this to be configured in their dashboard instead
    if (sipConfig.tool_execution_webhook_url) {
      response.tool_execution_webhook_url = sipConfig.tool_execution_webhook_url;
    }

    res.json(response);

    console.log(`✅ [SIP] Call accept configured for call_id: ${call_id}`);
  } catch (error) {
    console.error(`❌ [SIP] Error handling call accept:`, error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * Handle OpenAI Realtime SIP call status updates
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export const handleCallStatus = async (req, res) => {
  try {
    const { call_id, status } = req.body;

    if (!call_id) {
      return res.status(400).json({ error: 'Missing call_id' });
    }

    console.log(`📞 [SIP] Call status update - call_id: ${call_id}, status: ${status}`);

    // Track status change
    sipService.trackStatus(call_id, status);

    // Update CallRecord
    try {
      await CallRecord.findOneAndUpdate(
        { callSid: call_id },
        { callStatus: status },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error(`❌ [SIP] Error updating CallRecord:`, err);
    }

    // Cleanup on terminal states using session management service
    const sessionManagementService = (await import('../services/sessionManagementService.js')).default;
    if (['completed', 'failed', 'busy', 'no-answer'].includes(status)) {
      // Clean up tool execution state
      toolExecutionService.cleanup(call_id);
      
      sessionManagementService.deleteSession(call_id);
      sipService.deleteSession(call_id);
    }

    res.sendStatus(200);
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
    const { CallSid, From, To } = req.body;
    
    console.log(`📞 [SIP] Call handler webhook received - CallSid: ${CallSid}, From: ${From}, To: ${To}`);
    
    // For SIP connector, routing happens at the Twilio SIP Trunk level
    // We return minimal TwiML to keep the call alive
    // The trunk configuration (in Twilio console) routes to OpenAI SIP endpoint
    // OpenAI will then send call.accept webhook to /api/sip/call-accept
    
    // Return minimal TwiML - just keep call alive
    // The actual routing to OpenAI happens at the trunk level
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="3600"/>
</Response>`;
    
    res.type('text/xml');
    res.send(twiml);
    
    console.log(`✅ [SIP] Call handler responded with minimal TwiML for CallSid: ${CallSid}`);
  } catch (error) {
    console.error(`❌ [SIP] Error handling SIP call handler:`, error);
    // Return minimal TwiML even on error to prevent call failure
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="3600"/>
</Response>`;
    res.type('text/xml');
    res.send(twiml);
  }
};

