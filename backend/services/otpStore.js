const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

const store = new Map();

function buildKey(email, purpose) {
  const normalized = email.toLowerCase().trim();
  return purpose ? `${purpose}:${normalized}` : normalized;
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function setOtp(email, otp, purpose = null) {
  const key = buildKey(email, purpose);
  store.set(key, {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS
  });
  return otp;
}

export function getAndClearOtp(email, purpose = null) {
  const key = buildKey(email, purpose);
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  store.delete(key);
  return entry.otp;
}

export function clearOtp(email, purpose = null) {
  const key = buildKey(email, purpose);
  store.delete(key);
}

export function createOtpForEmail(email, purpose = null) {
  const otp = generateOtp();
  setOtp(email, otp, purpose);
  return otp;
}
