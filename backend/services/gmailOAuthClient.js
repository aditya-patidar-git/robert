import { OAuth2Client } from 'google-auth-library';
import * as gmailTokenStore from './gmailTokenStore.js';

const GMAIL_SCOPE = 'https://mail.google.com/';

function buildClient() {
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  const client = new OAuth2Client(clientId, clientSecret, redirectUri);
  return client;
}

export function getOAuth2Client() {
  return buildClient();
}

export function getAuthUrl(state = null) {
  const client = buildClient();
  if (!client) return null;
  const opts = {
    scope: GMAIL_SCOPE,
    access_type: 'offline',
    prompt: 'consent'
  };
  if (state != null) opts.state = state;
  return client.generateAuthUrl(opts);
}

export async function getValidAccessToken() {
  const tokens = gmailTokenStore.getTokens();
  if (!tokens?.refresh_token) return null;
  const client = buildClient();
  if (!client) return null;
  client.setCredentials({
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token ?? undefined,
    expiry_date: tokens.expiry ? new Date(tokens.expiry).getTime() : undefined
  });
  try {
    const res = await client.getAccessToken();
    const token = res.token ?? res.credentials?.access_token ?? client.credentials?.access_token;
    if (!token) return null;
    const creds = client.credentials;
    if (creds?.access_token || creds?.expiry_date) {
      gmailTokenStore.setTokens({
        access_token: creds.access_token ?? token,
        refresh_token: creds.refresh_token ?? tokens.refresh_token,
        expiry: creds.expiry_date ? new Date(creds.expiry_date).toISOString() : null
      });
    }
    return token;
  } catch {
    return null;
  }
}
