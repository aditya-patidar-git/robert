/**
 * TLS enforcement: redirect HTTP to HTTPS and set HSTS when behind a proxy.
 * Enable with FORCE_HTTPS=1 or FORCE_HTTPS=true. Requires trust proxy.
 */

function isForceHttpsEnabled() {
  const v = process.env.FORCE_HTTPS;
  return v === '1' || v === 'true';
}

export default function forceHttpsMiddleware(req, res, next) {
  if (!isForceHttpsEnabled()) return next();
  const proto = req.get('X-Forwarded-Proto') || req.protocol || 'http';
  const host = req.get('X-Forwarded-Host') || req.get('host') || '';
  if (proto.toLowerCase() !== 'https') {
    const url = `https://${host}${req.originalUrl || '/'}`;
    return res.redirect(301, url);
  }
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}
