/**
 * Policy Check Service
 * Handles KB policy checks before booking (T&Cs, fees, prerequisites)
 */

/**
 * Perform policy check using file_search tool
 * @param {object} fileSearchTool - File search tool instance
 * @param {string} courseType - Course type (e.g., 'CBT', 'ITM', 'Private Lesson')
 * @param {object} callContext - Call context with callSid
 * @returns {Promise<object>} - Policy check results
 */
export async function performPolicyCheck(fileSearchTool, courseType, callContext = {}) {
  try {
    const callSid = callContext.callSid || 'unknown';
    console.log(`📋 [${callSid}] Performing policy check for course: ${courseType}`);

    // Query KB for relevant policies
    const queries = [
      `Terms and Conditions for ${courseType} bookings, cancellations, reschedules, and fees`,
      `Prerequisites and requirements for ${courseType} course including documents, attire, and licence checks`,
      `Cancellation and refund policy for ${courseType}`
    ];

    const policyResults = {
      performed: true,
      timestamp: new Date(),
      courseType,
      tcs: null,
      fees: null,
      prerequisites: null,
      cancellationPolicy: null,
      sources: []
    };

    // Search for T&Cs
    try {
      const tcResult = await fileSearchTool.execute({
        query: queries[0],
        maxResults: 3
      }, callContext);

      if (tcResult.success && tcResult.results && tcResult.results.length > 0) {
        policyResults.tcs = tcResult.results;
        policyResults.sources.push(...tcResult.results.map(r => r.source || r.title));
      }
    } catch (error) {
      console.warn(`⚠️ [${callSid}] Error fetching T&Cs:`, error.message);
    }

    // Search for prerequisites
    try {
      const prereqResult = await fileSearchTool.execute({
        query: queries[1],
        maxResults: 3
      }, callContext);

      if (prereqResult.success && prereqResult.results && prereqResult.results.length > 0) {
        policyResults.prerequisites = prereqResult.results;
        policyResults.sources.push(...prereqResult.results.map(r => r.source || r.title));
      }
    } catch (error) {
      console.warn(`⚠️ [${callSid}] Error fetching prerequisites:`, error.message);
    }

    // Search for cancellation policy
    try {
      const cancelResult = await fileSearchTool.execute({
        query: queries[2],
        maxResults: 3
      }, callContext);

      if (cancelResult.success && cancelResult.results && cancelResult.results.length > 0) {
        policyResults.cancellationPolicy = cancelResult.results;
        policyResults.sources.push(...cancelResult.results.map(r => r.source || r.title));
      }
    } catch (error) {
      console.warn(`⚠️ [${callSid}] Error fetching cancellation policy:`, error.message);
    }

    // Remove duplicate sources
    policyResults.sources = [...new Set(policyResults.sources)];

    console.log(`✅ [${callSid}] Policy check completed. Found ${policyResults.sources.length} source(s)`);

    return {
      success: true,
      policyResults
    };

  } catch (error) {
    console.error(`❌ Policy check error:`, error);
    return {
      success: false,
      error: error.message,
      policyResults: {
        performed: true,
        timestamp: new Date(),
        courseType,
        error: error.message
      }
    };
  }
}

/**
 * Generate policy summary message for agent to communicate to caller
 * @param {object} policyResults - Policy check results
 * @returns {string} - Formatted policy summary
 */
export function generatePolicySummary(policyResults) {
  if (!policyResults || !policyResults.performed) {
    return "Policy information is being checked. Please proceed with caution.";
  }

  const summary = [];
  
  if (policyResults.tcs && policyResults.tcs.length > 0) {
    summary.push("Terms and Conditions: Available");
  }
  
  if (policyResults.fees) {
    summary.push("Fee information: Available");
  }
  
  if (policyResults.prerequisites && policyResults.prerequisites.length > 0) {
    summary.push("Prerequisites: Available");
  }
  
  if (policyResults.cancellationPolicy && policyResults.cancellationPolicy.length > 0) {
    summary.push("Cancellation policy: Available");
  }

  if (summary.length === 0) {
    return "Policy information check completed. Please refer to standard terms and conditions.";
  }

  return `Policy check completed. ${summary.join(' ')}`;
}

