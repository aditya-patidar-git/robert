import express from 'express';
import { getOAuth2Client, getAuthUrl } from '../services/gmailOAuthClient.js';
import * as gmailTokenStore from '../services/gmailTokenStore.js';
import emailService from '../services/emailService.js';

const router = express.Router();

router.get('/auth', (req, res) => {
  const url = getAuthUrl(req.query.state ?? undefined);
  if (!url) {
    res.status(503).json({
      success: false,
      error: 'Gmail OAuth not configured. Set GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET, and GMAIL_OAUTH_REDIRECT_URI.'
    });
    return;
  }
  res.redirect(url);
});

router.get('/oauth/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) {
    const html = `<!DOCTYPE html><html><body><p>Authorization failed: ${error}</p></body></html>`;
    res.status(400).send(html);
    return;
  }
  if (!code) {
    res.status(400).json({ success: false, error: 'Missing code' });
    return;
  }
  const client = getOAuth2Client();
  if (!client) {
    res.status(503).json({
      success: false,
      error: 'Gmail OAuth not configured.'
    });
    return;
  }
  try {
    const response = await client.getToken(code);
    const tokens = response.tokens || response.credentials || {};
    gmailTokenStore.setTokens({
      access_token: tokens.access_token ?? null,
      refresh_token: tokens.refresh_token ?? null,
      expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null
    });
    if (typeof emailService.reinitializeTransporter === 'function') {
      emailService.reinitializeTransporter();
    }
    const accept = req.headers.accept || '';
    if (accept.includes('application/json')) {
      res.json({ success: true, message: 'Gmail connected' });
      return;
    }
    res.send(
      '<!DOCTYPE html><html><body><p>Gmail connected. You can close this tab.</p></body></html>'
    );
  } catch (err) {
    console.error('Gmail OAuth callback error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
