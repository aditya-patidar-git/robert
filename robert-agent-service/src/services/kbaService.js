import otpService from './otpService.js';
import { conversations } from '../shared/state.js';
import KBASession from '../database/models/KBASession.js';
import PrivacyConfig from '../database/models/PrivacyConfig.js';

class KBAService {
  constructor() {
    this.defaultRetentionDays = 90; // Default if PrivacyConfig not found
  }

  /**
   * Get retention days from PrivacyConfig
   * @returns {Promise<number>} Retention days
   */
  async getRetentionDays() {
    try {
      const privacyConfig = await PrivacyConfig.findOne({ isActive: true }).lean();
      return privacyConfig?.retentionSettings?.metadataRetention || this.defaultRetentionDays;
    } catch (error) {
      console.error('Error fetching privacy config for retention:', error);
      return this.defaultRetentionDays;
    }
  }

  /**
   * Validate email + postcode + booking reference against CRM
   * Note: This will need to integrate with browser agent when moved to robert-agent-service
   * @param {string} email - Email address on booking
   * @param {string} postcode - Postcode
   * @param {string} bookingReference - Booking reference (optional)
   * @returns {Promise<{valid: boolean, bookingData?: object, mobileNumber?: string, error?: string}>}
   */
  async validateBookingDetails(email, postcode, bookingReference = null) {
    try {
      // TODO: Integrate with browser agent to fetch booking from CRM
      // For now, this is a placeholder that will be enhanced when browser agent is moved
      // The browser agent should:
      // 1. Login to CRM (https://takeabyte.co.uk/InContact/Account/Login)
      // 2. Search for booking by email + postcode + booking reference
      // 3. Return booking data including mobile number if found
      
      // Placeholder validation (will be replaced with actual CRM query)
      // In production, this should query the InContact CRM via browser agent
      console.log(`🔍 [KBA] Validating booking: email=${email}, postcode=${postcode}, ref=${bookingReference}`);
      
      // Mock validation - replace with actual CRM query
      // This should return:
      // - valid: true/false
      // - bookingData: { bookingRef, date, course, status, etc. }
      // - mobileNumber: registered mobile (for OTP if available)
      
      return {
        valid: false, // Placeholder - will be true when CRM integration is complete
        error: 'CRM integration pending. KBA validation will be available once browser agent is integrated.'
      };
    } catch (error) {
      console.error('Error validating booking details:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Perform KBA verification (email + postcode + booking ref)
   * @param {string} callSid - Call SID
   * @param {string} callerId - Caller phone number
   * @param {string} email - Email address
   * @param {string} postcode - Postcode
   * @param {string} bookingReference - Booking reference (optional)
   * @returns {Promise<{success: boolean, requiresOTP: boolean, mobileNumber?: string, error?: string}>}
   */
  async verifyKBA(callSid, callerId, email, postcode, bookingReference = null) {
    try {
      // Validate booking details against CRM
      const validation = await this.validateBookingDetails(email, postcode, bookingReference);
      
      if (!validation.valid) {
        return {
          success: false,
          requiresOTP: false,
          error: validation.error || 'Booking details not found or invalid.'
        };
      }

      // Store KBA session
      const retentionDays = await this.getRetentionDays();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + retentionDays);

      const kbaSession = new KBASession({
        callSid,
        callerId,
        email,
        postcode,
        bookingReference,
        verificationStatus: 'verified',
        verifiedAt: new Date(),
        expiresAt
      });

      await kbaSession.save();

      // Update conversation state
      if (conversations[callSid]) {
        if (!conversations[callSid].kba) {
          conversations[callSid].kba = {};
        }
        conversations[callSid].kba.verified = true;
        conversations[callSid].kba.verifiedAt = new Date();
        conversations[callSid].kba.method = 'email_postcode_bookingref';
        conversations[callSid].kba.email = email;
        conversations[callSid].kba.postcode = postcode;
        conversations[callSid].kba.bookingReference = bookingReference;
      }

      console.log(`✅ [${callSid}] KBA verified: email + postcode + booking ref`);

      // Check if mobile number is available for OTP
      const requiresOTP = !!validation.mobileNumber;
      
      return {
        success: true,
        requiresOTP,
        mobileNumber: validation.mobileNumber,
        bookingData: validation.bookingData
      };
    } catch (error) {
      console.error(`❌ [${callSid}] Error verifying KBA:`, error);
      return {
        success: false,
        requiresOTP: false,
        error: error.message
      };
    }
  }

  /**
   * Complete KBA with OTP verification
   * @param {string} callSid - Call SID
   * @param {string} otpCode - OTP code
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async verifyKBAWithOTP(callSid, otpCode) {
    try {
      // Verify OTP
      const otpResult = await otpService.verifyOTPCode(callSid, otpCode);
      
      if (!otpResult.success) {
        return otpResult;
      }

      // Update KBA session to include OTP verification
      const kbaSession = await KBASession.findOne({ callSid }).sort({ createdAt: -1 });
      if (kbaSession) {
        kbaSession.otpVerified = true;
        kbaSession.otpVerifiedAt = new Date();
        kbaSession.verificationStatus = 'verified_with_otp';
        await kbaSession.save();
      }

      // Update conversation state
      if (conversations[callSid] && conversations[callSid].kba) {
        conversations[callSid].kba.otpVerified = true;
        conversations[callSid].kba.otpVerifiedAt = new Date();
        conversations[callSid].kba.method = 'email_postcode_bookingref_otp';
      }

      console.log(`✅ [${callSid}] KBA verified with OTP`);
      
      return {
        success: true
      };
    } catch (error) {
      console.error(`❌ [${callSid}] Error verifying KBA with OTP:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if KBA is required for a tool call
   * @param {string} toolName - Tool name
   * @param {object} parameters - Tool parameters
   * @returns {boolean} True if KBA is required
   */
  requiresKBA(toolName, parameters) {
    // Tools that require KBA:
    // - crm_browser (any action that accesses/changes personal data)
    // - Any tool that accesses booking information
    const kbaRequiredTools = ['crm_browser', 'crm', 'transfer_call'];
    
    if (!kbaRequiredTools.includes(toolName)) {
      return false;
    }

    // For crm_browser, check if action involves personal data
    if (toolName === 'crm_browser' || toolName === 'crm') {
      const personalDataActions = ['get_customer', 'update_customer', 'create_booking', 'reschedule_booking', 'cancel_booking'];
      return personalDataActions.includes(parameters?.action);
    }

    return false;
  }

  /**
   * Check if KBA is verified for a call
   * @param {string} callSid - Call SID
   * @returns {boolean} True if KBA is verified
   */
  isKBAVerified(callSid) {
    if (!conversations[callSid] || !conversations[callSid].kba) {
      return false;
    }

    return conversations[callSid].kba.verified === true;
  }

  /**
   * Get KBA status for a call
   * @param {string} callSid - Call SID
   * @returns {object} KBA status
   */
  getKBAStatus(callSid) {
    if (!conversations[callSid] || !conversations[callSid].kba) {
      return {
        verified: false,
        method: null,
        verifiedAt: null
      };
    }

    return {
      verified: conversations[callSid].kba.verified || false,
      method: conversations[callSid].kba.method || null,
      verifiedAt: conversations[callSid].kba.verifiedAt || null,
      otpVerified: conversations[callSid].kba.otpVerified || false,
      email: conversations[callSid].kba.email || null,
      postcode: conversations[callSid].kba.postcode || null,
      bookingReference: conversations[callSid].kba.bookingReference || null
    };
  }
}

export default new KBAService();

