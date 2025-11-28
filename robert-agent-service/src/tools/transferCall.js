import twilioClient from '../utils/twilioClient.js';

class TransferCallTool {
  async execute(parameters, callContext = {}) {
    const { target, reason = '' } = parameters;

    if (!target) {
      throw new Error('Target phone number is required for call transfer');
    }

    if (!callContext.callSid) {
      throw new Error('Call SID is required for transfer. This tool must be called during an active call.');
    }

    try {
      console.log(`📞 [${callContext.callSid}] Transferring call to ${target}${reason ? ` (reason: ${reason})` : ''}`);

      // Update the call to transfer to target number
      const call = await twilioClient.calls(callContext.callSid).update({
        twiml: `<Response>
          <Say>Transferring you to a human agent. Please hold.</Say>
          <Dial>${target}</Dial>
        </Response>`
      });

      // Log the transfer
      console.log(`✅ [${callContext.callSid}] Call transfer initiated to ${target}`);

      return {
        success: true,
        transferInitiated: true,
        callSid: callContext.callSid,
        targetNumber: target,
        reason: reason,
        transferredAt: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ [${callContext.callSid}] Call transfer error:`, error);
      throw new Error(`Call transfer failed: ${error.message}`);
    }
  }
}

export default new TransferCallTool();

