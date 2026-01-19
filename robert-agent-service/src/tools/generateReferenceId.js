import { randomBytes } from 'crypto';

/**
 * Generate Reference ID Tool
 * Generate tracking/reference IDs for complaints, bookings, or general tracking
 * This is a standalone tool that can be used independently whenever a reference ID is needed
 */
class GenerateReferenceIdTool {
  /**
   * Generate a short, readable reference ID
   * Format: PREFIX-XXXXXX (e.g., REF-ABC123, TRACK-XYZ789)
   * @param {string} prefix - Optional prefix (default: "REF")
   * @returns {string} Generated reference ID
   */
  generateReferenceId(prefix = 'REF') {
    // Generate 6-character alphanumeric code (uppercase letters and numbers)
    // Using randomBytes for better randomness
    const randomPart = randomBytes(3)
      .toString('base64')
      .replace(/[^A-Z0-9]/g, '') // Remove non-alphanumeric chars
      .substring(0, 6)
      .toUpperCase();
    
    // Ensure we have exactly 6 characters (pad if needed)
    const paddedRandom = randomPart.padEnd(6, '0').substring(0, 6);
    
    // Format: PREFIX-XXXXXX
    return `${prefix.toUpperCase()}-${paddedRandom}`;
  }

  /**
   * Execute generate_reference_id tool
   * @param {Object} parameters - Tool parameters
   * @param {string} [parameters.prefix] - Optional prefix for the reference ID (default: "REF")
   * @param {string} [parameters.purpose] - Optional purpose/context (e.g., "complaint", "booking", "tracking")
   * @param {Object} callContext - Call context
   * @returns {Promise<{success: boolean, referenceId?: string, prefix?: string, purpose?: string, message?: string, error?: string}>}
   */
  async execute(parameters, callContext = {}) {
    try {
      const { prefix = 'REF', purpose = null } = parameters;
      const callSid = callContext.callSid || 'unknown';

      // Validate prefix (should be short, alphanumeric, max 10 chars)
      if (prefix && (prefix.length > 10 || !/^[A-Z0-9-]+$/i.test(prefix))) {
        return {
          success: false,
          error: 'Invalid prefix format. Prefix should be alphanumeric, max 10 characters.'
        };
      }

      // Generate reference ID
      const referenceId = this.generateReferenceId(prefix);

      console.log(`✅ [${callSid}] Generated reference ID: ${referenceId}${purpose ? ` (purpose: ${purpose})` : ''}`);

      // Build message for caller
      let message = `Your reference number is ${referenceId}.`;
      if (purpose) {
        message += ` Please keep this reference for your ${purpose}.`;
      } else {
        message += ` Please keep this reference for your records.`;
      }

      return {
        success: true,
        referenceId: referenceId,
        prefix: prefix.toUpperCase(),
        purpose: purpose || 'general',
        message: message,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error in generate_reference_id tool:', error);
      return {
        success: false,
        error: error.message || 'Unknown error generating reference ID'
      };
    }
  }
}

export default new GenerateReferenceIdTool();
