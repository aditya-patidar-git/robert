/**
 * Twilio webhook signature verification.
 * Rejects requests that do not have a valid X-Twilio-Signature so that
 * only Twilio can trigger voice/recording/status callbacks.
 */
import twilio from 'twilio';

/**
 * Middleware that validates X-Twilio-Signature using TWILIO_AUTH_TOKEN.
 * Use on all routes that Twilio calls (inbound/outbound voice, call-status, recording-status).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function twilioWebhookAuth(req, res, next) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken || String(authToken).trim() === '') {
    console.error('❌ [Twilio] TWILIO_AUTH_TOKEN not set; cannot validate webhooks');
    return res.status(503).json({ error: 'Webhook validation not configured' });
  }

  const signature = req.headers['x-twilio-signature'];
  if (!signature) {
    return res.status(403).json({ error: 'Missing X-Twilio-Signature' });
  }

  // Build the full URL Twilio used (must match what Twilio has on file).
  // When behind a tunnel, req.protocol/host may be the proxy's; use configured public URL so validation succeeds.
  const path = req.originalUrl || req.url || '';
  let fullUrl;
  if (process.env.TUNNEL_DOMAIN) {
    fullUrl = `https://${process.env.TUNNEL_DOMAIN.replace(/^https?:\/\//, '')}${path}`;
  } else if (process.env.BASE_URL) {
    const base = process.env.BASE_URL.replace(/\/$/, '');
    fullUrl = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  } else {
    const protocol = req.protocol || 'https';
    const host = req.get('host') || '';
    fullUrl = `${protocol}://${host}${path}`;
  }

  // POST body (form params) or GET query
  const params = req.method === 'GET' ? req.query : (req.body || {});

  const isValid = twilio.validateRequest(authToken, signature, fullUrl, params);
  if (!isValid) {
    return res.status(403).json({ error: 'Invalid signature' });
  }
  next();
}
