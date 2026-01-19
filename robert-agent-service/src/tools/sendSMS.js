import twilioClient from '../utils/twilioClient.js';

/**
 * Standalone SMS Tool
 * Send SMS messages independently (for complaints, summaries, confirmations, etc.)
 * This is separate from booking_step_send_sms which is workflow-only
 */
class SendSMSTool {
  /**
   * Validate UK mobile number format
   * @param {string} mobileNumber - Mobile number to validate
   * @returns {boolean} True if valid UK mobile format
   */
  validateMobileNumber(mobileNumber) {
    if (!mobileNumber) return false;
    
    // Remove spaces, dashes, and leading +44
    const cleaned = mobileNumber.replace(/[\s\-]/g, '').replace(/^\+44/, '0');
    
    // UK mobile: 11 digits starting with 07
    const ukMobileRegex = /^07\d{9}$/;
    return ukMobileRegex.test(cleaned);
  }

  /**
   * Format mobile number for Twilio (E.164 format)
   * @param {string} mobileNumber - Mobile number to format
   * @returns {string} Formatted number in E.164 format
   */
  formatMobileNumber(mobileNumber) {
    if (!mobileNumber) return null;
    
    // Remove spaces, dashes
    let cleaned = mobileNumber.replace(/[\s\-]/g, '');
    
    // If starts with 0, replace with +44
    if (cleaned.startsWith('0')) {
      cleaned = '+44' + cleaned.substring(1);
    }
    // If doesn't start with +, add +44
    else if (!cleaned.startsWith('+')) {
      cleaned = '+44' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Execute SMS tool - send SMS via Twilio
   * @param {Object} parameters - SMS parameters
   * @param {string} parameters.to - Recipient mobile number (UK format: 11 digits starting with 07)
   * @param {string} parameters.message - SMS message body (required)
   * @param {Object} callContext - Call context
   * @returns {Promise<{success: boolean, messageSid?: string, to?: string, message?: string, sentAt?: string, error?: string}>}
   */
  async execute(parameters, callContext = {}) {
    try {
      const { to, message } = parameters;
      const callSid = callContext.callSid || 'unknown';

      // Validate recipient
      if (!to) {
        return {
          success: false,
          error: 'Recipient mobile number (to) is required'
        };
      }

      // Validate message
      if (!message || message.trim().length === 0) {
        return {
          success: false,
          error: 'SMS message body is required'
        };
      }

      // Validate mobile number format
      if (!this.validateMobileNumber(to)) {
        return {
          success: false,
          error: `Invalid UK mobile number format: ${to}. Expected format: 11 digits starting with 07 (e.g., 07123456789)`
        };
      }

      // Format mobile number for Twilio (E.164 format)
      const formattedNumber = this.formatMobileNumber(to);

      // Check message length (SMS limit is 1600 characters for Twilio, but best practice is 160)
      if (message.length > 1600) {
        return {
          success: false,
          error: `SMS message too long: ${message.length} characters. Maximum length is 1600 characters.`
        };
      }

      // Send SMS via Twilio
      try {
        const result = await twilioClient.messages.create({
          body: message,
          to: formattedNumber,
          from: process.env.TWILIO_NUMBER
        });

        console.log(`✅ [${callSid}] SMS sent successfully to ${formattedNumber} (SID: ${result.sid})`);

        return {
          success: true,
          messageSid: result.sid,
          to: formattedNumber,
          message: message,
          sentAt: new Date().toISOString(),
          status: result.status
        };
      } catch (twilioError) {
        console.error(`❌ [${callSid}] Error sending SMS via Twilio:`, twilioError);
        
        // Provide user-friendly error messages
        let errorMessage = 'Failed to send SMS';
        if (twilioError.code === 21211) {
          errorMessage = 'Invalid mobile number format';
        } else if (twilioError.code === 21614) {
          errorMessage = 'Invalid sender number';
        } else if (twilioError.message) {
          errorMessage = twilioError.message;
        }

        return {
          success: false,
          error: errorMessage,
          twilioError: twilioError.code || 'unknown'
        };
      }
    } catch (error) {
      console.error('❌ Error in send_sms tool:', error);
      return {
        success: false,
        error: error.message || 'Unknown error sending SMS'
      };
    }
  }
}

export default new SendSMSTool();
