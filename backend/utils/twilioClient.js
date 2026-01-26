import twilio from "twilio";
// dotenv is already loaded in server.js, no need to reload here

// Lazy initialization: Create Twilio client only when needed (after dotenv loads)
let twilioClient = null;
function getTwilioClient() {
  if (!twilioClient) {
    twilioClient = twilio(
      process.env.TWILIO_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return twilioClient;
}

// Export getter function as default for backward compatibility
export default {
  get calls() { return getTwilioClient().calls; },
  get messages() { return getTwilioClient().messages; },
  get recordings() { return getTwilioClient().recordings; },
  get accounts() { return getTwilioClient().accounts; },
  // Add proxy for other properties
  getClient: getTwilioClient
};
