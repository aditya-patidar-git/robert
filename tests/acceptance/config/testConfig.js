/**
 * Test Configuration
 * Centralized configuration for acceptance tests
 */

export const testConfig = {
  // Test timeouts (in milliseconds)
  timeouts: {
    callPickup: 5000, // Max time to wait for call pickup
    greeting: 20000, // Max time to wait for greeting (increased to allow for delayed greeting delivery)
    response: 30000, // Max time to wait for agent response
    toolExecution: 60000, // Max time for tool execution
    testComplete: 120000, // Max time for entire test
    concurrency: 180000 // Max time for concurrency test
  },

  // Latency thresholds (in milliseconds)
  thresholds: {
    callPickupLatency: 2000, // Must be < 2.0 seconds
    bargeInResponse: 200, // TTS halt must be < 200ms
    p95Latency: 3000, // p95 latency target (adjust based on requirements)
    vadSilence: {
      min: 500,
      max: 700
    },
    audioPadding: {
      start: 250, // Leading silence padding
      end: {
        min: 300,
        max: 500
      }
    }
  },

  // Voice Insights thresholds
  voiceInsights: {
    minMOS: 3.5, // Minimum acceptable MOS score
    maxJitter: 50, // Maximum acceptable jitter (ms)
    maxPacketLoss: 5 // Maximum acceptable packet loss (%)
  },

  // Test credentials (from environment variables) - using getters for dynamic reading
  get credentials() {
    // Detect if test credentials are available
    const hasTestCredentials = process.env.TEST_AUTH_TOKEN && 
                               (process.env.ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID);
    
    // Use test credentials if available, otherwise use production credentials
    const accountSid = hasTestCredentials 
      ? (process.env.ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID)
      : (process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID);
    
    const authToken = hasTestCredentials
      ? process.env.TEST_AUTH_TOKEN
      : process.env.TWILIO_AUTH_TOKEN;
    
    // Warn about test credentials limitations
    if (hasTestCredentials) {
      console.warn('[TestConfig] ⚠️  TEST CREDENTIALS DETECTED');
      console.warn('[TestConfig] ⚠️  Webhooks will NOT be triggered with test credentials');
      console.warn('[TestConfig] ⚠️  Calls are simulated only - no actual connections');
      console.warn('[TestConfig] ⚠️  Use production credentials to test inbound webhooks');
    }
    
    // Get verified caller ID (personal mobile number) for testing
    // This should be a number verified in Twilio Console: https://console.twilio.com/us1/develop/phone-numbers/manage/verified
    const verifiedCallerId = process.env.VERIFIED_CALLER_ID || process.env.TEST_CALLER_ID;
    
    return {
      twilio: {
        accountSid: accountSid,
        authToken: authToken,
        phoneNumber: process.env.TWILIO_NUMBER || '+442045726060', // TO number (your Twilio number)
        verifiedCallerId: verifiedCallerId, // FROM number (your verified personal mobile)
        testPhoneNumber: process.env.TEST_TWILIO_NUMBER || process.env.TWILIO_NUMBER || '+442045726060',
        magicTestNumber: '+15005550006', // Twilio magic test number for automated inbound testing
        usingTestCredentials: hasTestCredentials // Flag to indicate test mode
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY
      },
      crm: {
        loginName: process.env.CRM_LOGIN_NAME || 'universalmct',
        userName: process.env.CRM_USER_NAME || 'auagent',
        password: process.env.CRM_PASSWORD,
        url: process.env.CRM_URL || 'https://takeabyte.co.uk/InContact/Account/Login'
      },
      transferNumber: process.env.TRANSFER_NUMBER || '+442036918807'
    };
  },

  // Test data
  testData: {
    callerNumbers: [
      '+447700900001',
      '+447700900002',
      '+447700900003'
    ],
    testClient: {
      mobile: process.env.TEST_CLIENT_MOBILE || '07123456789',
      email: process.env.TEST_CLIENT_EMAIL || 'test@example.com',
      fullName: process.env.TEST_CLIENT_FULL_NAME || 'Test User',
      postcode: process.env.TEST_CLIENT_POSTCODE || 'HA8 6AG',
      telephone: process.env.TEST_CLIENT_TELEPHONE || '07123456789'
    }
  },

  // Evidence collection settings
  evidence: {
    collectRecordings: true,
    collectScreenshots: true,
    collectHAR: true,
    collectLogs: true,
    outputDir: './tests/acceptance/evidence',
    zipOutput: true
  },

  // Database settings
  database: {
    testDbName: 'robert_test',
    cleanupAfterTest: true,
    cleanupAfterSuite: true
  },

  // Concurrency test settings
  concurrency: {
    numCalls: 20,
    parallelLimit: 20 // Use p-limit to control parallelism
  },

  // Retry settings
  retries: {
    maxRetries: 2,
    retryDelay: 1000
  },

  // Retention settings (for GDPR/DSAR tests)
  retentionSettings: {
    transcriptRetention: 90, // days
    metadataRetention: 90,
    recordingRetention: 90
  }
};

export default testConfig;

