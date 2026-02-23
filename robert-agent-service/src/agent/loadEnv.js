/**
 * Load .env before any other application code runs.
 * Must be the first import in the entry point so process.env is populated
 * before tool/module singletons (e.g. FileSearchTool, WebSearchTool) read it.
 * Single responsibility: env loading only.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

// Industry standard: BASE_URL is the single source of truth. Derive other URLs so you change only one place when the tunnel/domain changes.
const baseUrl = process.env.BASE_URL?.trim()?.replace(/\/$/, '');
if (baseUrl) {
  try {
    const baseHost = new URL(baseUrl).host;
    if (!process.env.TUNNEL_DOMAIN) process.env.TUNNEL_DOMAIN = baseHost;
  } catch (_) { /* ignore invalid BASE_URL */ }
  if (!process.env.GMAIL_OAUTH_REDIRECT_URI) process.env.GMAIL_OAUTH_REDIRECT_URI = `${baseUrl}/api/gmail/oauth/callback`;
}
