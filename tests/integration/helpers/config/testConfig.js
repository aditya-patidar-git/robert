/**
 * Test Configuration for integration tests
 */
export const testConfig = {
  timeouts: {
    callPickup: 5000,
    greeting: 20000,
    response: 30000,
    toolExecution: 60000,
    testComplete: 120000,
    concurrency: 180000
  },
  thresholds: {
    callPickupLatency: 2000,
    bargeInResponse: 200,
    p95Latency: 3000,
    vadSilence: { min: 500, max: 700 },
    audioPadding: { start: 250, end: { min: 300, max: 500 } }
  },
  voiceInsights: { minMOS: 3.5, maxJitter: 50, maxPacketLoss: 5 },
  get credentials() {
    const hasTestCredentials = process.env.TEST_AUTH_TOKEN &&
      (process.env.ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID);
    const accountSid = hasTestCredentials
      ? (process.env.ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID)
      : (process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID);
    const authToken = hasTestCredentials ? process.env.TEST_AUTH_TOKEN : process.env.TWILIO_AUTH_TOKEN;
    const verifiedCallerId = process.env.VERIFIED_CALLER_ID || process.env.TEST_CALLER_ID;
    return {
      twilio: {
        accountSid,
        authToken,
        phoneNumber: process.env.TWILIO_NUMBER || '+442045726060',
        verifiedCallerId,
        testPhoneNumber: process.env.TEST_TWILIO_NUMBER || process.env.TWILIO_NUMBER || '+442045726060',
        magicTestNumber: '+15005550006',
        usingTestCredentials: hasTestCredentials
      },
      openai: { apiKey: process.env.OPENAI_API_KEY },
      crm: {
        loginName: process.env.CRM_LOGIN_NAME || 'universalmct',
        userName: process.env.CRM_USER_NAME || 'auagent',
        password: process.env.CRM_PASSWORD,
        url: process.env.CRM_URL || 'https://takeabyte.co.uk/InContact/Account/Login'
      },
      transferNumber: process.env.TRANSFER_NUMBER || '+442036918807'
    };
  },
  testData: {
    callerNumbers: ['+447700900001', '+447700900002', '+447700900003'],
    testClient: {
      mobile: process.env.TEST_CLIENT_MOBILE || '07123456789',
      email: process.env.TEST_CLIENT_EMAIL || 'test@example.com',
      fullName: process.env.TEST_CLIENT_FULL_NAME || 'Test User',
      postcode: process.env.TEST_CLIENT_POSTCODE || 'HA8 6AG',
      telephone: process.env.TEST_CLIENT_TELEPHONE || '07123456789'
    }
  },
  evidence: {
    collectRecordings: true,
    collectScreenshots: true,
    collectHAR: true,
    collectLogs: true,
    outputDir: './tests/evidence/artifacts',
    zipOutput: true
  },
  database: { testDbName: 'robert_test', cleanupAfterTest: true, cleanupAfterSuite: true },
  concurrency: { numCalls: 20, parallelLimit: 20 },
  retries: { maxRetries: 2, retryDelay: 1000 },
  retentionSettings: { transcriptRetention: 90, metadataRetention: 90, recordingRetention: 90 }
};
export default testConfig;
