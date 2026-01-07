/**
 * Booking Step: Check Availability
 * Step 1: Check availability for a course type
 */

import { BaseStepTool } from './baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';
import sessionStateManager from '../../services/browser/sessionStateManager.js';
import { 
  getRealisticUserAgent, 
  getStealthInitScript
} from '../../utils/stealthUtils.js';

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
    
    if (page && !page.isClosed()) {
      console.log(`✅ [${this.getStepName()}] Reusing existing browser page`);
      return page;
    }

    // For availability check, we don't need authentication - use simple browser page
    console.log(`🌐 [${this.getStepName()}] Creating unauthenticated browser page for public availability check`);
    
    // Get browser instance (reuse if available, or create new)
    const browser = await this.browserManager.getBrowser();
    
    // Create a simple context without authentication
    const context = await browser.newContext({
      userAgent: getRealisticUserAgent(),
      viewport: { width: 1280, height: 720 },
      locale: 'en-GB',
      timezoneId: 'Europe/London',
      permissions: [],
      colorScheme: 'light'
    });
    
    // Add stealth script to avoid detection
    await context.addInitScript(getStealthInitScript());
    
    // Create new page
    page = await context.newPage();
    
    // Store page reference for reuse
    sessionStateManager.setBrowserSession(callSid, page);
    
    console.log(`✅ [${this.getStepName()}] Created unauthenticated browser page for availability check`);
    
    return page;
  }
}

export default new CheckAvailabilityStep();

