import twilioClient from '../utils/twilioClient.js';
import callBridgeService from '../services/twilioCallBridgeService.js';
import handoverSummaryService from '../services/handoverSummaryService.js';
import HandoverRecord from '../database/models/HandoverRecord.js';
import { conversations } from '../shared/state.js';

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
    const { target, reason = 'user_request' } = parameters;
    const { callSid, phoneNumber } = callContext;

    const targetNumber = '+918717914659';
    console.log(`📞 [${callSid}] Transfer to agent: ${targetNumber}`);

    if (!callSid) {
      throw new Error('Call SID is required for transfer. This tool must be called during an active call.');
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

      const agentCallResult = await callBridgeService.initiateAgentCall(callSid, targetNumber);
      if (!agentCallResult.success) {
        throw new Error(`Failed to initiate agent call: ${agentCallResult.error}`);
      }

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
    } catch (error) {
      console.error(`❌ [${callSid}] Call transfer error:`, error);
      throw new Error(`Call transfer failed: ${error.message}`);
    }
  }
}

export default new TransferCallTool();
