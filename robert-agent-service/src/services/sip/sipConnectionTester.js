/**
 * SIP Connection Tester
 * Tests SIP endpoint reachability, webhook accessibility, and SIP trunk configuration
 */

import sipService from '../sipService.js';
import twilio from 'twilio';

class SipConnectionTester {
  constructor() {
    this.twilioClient = null;
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }
  }

  /**
   * Test SIP connection and configuration
   * @param {Object} options - Test options
   * @returns {Promise<Object>} Test results
   */
  async testConnection(options = {}) {
    const results = {
      passed: false,
      tests: [],
      errors: [],
      warnings: []
    };

    // Test 1: SIP endpoint format validation
    const endpointTest = this.testEndpointFormat();
    results.tests.push(endpointTest);
    if (!endpointTest.passed) {
      results.errors.push(endpointTest.error);
    }

    // Test 2: Webhook endpoint accessibility
    const webhookTest = await this.testWebhookAccessibility();
    results.tests.push(webhookTest);
    if (!webhookTest.passed) {
      results.warnings.push(webhookTest.error || 'Webhook may not be accessible');
    }

    // Test 3: SIP trunk configuration (if Twilio client available)
    if (this.twilioClient) {
      const trunkTest = await this.testSipTrunkConfiguration();
      results.tests.push(trunkTest);
      if (!trunkTest.passed) {
        results.warnings.push(trunkTest.error || 'SIP trunk configuration issue');
      }
    } else {
      results.tests.push({
        name: 'SIP Trunk Configuration',
        passed: false,
        skipped: true,
        message: 'Twilio client not configured - cannot test SIP trunk'
      });
    }

    // Overall result: passed if all critical tests pass
    results.passed = results.tests
      .filter(t => !t.skipped)
      .every(t => t.passed || t.warning);

    return results;
  }

  /**
   * Test SIP endpoint format
   * @returns {Object} Test result
   */
  testEndpointFormat() {
    const validation = sipService.validateEndpoint();
    return {
      name: 'SIP Endpoint Format',
      passed: validation.valid,
      error: validation.error,
      details: {
        endpoint: sipService.getSipEndpoint() ? 'configured' : 'not configured',
        format: validation.valid ? 'valid' : 'invalid'
      }
    };
  }

  /**
   * Test webhook endpoint accessibility
   * @returns {Promise<Object>} Test result
   */
  async testWebhookAccessibility() {
    const webhookUrl = sipService.getToolExecutionWebhookUrl();
    
    if (!webhookUrl) {
      return {
        name: 'Webhook Accessibility',
        passed: false,
        error: 'Webhook URL not configured',
        warning: true
      };
    }

    try {
      // Test with HEAD request to check if endpoint is reachable
      const response = await fetch(webhookUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });

      return {
        name: 'Webhook Accessibility',
        passed: response.ok || response.status === 405, // 405 Method Not Allowed is OK (endpoint exists)
        warning: !response.ok && response.status !== 405,
        message: response.ok 
          ? 'Webhook endpoint is accessible' 
          : `Webhook returned status ${response.status}`,
        details: {
          url: webhookUrl,
          status: response.status,
          accessible: response.ok || response.status === 405
        }
      };
    } catch (error) {
      return {
        name: 'Webhook Accessibility',
        passed: false,
        warning: true,
        error: `Webhook may not be accessible: ${error.message}`,
        details: {
          url: webhookUrl,
          error: error.message
        }
      };
    }
  }

  /**
   * Test SIP trunk configuration via Twilio API
   * @returns {Promise<Object>} Test result
   */
  async testSipTrunkConfiguration() {
    const sipTrunkSid = process.env.TWILIO_SIP_TRUNK_SID;
    
    if (!sipTrunkSid) {
      return {
        name: 'SIP Trunk Configuration',
        passed: false,
        skipped: true,
        message: 'SIP trunk SID not configured'
      };
    }

    if (!this.twilioClient) {
      return {
        name: 'SIP Trunk Configuration',
        passed: false,
        skipped: true,
        message: 'Twilio client not configured'
      };
    }

    try {
      // Fetch trunk details from Twilio
      const trunk = await this.twilioClient.trunking.v1.trunks(sipTrunkSid).fetch();
      
      return {
        name: 'SIP Trunk Configuration',
        passed: true,
        message: 'SIP trunk is configured and accessible',
        details: {
          sid: trunk.sid,
          friendlyName: trunk.friendlyName,
          status: 'active'
        }
      };
    } catch (error) {
      if (error.status === 404) {
        return {
          name: 'SIP Trunk Configuration',
          passed: false,
          error: `SIP trunk not found: ${sipTrunkSid}`,
          details: {
            sid: sipTrunkSid,
            error: 'Trunk not found in Twilio account'
          }
        };
      }

      return {
        name: 'SIP Trunk Configuration',
        passed: false,
        warning: true,
        error: `Error fetching SIP trunk: ${error.message}`,
        details: {
          sid: sipTrunkSid,
          error: error.message
        }
      };
    }
  }
}

export default new SipConnectionTester();

