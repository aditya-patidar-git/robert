import twilio from "twilio";
// dotenv is already loaded in index.js, no need to reload here

const client = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export default client;

