/**
 * CSRF protection via double-submit cookie.
 * State-changing requests (POST, PUT, PATCH, DELETE) to admin and auth must
 * send X-CSRF-Token header matching the _csrf cookie.
 */
import crypto from 'crypto';

const COOKIE_NAME = '_csrf';
const HEADER_NAME = 'x-csrf-token';

/**
 * Generate a new CSRF token (for the token endpoint).
 */
export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware: for POST/PUT/PATCH/DELETE, require X-CSRF-Token header to match cookie.
 * Call after cookieParser(). Apply to /api/admin and /api/auth routes.
 */
export function requireCsrf(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }
  const cookieToken = req.cookies?.[COOKIE_NAME];
  const headerToken = req.get(HEADER_NAME) || req.headers[HEADER_NAME];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token' });
  }
  next();
}

/**
 * Options for setting the CSRF cookie (e.g. in the token endpoint response).
 */
export function getCsrfCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000
  };
}

export { COOKIE_NAME, HEADER_NAME };
