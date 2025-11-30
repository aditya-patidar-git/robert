/**
 * SIP Handlers
 * Handle OpenAI Realtime SIP webhook events (call.accept, etc.)
 */

import { conversations } from "../shared/state.js";
import configManager from "../agent/configManager.js";
import toolExecutor from "../tools/index.js";
import sipService from "../services/sipService.js";
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
    if (!conversations[call_id]) {
      conversations[call_id] = {
        transcript: [],
        language: 'en-US',
        from: from,
        to: to,
        startTime: Date.now(),
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
      };
    }

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
    res.json({
      session: sipConfig.session,
      voice: sipConfig.voice,
      instructions: sipConfig.instructions,
      tools: sipConfig.tools
    });

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

    // Cleanup on terminal states
    if (['completed', 'failed', 'busy', 'no-answer'].includes(status)) {
      if (conversations[call_id]) {
        delete conversations[call_id];
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error(`❌ [SIP] Error handling call status:`, error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

