import crypto from 'crypto';
import twilioClient from '../utils/twilioClient.js';
import { conversations } from '../shared/state.js';

class OTPService {
  constructor() {
    this.otpStore = new Map(); // callSid -> { code, expiresAt, attempts, sentAt }
    this.OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
    this.MAX_ATTEMPTS = 3;
    this.OTP_LENGTH = 6;
  }

  /**
   * Generate a 6-digit OTP code
   * @returns {string} 6-digit OTP code
   */
  generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Hash OTP code for storage (using SHA-256)
   * @param {string} code - Plain OTP code
   * @returns {string} Hashed OTP
   */
  hashOTP(code) {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  /**
   * Verify OTP code
   * @param {string} plainCode - Plain OTP code from user
   * @param {string} hashedCode - Stored hashed OTP
   * @returns {boolean} True if codes match
   */
  verifyOTP(plainCode, hashedCode) {
    const hashedInput = this.hashOTP(plainCode);
    return hashedInput === hashedCode;
  }

  /**
   * Generate and send OTP to mobile number
   * @param {string} callSid - Call SID
   * @param {string} mobileNumber - Mobile number to send OTP to
   * @returns {Promise<{success: boolean, otpCode?: string, error?: string}>}
   */
  async generateAndSendOTP(callSid, mobileNumber) {
    try {
      // Check if OTP already sent recently (rate limiting)
      const existing = this.otpStore.get(callSid);
      if (existing && existing.sentAt && (Date.now() - existing.sentAt) < 60000) {
        console.log(`⚠️ [${callSid}] OTP already sent recently. Rate limiting.`);
        return {
          success: false,
          error: 'OTP already sent. Please wait before requesting another.'
        };
      }

      // Generate OTP
      const otpCode = this.generateOTP();
      const hashedOTP = this.hashOTP(otpCode);
      const expiresAt = Date.now() + this.OTP_EXPIRY_MS;

      // Store OTP (hashed)
      this.otpStore.set(callSid, {
        code: hashedOTP,
        expiresAt,
        attempts: 0,
        sentAt: Date.now(),
        mobileNumber
      });

      // Send OTP via Twilio SMS
      try {
        await twilioClient.messages.create({
          body: `Your Universal Motorcycle Training verification code is: ${otpCode}. This code expires in 5 minutes.`,
          to: mobileNumber,
          from: process.env.TWILIO_NUMBER
        });

        console.log(`✅ [${callSid}] OTP sent to ${mobileNumber}`);
        
        return {
          success: true,
          otpCode: otpCode // Return for testing/logging (not for production)
        };
      } catch (smsError) {
        console.error(`❌ [${callSid}] Error sending OTP SMS:`, smsError);
        this.otpStore.delete(callSid);
        return {
          success: false,
          error: 'Failed to send OTP. Please try again or use email + postcode verification.'
        };
      }
    } catch (error) {
      console.error(`❌ [${callSid}] Error generating OTP:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify OTP code
   * @param {string} callSid - Call SID
   * @param {string} otpCode - OTP code from user
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async verifyOTPCode(callSid, otpCode) {
    try {
      const stored = this.otpStore.get(callSid);
      
      if (!stored) {
        return {
          success: false,
          error: 'No OTP found for this call. Please request a new OTP.'
        };
      }

      // Check expiration
      if (Date.now() > stored.expiresAt) {
        this.otpStore.delete(callSid);
        return {
          success: false,
          error: 'OTP has expired. Please request a new one.'
        };
      }

      // Check attempts
      if (stored.attempts >= this.MAX_ATTEMPTS) {
        this.otpStore.delete(callSid);
        return {
          success: false,
          error: 'Maximum verification attempts exceeded. Please request a new OTP.'
        };
      }

      // Verify code
      stored.attempts++;
      const isValid = this.verifyOTP(otpCode, stored.code);

      if (isValid) {
        // Mark as verified
        stored.verified = true;
        stored.verifiedAt = Date.now();
        console.log(`✅ [${callSid}] OTP verified successfully`);
        
        // Update conversation state
        if (conversations[callSid]) {
          if (!conversations[callSid].kba) {
            conversations[callSid].kba = {};
          }
          conversations[callSid].kba.otpVerified = true;
          conversations[callSid].kba.otpVerifiedAt = new Date();
        }

        return {
          success: true
        };
      } else {
        console.log(`❌ [${callSid}] OTP verification failed (attempt ${stored.attempts}/${this.MAX_ATTEMPTS})`);
        
        if (stored.attempts >= this.MAX_ATTEMPTS) {
          this.otpStore.delete(callSid);
          return {
            success: false,
            error: 'Incorrect OTP. Maximum attempts exceeded. Please request a new OTP.'
          };
        }

        return {
          success: false,
          error: `Incorrect OTP. ${this.MAX_ATTEMPTS - stored.attempts} attempts remaining.`
        };
      }
    } catch (error) {
      console.error(`❌ [${callSid}] Error verifying OTP:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clear OTP for a call (after successful verification or call end)
   * @param {string} callSid - Call SID
   */
  clearOTP(callSid) {
    this.otpStore.delete(callSid);
    console.log(`🧹 [${callSid}] OTP data cleared`);
  }

  /**
   * Get OTP status for a call
   * @param {string} callSid - Call SID
   * @returns {object|null} OTP status or null
   */
  getOTPStatus(callSid) {
    const stored = this.otpStore.get(callSid);
    if (!stored) return null;

    return {
      sent: !!stored.sentAt,
      verified: stored.verified || false,
      attempts: stored.attempts,
      remainingAttempts: this.MAX_ATTEMPTS - stored.attempts,
      expiresAt: new Date(stored.expiresAt),
      expired: Date.now() > stored.expiresAt
    };
  }
}

export default new OTPService();

