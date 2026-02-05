/**
 * Booking Step: Check Availability
 * Step 1: Check availability for a course type
 */

import { BaseStepTool } from './baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';
import sessionStateManager from '../../services/browser/sessionStateManager.js';

export class CheckAvailabilityStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.CHECK_AVAILABILITY;
  }

  getRequiredPreferences() {
    return []; // No preferences required for availability check
  }

  /**
   * Get timeout for availability check - browser automation needs more time
   * @returns {number} Timeout in milliseconds (60 seconds)
   */
  getTimeout() {
    return 60000; // 60 seconds for browser automation (launch, navigate, load, extract) - increased due to network latency
  }

  /**
   * Override getBrowserSession to use unauthenticated page for public availability check
   * Availability pages are public and don't require CRM login
   */
  async getBrowserSession(callSid, courseType) {
    // Check if we have a stored page reference
    let page = sessionStateManager.getBrowserSession(callSid);
    
    // Safety check: Verify page is a valid Playwright Page object before calling isClosed()
    // pageRef may be null or invalid if retrieved from Twilio Sync (non-serializable objects are removed)
    const isValidPage = page && typeof page === 'object' && typeof page.isClosed === 'function';
    
    if (isValidPage && !page.isClosed()) {
      console.log(`✅ [${this.getStepName()}] Reusing existing browser page`);
      return page;
    }

    // For availability check, we don't need authentication - use public context
    console.log(`🌐 [${this.getStepName()}] Creating unauthenticated browser page for public availability check`);
    
    // CRITICAL FIX: Use getPublicContext() instead of getBrowser() + newContext()
    // This ensures we use the existing persistent context (with VPN) instead of creating a new one
    const context = await this.browserManager.getPublicContext();
    
    // Create new page from the context (context already has VPN if using persistent context)
    page = await context.newPage();
    
    // Store page reference for reuse
    sessionStateManager.setBrowserSession(callSid, page);
    
    console.log(`✅ [${this.getStepName()}] Created unauthenticated browser page for availability check`);
    
    return page;
  }
}

export default new CheckAvailabilityStep();

