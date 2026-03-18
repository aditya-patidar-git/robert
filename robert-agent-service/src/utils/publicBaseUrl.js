/**
 * Base URL Twilio can reach (tunnel or public HTTPS).
 * Used for Conference waitUrl and static hold audio.
 */
export function getPublicBaseUrlForTwilio() {
  if (process.env.TUNNEL_DOMAIN) {
    const host = process.env.TUNNEL_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${host}`;
  }
  const base = (process.env.BASE_URL || '').replace(/\/$/, '');
  if (base.startsWith('https://') && !/localhost|127\.0\.0\.1/i.test(base)) {
    return base;
  }
  return null;
}
