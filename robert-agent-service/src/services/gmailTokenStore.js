import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Gmail OAuth token storage. In production, GMAIL_OAUTH_TOKEN_PATH must be set.
 * In development, falls back to ./data/gmail-tokens.json if not set.
 */
const DEV_DEFAULT_TOKEN_PATH = './data/gmail-tokens.json';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getTokenPath() {
  if (process.env.GMAIL_OAUTH_TOKEN_PATH) {
    return process.env.GMAIL_OAUTH_TOKEN_PATH;
  }
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  return DEV_DEFAULT_TOKEN_PATH;
}

function getEncryptionKey() {
  const raw = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  return crypto.createHash('sha256').update(raw).digest();
}

function decrypt(encryptedHex, key) {
  const buf = Buffer.from(encryptedHex, 'hex');
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const cipher = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(cipher) + decipher.final('utf8');
}

function encrypt(plain, key) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, enc]).toString('hex');
}

export function getTokens() {
  const rawPath = getTokenPath();
  if (!rawPath) return null;
  const tokenPath = path.resolve(rawPath);
  try {
    if (!fs.existsSync(tokenPath)) return null;
    const data = fs.readFileSync(tokenPath, 'utf8');
    const key = getEncryptionKey();
    const json = key ? decrypt(data, key) : data;
    const parsed = JSON.parse(json);
    return {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
      expiry: parsed.expiry ?? null
    };
  } catch {
    return null;
  }
}

export function setTokens(tokens) {
  const rawPath = getTokenPath();
  if (!rawPath) {
    console.warn('Gmail token path not configured (set GMAIL_OAUTH_TOKEN_PATH in production)');
    return;
  }
  const tokenPath = path.resolve(rawPath);
  const dir = path.dirname(tokenPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const json = JSON.stringify({
    access_token: tokens.access_token ?? null,
    refresh_token: tokens.refresh_token ?? null,
    expiry: tokens.expiry ?? null
  });
  const key = getEncryptionKey();
  const data = key ? encrypt(json, key) : json;
  fs.writeFileSync(tokenPath, data, 'utf8');
}
