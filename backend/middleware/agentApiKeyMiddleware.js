/**
 * Optional API key middleware for agent-only routes (e.g. /api/booking, /api/itm-booking).
 * If AGENT_SERVICE_API_KEY is set, requests must send X-API-Key or Authorization: Bearer <key>.
 * If not set, all requests are allowed (backward compatibility).
 */
export function agentApiKeyMiddleware(req, res, next) {
  const key = process.env.AGENT_SERVICE_API_KEY;
  if (!key || key.trim() === '') {
    return next();
  }

  const apiKey = req.headers['x-api-key'];
  const authHeader = req.headers.authorization;
  const bearerKey = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  const provided = apiKey || bearerKey;
  if (!provided || provided !== key.trim()) {
    return res.status(401).json({ message: 'Invalid or missing API key' });
  }

  next();
}
