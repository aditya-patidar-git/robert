/**
 * Assert required environment variables at startup.
 * Call process.exit(1) if any are missing so the backend does not run in a broken state.
 */

const REQUIRED_ENV = [
  'MONGO_URI',
  'OPENAI_API_KEY',
  'TWILIO_AUTH_TOKEN'
];

// Twilio: accept either TWILIO_SID or TWILIO_ACCOUNT_SID
function assertEnv() {
  const missing = [];
  for (const key of REQUIRED_ENV) {
    if (!process.env[key] || String(process.env[key]).trim() === '') {
      missing.push(key);
    }
  }
  const hasTwilioSid = (process.env.TWILIO_SID && process.env.TWILIO_SID.trim() !== '') ||
    (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID.trim() !== '');
  if (!hasTwilioSid) {
    missing.push('TWILIO_SID or TWILIO_ACCOUNT_SID');
  }
  if (missing.length > 0) {
    console.error('❌ [backend] Missing required environment variables:', missing.join(', '));
    console.error('   Set them in .env or your secret store and restart.');
    process.exit(1);
  }
}

export default assertEnv;
