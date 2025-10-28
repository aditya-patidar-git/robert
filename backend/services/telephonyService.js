import twilio from 'twilio';

class TelephonyService {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }

  async transferCall(callSid, targetNumber, reason = '') {
    try {
      console.log(`📞 Transferring call ${callSid} to ${targetNumber}`);
      
      // Update the call to transfer to target number
      const call = await this.client.calls(callSid).update({
        twiml: `<Response>
          <Say>Transferring you to a human agent. Please hold.</Say>
          <Dial>${targetNumber}</Dial>
        </Response>`
      });

      // Log the transfer
      await this.logTransfer(callSid, targetNumber, reason);

      return {
        success: true,
        transferInitiated: true,
        callSid: callSid,
        targetNumber: targetNumber,
        reason: reason
      };

    } catch (error) {
      console.error('Call transfer error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async logTransfer(callSid, targetNumber, reason) {
    try {
      // This would typically save to a database
      console.log(`📝 Transfer logged: ${callSid} -> ${targetNumber} (${reason})`);
    } catch (error) {
      console.error('Transfer logging error:', error);
    }
  }

  async getCallStatus(callSid) {
    try {
      const call = await this.client.calls(callSid).fetch();
      return {
        sid: call.sid,
        status: call.status,
        from: call.from,
        to: call.to,
        startTime: call.startTime,
        endTime: call.endTime,
        duration: call.duration
      };
    } catch (error) {
      console.error('Get call status error:', error);
      throw error;
    }
  }

  async hangupCall(callSid, reason = '') {
    try {
      console.log(`📞 Hanging up call ${callSid}: ${reason}`);
      
      const call = await this.client.calls(callSid).update({
        status: 'completed'
      });

      return {
        success: true,
        callSid: callSid,
        reason: reason
      };

    } catch (error) {
      console.error('Hangup call error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async recordCall(callSid, recordingUrl) {
    try {
      console.log(`🎙️ Recording call ${callSid}: ${recordingUrl}`);
      
      // This would typically save recording metadata to database
      return {
        success: true,
        callSid: callSid,
        recordingUrl: recordingUrl
      };

    } catch (error) {
      console.error('Record call error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getActiveCalls() {
    try {
      console.log('Backend - Getting active calls...');
      // For demo purposes, return sample active calls data
      // In a real implementation, this would query the database or Twilio API
      const sampleCalls = [
        {
          callSid: 'CA1234567890abcdef1234567890abcdef',
          callStatus: 'in-progress',
          from: '+44123456789',
          to: '+44198765432',
          duration: 120,
          startTime: new Date(Date.now() - 120000).toISOString()
        },
        {
          callSid: 'CA0987654321fedcba0987654321fedcba',
          callStatus: 'in-progress',
          from: '+44111111111',
          to: '+44222222222',
          duration: 45,
          startTime: new Date(Date.now() - 45000).toISOString()
        }
      ];

      console.log('Backend - Sample calls:', sampleCalls);
      return sampleCalls;
    } catch (error) {
      console.error('Get active calls error:', error);
      return [];
    }
  }
}

export default new TelephonyService();
