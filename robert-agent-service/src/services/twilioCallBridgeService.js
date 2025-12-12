import twilioClient from '../utils/twilioClient.js';
import configManager from '../agent/configManager.js';
import dotenv from 'dotenv';

dotenv.config();

class TwilioCallBridgeService {
  constructor() {
    this.defaultTargetNumber = '+442036918807'; // From documentation
  }

  /**
   * Initiate outbound call to human agent
   * @param {string} callSid - Original call SID
   * @param {string} targetNumber - Target phone number (default: +442036918807)
   * @returns {Promise<{success: boolean, agentCallSid?: string, error?: string}>}
   */
  async initiateAgentCall(callSid, targetNumber = null) {
    try {
      const target = targetNumber || this.defaultTargetNumber;
      const baseUrl = process.env.TUNNEL_DOMAIN ? `https://${process.env.TUNNEL_DOMAIN}` : process.env.BASE_URL || 'http://localhost:3002';

      // Get outboundCallerId from telephony config
      const telephonyConfig = configManager.getTelephonyConfig();
      const callerId = telephonyConfig?.outboundCallerId;

      if (!callerId) {
        const errorMsg = 'outboundCallerId not configured. Please set it in Telephony Routing settings.';
        console.error(`❌ [${callSid}] ${errorMsg}`);
        return {
          success: false,
          error: errorMsg
        };
      }

      console.log(`📞 [${callSid}] Initiating outbound call to agent: ${target} (from: ${callerId})`);

      // Create outbound call to agent using outboundCallerId from database config
      const agentCall = await twilioClient.calls.create({
        to: target,
        from: callerId,
        url: `${baseUrl}/api/sip/agent-call-handler?originalCallSid=${callSid}`,
        statusCallback: `${baseUrl}/api/outbound/call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST'
      });

      console.log(`✅ [${callSid}] Agent call initiated: ${agentCall.sid} (using caller ID: ${callerId})`);

      return {
        success: true,
        agentCallSid: agentCall.sid
      };
    } catch (error) {
      console.error(`❌ [${callSid}] Error initiating agent call:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send DTMF tones to a call (for IVR navigation)
   * @param {string} callSid - Call SID
   * @param {string} digits - DTMF digits to send (e.g., '1' for option 1)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async sendDTMF(callSid, digits) {
    try {
      console.log(`📞 [${callSid}] Sending DTMF: ${digits}`);

      await twilioClient.calls(callSid).update({
        twiml: `<Response>
          <Play digits="${digits}"/>
        </Response>`
      });

      console.log(`✅ [${callSid}] DTMF sent: ${digits}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ [${callSid}] Error sending DTMF:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Bridge two calls together (three-way call)
   * @param {string} originalCallSid - Original caller's call SID
   * @param {string} agentCallSid - Agent's call SID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async bridgeCalls(originalCallSid, agentCallSid) {
    try {
      console.log(`📞 [${originalCallSid}] Bridging calls: ${originalCallSid} <-> ${agentCallSid}`);

      // Update original call to dial the agent call
      await twilioClient.calls(originalCallSid).update({
        twiml: `<Response>
          <Dial>
            <Sip>sip:${agentCallSid}@${process.env.TWILIO_SIP_DOMAIN || 'default'}</Sip>
          </Dial>
        </Response>`
      });

      // Alternative: Use conference room for better control
      // This approach uses Twilio's conference feature
      const conferenceName = `conf_${originalCallSid}_${Date.now()}`;
      
      // Put original caller in conference
      await twilioClient.calls(originalCallSid).update({
        twiml: `<Response>
          <Dial>
            <Conference>${conferenceName}</Conference>
          </Dial>
        </Response>`
      });

      // Put agent in same conference
      await twilioClient.calls(agentCallSid).update({
        twiml: `<Response>
          <Dial>
            <Conference>${conferenceName}</Conference>
          </Dial>
        </Response>`
      });

      console.log(`✅ [${originalCallSid}] Calls bridged in conference: ${conferenceName}`);
      return {
        success: true,
        conferenceName
      };
    } catch (error) {
      console.error(`❌ [${originalCallSid}] Error bridging calls:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Place call on hold
   * @param {string} callSid - Call SID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async holdCall(callSid) {
    try {
      console.log(`📞 [${callSid}] Placing call on hold`);

      await twilioClient.calls(callSid).update({
        twiml: `<Response>
          <Say>Please hold while I connect you to a colleague.</Say>
          <Pause length="60"/>
        </Response>`
      });

      return { success: true };
    } catch (error) {
      console.error(`❌ [${callSid}] Error placing call on hold:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Resume call from hold
   * @param {string} callSid - Call SID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async resumeCall(callSid) {
    try {
      console.log(`📞 [${callSid}] Resuming call from hold`);
      // Call will resume when bridged or new TwiML is sent
      return { success: true };
    } catch (error) {
      console.error(`❌ [${callSid}] Error resuming call:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new TwilioCallBridgeService();

