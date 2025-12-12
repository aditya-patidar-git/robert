import twilioClient from '../utils/twilioClient.js';
import callBridgeService from '../services/twilioCallBridgeService.js';
import handoverSummaryService from '../services/handoverSummaryService.js';
import HandoverRecord from '../database/models/HandoverRecord.js';
import { conversations } from '../shared/state.js';

class TransferCallTool {
  async execute(parameters, callContext = {}) {
    const { target, reason = 'user_request' } = parameters;
    const { callSid, phoneNumber } = callContext;

    // Use hardcoded agent number for all transfers
    const targetNumber = '+918717914659';
    console.log(`📞 [${callSid}] Using hardcoded agent number: ${targetNumber}`);

    if (!callSid) {
      throw new Error('Call SID is required for transfer. This tool must be called during an active call.');
    }

    try {
      console.log(`📞 [${callSid}] Initiating warm handover to ${targetNumber}${reason ? ` (reason: ${reason})` : ''}`);

      // Step 1: Tell caller we're connecting them
      console.log(`📞 [${callSid}] Step 1: Announcing transfer to caller`);
      await twilioClient.calls(callSid).update({
        twiml: `<Response>
          <Say>I can connect you to a colleague now. I'll introduce your case so you don't have to repeat everything. One moment.</Say>
        </Response>`
      });

      // Step 2: Generate handover summary
      console.log(`📞 [${callSid}] Step 2: Generating handover summary`);
      const handoverSummary = await handoverSummaryService.generateHandoverSummary(callSid, reason);
      const spokenAnnouncement = await handoverSummaryService.generateSpokenAnnouncement(callSid, reason);

      // Step 3: Place caller on hold
      console.log(`📞 [${callSid}] Step 3: Placing caller on hold`);
      await callBridgeService.holdCall(callSid);

      // Step 4: Initiate outbound call to agent
      console.log(`📞 [${callSid}] Step 4: Initiating call to agent`);
      const agentCallResult = await callBridgeService.initiateAgentCall(callSid, targetNumber);

      if (!agentCallResult.success) {
        throw new Error(`Failed to initiate agent call: ${agentCallResult.error}`);
      }

      // Step 5: Send DTMF '1' if IVR requires it (wait a bit for IVR to answer)
      // Note: This will be handled in the agent call handler webhook
      console.log(`📞 [${callSid}] Step 5: Agent call initiated, will send DTMF if needed`);

      // Step 6: When agent answers, make handover announcement
      // This will be handled via webhook when agent call status changes to 'answered'
      // For now, we'll store the handover summary for the webhook to use

      // Step 7: Bridge the calls
      console.log(`📞 [${callSid}] Step 7: Bridging calls`);
      const bridgeResult = await callBridgeService.bridgeCalls(callSid, agentCallResult.agentCallSid);

      if (!bridgeResult.success) {
        // Fallback: Simple transfer if bridging fails
        console.log(`⚠️ [${callSid}] Bridging failed, falling back to simple transfer`);
        await twilioClient.calls(callSid).update({
          twiml: `<Response>
            <Say>Transferring you to a human agent. Please hold.</Say>
            <Dial>${targetNumber}</Dial>
          </Response>`
        });
      }

      // Step 8: Store handover record
      const handoverRecord = new HandoverRecord({
        callSid,
        originalCallerId: phoneNumber || 'unknown',
        targetNumber,
        handoverSummary: spokenAnnouncement,
        kbaMethod: conversations[callSid]?.kba?.method || null,
        actionsTaken: conversations[callSid]?.transcript?.slice(-5).map(t => t.text).join(' ') || '',
        desiredOutcome: handoverSummaryService.extractDesiredOutcome(conversations[callSid]?.transcript || []),
        handoverStatus: 'initiated',
        agentCallSid: agentCallResult.agentCallSid
      });

      await handoverRecord.save();

      // Log the transfer
      console.log(`✅ [${callSid}] Warm handover initiated to ${targetNumber}`);

      return {
        success: true,
        transferInitiated: true,
        callSid: callSid,
        targetNumber: targetNumber,
        reason: reason,
        handoverSummary: spokenAnnouncement,
        agentCallSid: agentCallResult.agentCallSid,
        bridged: bridgeResult.success,
        transferredAt: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ [${callSid}] Call transfer error:`, error);
      
      // Fallback: Simple transfer on error
      try {
        await twilioClient.calls(callSid).update({
          twiml: `<Response>
            <Say>I'm transferring you to a colleague now. Please hold.</Say>
            <Dial>${targetNumber}</Dial>
          </Response>`
        });
        console.log(`✅ [${callSid}] Fallback transfer completed`);
      } catch (fallbackError) {
        console.error(`❌ [${callSid}] Fallback transfer also failed:`, fallbackError);
      }

      throw new Error(`Call transfer failed: ${error.message}`);
    }
  }
}

export default new TransferCallTool();

