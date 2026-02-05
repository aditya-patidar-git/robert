import twilio from "twilio";
// dotenv is already loaded in index.js, no need to reload here

/**
 * Lazy-initialized Twilio client singleton.
 * Uses a getter to defer client creation until first access,
 * avoiding ES module import hoisting issues where env vars
 * might not be loaded yet at module evaluation time.
 */
let _client = null;

const twilioClient = {
  /**
   * Get the Twilio client instance.
   * Creates the client on first access when env vars are guaranteed to be loaded.
   */
  get client() {
    if (!_client) {
      _client = twilio(
        process.env.TWILIO_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }
    return _client;
  },
  
  // Proxy common Twilio client methods for convenience
  get calls() {
    return this.client.calls;
  },
  
  get messages() {
    return this.client.messages;
  },
  
  get recordings() {
    return this.client.recordings;
  },
  
  get insights() {
    return this.client.insights;
  },
  
  get trunking() {
    return this.client.trunking;
  },
  
  get sync() {
    return this.client.sync;
  }
};

export default twilioClient;

