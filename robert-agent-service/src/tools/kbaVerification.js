import kbaService from '../services/kbaService.js';
import otpService from '../services/otpService.js';
import { conversations } from '../shared/state.js';

class KBAVerificationTool {
  /**
   * Execute KBA verification
   * @param {object} parameters - Tool parameters
   * @param {object} callContext - Call context
   * @returns {Promise<object>} Verification result
   */
  async execute(parameters, callContext = {}) {
    const { email, postcode, bookingReference, otpCode } = parameters;
    const { callSid, phoneNumber } = callContext;

    if (!callSid) {
      throw new Error('Call SID is required for KBA verification. This tool must be called during an active call.');
    }

    try {
      // If OTP code is provided, verify OTP
      if (otpCode) {
        console.log(`🔐 [${callSid}] Verifying OTP code for KBA`);
        const otpResult = await kbaService.verifyKBAWithOTP(callSid, otpCode);
        
        if (!otpResult.success) {
          return {
            success: false,
            verified: false,
            requiresOTP: false,
            error: otpResult.error,
            message: otpResult.error
          };
        }

        return {
          success: true,
          verified: true,
          requiresOTP: false,
          method: 'email_postcode_bookingref_otp',
          message: 'Identity verified successfully with OTP.'
        };
      }

      // Otherwise, perform email + postcode + booking ref verification
      if (!email || !postcode) {
        return {
          success: false,
          verified: false,
          requiresOTP: false,
          error: 'Email and postcode are required for KBA verification.',
          message: 'Please provide your email address and postcode to verify your identity.'
        };
      }

      console.log(`🔐 [${callSid}] Verifying KBA: email=${email}, postcode=${postcode}, bookingRef=${bookingReference || 'none'}`);

      const kbaResult = await kbaService.verifyKBA(
        callSid,
        phoneNumber || 'unknown',
        email,
        postcode,
        bookingReference
      );

      if (!kbaResult.success) {
        return {
          success: false,
          verified: false,
          requiresOTP: false,
          error: kbaResult.error,
          message: kbaResult.error || 'Unable to verify your identity. Please check your details and try again.'
        };
      }

      // If OTP is required, generate and send it
      if (kbaResult.requiresOTP && kbaResult.mobileNumber) {
        console.log(`📱 [${callSid}] OTP required, generating and sending to ${kbaResult.mobileNumber}`);
        const otpResult = await otpService.generateAndSendOTP(callSid, kbaResult.mobileNumber);
        
        if (!otpResult.success) {
          return {
            success: true,
            verified: true, // Email + postcode verified
            requiresOTP: false, // OTP send failed, but basic KBA passed
            method: 'email_postcode_bookingref',
            message: 'Identity verified. However, we were unable to send an OTP to your mobile. You can proceed with email and postcode verification.',
            error: otpResult.error
          };
        }

        return {
          success: true,
          verified: true,
          requiresOTP: true,
          method: 'email_postcode_bookingref',
          message: 'Identity verified. A verification code has been sent to your registered mobile number. Please provide the code to complete verification.',
          mobileNumber: kbaResult.mobileNumber // For logging only
        };
      }

      // Basic KBA verified (email + postcode + booking ref)
      return {
        success: true,
        verified: true,
        requiresOTP: false,
        method: 'email_postcode_bookingref',
        message: 'Identity verified successfully.',
        bookingData: kbaResult.bookingData
      };
    } catch (error) {
      console.error(`❌ [${callSid}] KBA verification error:`, error);
      return {
        success: false,
        verified: false,
        requiresOTP: false,
        error: error.message,
        message: 'An error occurred during verification. Please try again or request a human transfer.'
      };
    }
  }
}

export default new KBAVerificationTool();

