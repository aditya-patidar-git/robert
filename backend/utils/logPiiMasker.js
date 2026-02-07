/**
 * Masks PII in log messages and context before storage or console output.
 * Reuses gdprService.maskPII for pattern logic; single responsibility.
 */

import gdprService from '../services/gdprService.js';

const MAX_DEPTH = 10;

function maskString(value) {
  if (typeof value !== 'string') return value;
  return gdprService.maskPII(value, 'partial');
}

function maskContext(value, depth, visited) {
  if (depth <= 0) return value;
  if (value === null || typeof value !== 'string' && typeof value !== 'object') {
    return typeof value === 'string' ? maskString(value) : value;
  }
  if (typeof value === 'string') return maskString(value);
  if (Object.prototype.toString.call(value) !== '[object Object]' && !Array.isArray(value)) {
    return typeof value.toString === 'function' ? maskString(String(value)) : '[Object]';
  }
  if (visited.has(value)) return '[Circular]';
  visited.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => maskContext(item, depth - 1, visited));
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = maskContext(v, depth - 1, visited);
  }
  return out;
}

/**
 * @param {string} message - Log message
 * @param {Object} context - Log context object
 * @returns {{ message: string, context: Object }} Masked message and context
 */
export function maskLogPayload(message, context = {}) {
  const maskedMessage = typeof message === 'string' ? maskString(message) : maskString(String(message ?? ''));
  const maskedContext = maskContext(context, MAX_DEPTH, new WeakSet());
  return { message: maskedMessage, context: maskedContext };
}
