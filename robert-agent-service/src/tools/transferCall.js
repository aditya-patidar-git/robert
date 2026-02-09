import twilioClient from '../utils/twilioClient.js';
import callBridgeService from '../services/twilioCallBridgeService.js';
import handoverSummaryService from '../services/handoverSummaryService.js';
import HandoverRecord from '../database/models/HandoverRecord.js';
import { conversations } from '../shared/state.js';
import configManager from '../agent/configManager.js';

const ALL_OCCUPIED_MESSAGE = 'All our agents are occupied at the moment. Can we try again after a while, or would you prefer we contact you?';

function escapeTwiMLText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

class TransferCallTool {
  async execute(parameters, callContext = {}) {
    const { reason = 'user_request' } = parameters;
    const { callSid, phoneNumber } = callContext;

    if (!callSid) {
      throw new Error('Call SID is required for transfer. This tool must be called during an active call.');
    }

    const telephonyConfig = configManager.getTelephonyConfig();
    const transferNumbers = (telephonyConfig?.transferNumbers || [])
      .filter(t => t.isActive !== false && t.number)
      .map(t => t.number);

    if (transferNumbers.length === 0) {
      console.warn(`⚠️ [${callSid}] No active transfer numbers configured`);
      return {
        success: false,
        allTransferNumbersFailed: true,
        messageForCaller: ALL_OCCUPIED_MESSAGE
      };
    }

    for (const targetNumber of transferNumbers) {
      console.log(`📞 [${callSid}] Trying transfer to: ${targetNumber}`);
      const agentCallResult = await callBridgeService.initiateAgentCall(callSid, targetNumber);
      if (!agentCallResult.success) {
        console.warn(`⚠️ [${callSid}] Transfer to ${targetNumber} failed: ${agentCallResult.error}`);
        continue;
      }

      try {
        const handoverSummary = await handoverSummaryService.generateHandoverSummary(callSid, reason);
        const spokenAnnouncement = await handoverSummaryService.generateSpokenAnnouncement(callSid, reason);
        const conferenceName = `conf_${callSid}_${Date.now()}`;

        const handoverRecord = new HandoverRecord({
          callSid,
          originalCallerId: phoneNumber || 'unknown',
          targetNumber,
          handoverSummary: spokenAnnouncement,
          conferenceName,
          kbaMethod: conversations[callSid]?.kba?.method || null,
          actionsTaken: conversations[callSid]?.transcript?.slice(-5).map(t => t.text).join(' ') || '',
          desiredOutcome: handoverSummaryService.extractDesiredOutcome(conversations[callSid]?.transcript || []),
          handoverStatus: 'initiated'
        });
        await handoverRecord.save();

        const sayText = escapeTwiMLText(spokenAnnouncement || 'Connecting you to a colleague. One moment.');
        await twilioClient.calls(callSid).update({
          twiml: `<Response><Say>${sayText}</Say><Dial><Conference>${escapeTwiMLText(conferenceName)}</Conference></Dial></Response>`
        });

        await HandoverRecord.updateOne(
          { _id: handoverRecord._id },
          { $set: { agentCallSid: agentCallResult.agentCallSid } }
        );

        console.log(`✅ [${callSid}] Warm transfer initiated: caller and agent will join conference ${conferenceName}`);
        return {
          success: true,
          transferInitiated: true,
          callSid,
          targetNumber,
          reason,
          handoverSummary: spokenAnnouncement,
          agentCallSid: agentCallResult.agentCallSid,
          conferenceName,
          transferredAt: new Date().toISOString()
        };
      } catch (err) {
        console.error(`❌ [${callSid}] Error setting up handover after agent call:`, err);
        continue;
      }
    }

    console.warn(`⚠️ [${callSid}] All transfer numbers failed or unavailable`);
    return {
      success: false,
      allTransferNumbersFailed: true,
      messageForCaller: ALL_OCCUPIED_MESSAGE
    };
  }
}

export default new TransferCallTool();
