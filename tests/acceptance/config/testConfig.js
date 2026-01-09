/**
 * Test Configuration
 * Centralized configuration for acceptance tests
 */

export const testConfig = {
  // Test timeouts (in milliseconds)
  timeouts: {
    callPickup: 5000, // Max time to wait for call pickup
    greeting: 10000, // Max time to wait for greeting
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

  // Test credentials (from environment variables)
  credentials: {
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      phoneNumber: process.env.TWILIO_NUMBER || '+442045726060',
      testPhoneNumber: process.env.TEST_TWILIO_NUMBER || process.env.TWILIO_NUMBER
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
  }
};

export default testConfig;

