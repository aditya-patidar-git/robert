/**
 * Integration test configuration.
 * Uses real Twilio/OpenAI credentials from env. Skip when not set.
 */
export const integrationConfig = {
  get enabled() {
    return !!(
      (process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID) &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.OPENAI_API_KEY &&
      process.env.RUN_INTEGRATION_TESTS === '1'
    );
  },
  timeouts: {
    callPickup: 5000,
    greeting: 20000,
    bargeInHalt: 5000,
    transfer: 30000,
    concurrency: 180000
  },
  thresholds: {
    callPickupLatencyP95: 2000,
    bargeInHaltMs: 200,
    p95LatencyConcurrency: 3000
  },
  concurrency: { numCalls: 20 }
};
