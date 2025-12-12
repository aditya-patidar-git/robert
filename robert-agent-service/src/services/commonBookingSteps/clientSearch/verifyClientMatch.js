/**
 * Verify Client Match
 * Handles verification of client details when multiple search results appear
 * Per CRM module requirements: verify email + postcode when multiple results
 */

/**
 * Verify if extracted client details match search criteria
 * @param {object} clientDetails - Extracted client details from CRM
 * @param {string} searchType - 'email' or 'mobile'
 * @param {string} searchValue - Original search value
 * @param {string} clientPostcode - Optional postcode for verification when multiple results
 * @returns {Promise<{matches: boolean, emailMatches: boolean, postcodeMatches: boolean, error?: string}>}
 */
export async function verifyClientMatch(clientDetails, searchType, searchValue, clientPostcode = null) {
  try {
    if (!clientDetails) {
      return {
        matches: false,
        emailMatches: false,
        postcodeMatches: false,
        error: 'Client details not provided'
      };
    }

    let emailMatches = false;
    let postcodeMatches = true; // Default to true if no postcode provided for verification

    if (searchType === 'email') {
      // Normalize email for comparison
      const extractedEmail = clientDetails.email?.toLowerCase().trim();
      const searchEmail = searchValue.toLowerCase().trim();
      emailMatches = extractedEmail === searchEmail || 
                     extractedEmail?.includes(searchEmail) || 
                     searchEmail.includes(extractedEmail);

      // Per document: When multiple results appear, verify email + postcode
      if (clientPostcode) {
        const extractedPostcode = clientDetails.postcode?.toUpperCase().replace(/\s+/g, '').trim();
        const searchPostcode = clientPostcode.toUpperCase().replace(/\s+/g, '').trim();
        postcodeMatches = extractedPostcode === searchPostcode;
        
        if (!postcodeMatches) {
          console.log(`⚠️ [VERIFY] Postcode mismatch: searched for "${searchPostcode}", found "${extractedPostcode}"`);
        } else {
          console.log(`✅ [VERIFY] Postcode matches: "${searchPostcode}"`);
        }
      }

      if (!emailMatches) {
        console.log(`⚠️ [VERIFY] Email mismatch: searched for "${searchEmail}", found "${extractedEmail}"`);
      }

      // Both email and postcode must match when postcode is provided
      const matches = emailMatches && postcodeMatches;

      if (emailMatches && clientPostcode && !postcodeMatches) {
        return {
          matches: false,
          emailMatches: true,
          postcodeMatches: false,
          error: 'Email matches but postcode does not match. Per document requirements, both email and postcode must match when multiple results appear.'
        };
      }

      return {
        matches,
        emailMatches,
        postcodeMatches
      };

    } else if (searchType === 'mobile') {
      // Normalize phone numbers for comparison
      const extractedPhone = clientDetails.telephoneNumber?.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '').replace(/^\+44/, '0');
      const searchPhone = searchValue.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '').replace(/^\+44/, '0');
      
      // Compare last 11 digits (UK mobile format)
      const extractedLast11 = extractedPhone?.slice(-11);
      const searchLast11 = searchPhone.slice(-11);
      
      const phoneMatches = extractedLast11 === searchLast11 || 
                          extractedPhone === searchPhone ||
                          extractedPhone?.endsWith(searchPhone) || 
                          searchPhone.endsWith(extractedPhone);

      if (!phoneMatches) {
        console.log(`⚠️ [VERIFY] Phone mismatch: searched for "${searchLast11}", found "${extractedLast11}"`);
      }

      return {
        matches: phoneMatches,
        emailMatches: false,
        postcodeMatches: true
      };
    }

    return {
      matches: false,
      emailMatches: false,
      postcodeMatches: false,
      error: `Unknown search type: ${searchType}`
    };

  } catch (error) {
    console.error('❌ [VERIFY] Error verifying client match:', error);
    return {
      matches: false,
      emailMatches: false,
      postcodeMatches: false,
      error: error.message
    };
  }
}

