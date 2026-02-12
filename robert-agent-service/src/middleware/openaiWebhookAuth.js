/**
 * OpenAI Realtime SIP webhook authentication.
 * OpenAI does not document webhook signature verification; this middleware supports
 * IP allowlisting via OPENAI_WEBHOOK_IP_ALLOWLIST (comma-separated IPs or CIDRs).
 * If the env is set, only requests from those IPs are allowed; otherwise all are allowed
 * (operators should set the allowlist in production).
 */
function parseAllowlist(value) {
  if (!value || typeof value !== 'string') return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

function ipMatches(ip, allowed) {
  if (!ip) return false;
  for (const entry of allowed) {
    if (entry.includes('/')) {
      // Simple CIDR check: for now support single IPs only; could add cidr-matcher for full CIDR
      const [range] = entry.split('/');
      if (ip === range) return true;
    } else {
      if (ip === entry) return true;
    }
  }
  return false;
}

/**
 * Middleware that allows requests only from OPENAI_WEBHOOK_IP_ALLOWLIST when set.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function openaiWebhookAuth(req, res, next) {
  const allowlist = parseAllowlist(process.env.OPENAI_WEBHOOK_IP_ALLOWLIST);
  if (allowlist.length === 0) {
    return next();
  }
  const clientIp = req.ip || req.connection?.remoteAddress || '';
  const allowed = ipMatches(clientIp, allowlist);
  if (!allowed) {
    console.warn(`[OpenAI webhook] Rejected request from IP ${clientIp} (not in allowlist)`);
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
