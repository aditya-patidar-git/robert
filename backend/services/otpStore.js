const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

const store = new Map();

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function setOtp(email, otp) {
  const key = email.toLowerCase().trim();
  store.set(key, {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS
  });
  return otp;
}

export function getAndClearOtp(email) {
  const key = email.toLowerCase().trim();
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  store.delete(key);
  return entry.otp;
}

export function clearOtp(email) {
  const key = email.toLowerCase().trim();
  store.delete(key);
}

export function createOtpForEmail(email) {
  const otp = generateOtp();
  setOtp(email, otp);
  return otp;
}
