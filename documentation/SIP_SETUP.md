# SIP Setup Guide

This guide explains how to configure Twilio Elastic SIP Trunk to route calls to OpenAI Realtime SIP endpoint.

## Overview

The SIP integration allows calls to be routed directly from Twilio Elastic SIP Trunk to OpenAI Realtime SIP endpoint, bypassing the Media Streams WebSocket path. This provides lower latency and better call quality for production use.

**Current Status:** SIP infrastructure is implemented and ready. Media Streams remains the default/fallback path until SIP trunk is fully configured.

## Prerequisites

- Twilio account with Elastic SIP Trunk enabled
- OpenAI API key with Realtime API access
- Publicly accessible webhook endpoint for OpenAI SIP callbacks
- Agent service running and accessible

## Configuration Steps

### 1. Twilio Elastic SIP Trunk Setup

#### Step 1.1: Access Twilio Console

1. **Log in to Twilio Console**
   - Navigate to: https://console.twilio.com/
   - Sign in with your Twilio account credentials

#### Step 1.2: Navigate to SIP Trunking

1. In the left sidebar, click on **"Phone Numbers"**
2. In the dropdown menu, select **"SIP Trunking"**
3. Click on **"Elastic SIP Trunks"** from the submenu
4. You should see a list of existing SIP trunks (if any)

#### Step 1.3: Create New SIP Trunk

1. Click the **"+ Create new SIP Trunk"** button (usually in the top right)
2. Enter a friendly name: **"OpenAI Realtime SIP Trunk"** (or your preferred name)
3. Click **"Create"**
4. **Important:** Note the **SIP Trunk SID** (starts with `TK...`) - you'll need this for `TWILIO_SIP_TRUNK_SID` environment variable

#### Step 1.4: Configure SIP Domain

1. In the SIP Trunk details page, scroll to **"SIP Domain"** section
2. If you don't have a SIP Domain:
   - Click **"Create new SIP Domain"**
   - Enter a domain name (e.g., `robert-ai`)
   - Click **"Create"**
3. If you have an existing domain, select it from the dropdown
4. **Note the SIP Domain URI** (format: `your-domain.sip.twilio.com`)

#### Step 1.5: Configure Origination (Route to OpenAI)

1. In the SIP Trunk details page, find the **"Origination"** section
2. Click **"Add Origination URI"** or **"Edit"** if one exists
3. Enter the following:
   - **SIP URI:** `sip:your-openai-sip-endpoint@openai.com` (replace with actual OpenAI SIP endpoint)
   - **Priority:** `1`
   - **Weight:** `1`
4. Click **"Save"**

**Note:** The actual OpenAI SIP endpoint URI will be provided by OpenAI. Contact OpenAI support or check OpenAI Realtime API documentation for the exact endpoint format.

#### Step 1.6: Configure Authentication (if required)

1. In the SIP Trunk details page, find the **"Credential Lists"** section
2. If OpenAI requires authentication:
   - Click **"Create new Credential List"** (if needed)
   - Enter a name: **"OpenAI SIP Credentials"**
   - Click **"Create"**
   - Add credentials:
     - Click **"Add Credential"**
     - **Username:** (provided by OpenAI or from `SIP_AUTH_USERNAME` env var)
     - **Password:** (provided by OpenAI or from `SIP_AUTH_PASSWORD` env var)
     - Click **"Save"**
   - Attach the credential list to the SIP Trunk:
     - In SIP Trunk settings, select the credential list from dropdown
     - Click **"Save"**

#### Step 1.7: Configure Inbound Routing (for inbound calls)

1. In the SIP Trunk details page, find the **"Inbound"** section
2. For inbound calls to route to OpenAI:
   - Set **"Inbound SIP URI"** to your OpenAI SIP endpoint
   - Or configure to route to your webhook endpoint if OpenAI requires it

#### Step 1.8: Save SIP Trunk SID

1. After creating the trunk, copy the **SIP Trunk SID** (starts with `TK...`)
2. Add this to your `.env` file as `TWILIO_SIP_TRUNK_SID=TK...`

### 2. OpenAI Realtime SIP Endpoint Setup

#### Step 2.1: Obtain OpenAI SIP Endpoint

1. **Contact OpenAI Support**
   - Email OpenAI support or check your OpenAI account dashboard
   - Request access to OpenAI Realtime SIP endpoint
   - Provide your use case and requirements

2. **Get SIP Endpoint Details**
   - OpenAI will provide:
     - **SIP Endpoint URI** (format: `sip:endpoint-id@openai.com` or similar)
     - **Authentication credentials** (username/password, if required)
     - **Webhook configuration requirements**

3. **Verify Endpoint Format**
   - SIP URI should follow SIP standard format: `sip:identifier@domain`
   - Example: `sip:your-account-id@realtime.openai.com`
   - Note: Actual format may vary - use exactly what OpenAI provides

#### Step 2.2: Configure Webhook URL

1. **Determine Your Webhook URL**
   - Format: `https://your-domain.com/api/sip/call-accept`
   - Replace `your-domain.com` with your actual domain
   - Example: `https://robert-agent.example.com/api/sip/call-accept`

2. **Ensure Public Accessibility**
   - Webhook must be accessible from the internet
   - Test with: `curl https://your-domain.com/api/sip/call-accept`
   - Should return a response (even if 404, confirms endpoint is reachable)

3. **Configure in OpenAI Dashboard** (if required)
   - Some OpenAI configurations may require webhook URL registration
   - Check OpenAI documentation for webhook configuration steps
   - Provide the webhook URL to OpenAI support if needed

4. **Test Webhook Connectivity**
   - Use a tool like `ngrok` for local testing: `ngrok http 3002`
   - Update webhook URL temporarily to ngrok URL for testing
   - Once verified, update to production URL

### 3. Environment Variables

Add the following to your `.env` file in the `robert-agent-service` directory:

```bash
# SIP Configuration
SIP_ENABLED=true
OPENAI_SIP_ENDPOINT=sip:your-endpoint-id@openai.com

# Twilio SIP Trunk Configuration
TWILIO_SIP_TRUNK_SID=TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional: SIP Authentication (if required by OpenAI)
SIP_AUTH_USERNAME=your-username
SIP_AUTH_PASSWORD=your-password

# Webhook URL (for OpenAI callbacks)
BASE_URL=https://your-domain.com
TUNNEL_DOMAIN=your-domain.com

# Existing Twilio Configuration (should already be set)
TWILIO_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_NUMBER=+442045726060
```

**Important Notes:**
- Replace `your-endpoint-id@openai.com` with the actual SIP endpoint provided by OpenAI
- Replace `TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` with your actual SIP Trunk SID from Twilio
- `SIP_AUTH_USERNAME` and `SIP_AUTH_PASSWORD` are only needed if OpenAI requires authentication
- `BASE_URL` or `TUNNEL_DOMAIN` must be set for webhook callbacks to work

### 4. Telephony Configuration

Update your TelephonyConfig in the database via Admin Portal or directly:

#### Via Admin Portal:

1. Navigate to **Audio & Telephony** → **SIP Configuration** tab
2. Set **Primary Path** to `sip`
3. Enable **OpenAI SIP** toggle
4. Enter **OpenAI SIP Endpoint** (from Step 2.1)
5. Enter **Twilio SIP Trunk SID** (from Step 1.3)
6. Enter **SIP Username** and **SIP Password** (if required)
7. Set **Webhook URL** (from Step 2.2)
8. Click **"Test Connection"** to validate
9. Click **"Save"**

#### Via Database (Direct):

```javascript
{
  sipSettings: {
    primaryPath: 'sip',  // Set to 'sip' to make SIP primary, 'media_streams' for fallback
    fallbackPath: 'media_streams',  // Fallback if SIP fails
    openaiSipEnabled: true,
    openaiSipEndpoint: 'sip:your-endpoint-id@openai.com',
    openaiSipWebhookUrl: 'https://your-domain.com/api/sip/call-accept',
    twilioSipTrunkSid: 'TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    twilioSipUsername: 'your-username',  // Optional
    twilioSipPassword: 'your-password',  // Optional, encrypted
    testConnectionStatus: 'not_tested'  // Will be updated after testing
  }
}
```

**Note:** After configuration, the system will automatically:
- Validate SIP endpoint on startup
- Use SIP as primary path for calls
- Fallback to Media Streams if SIP fails

## Testing

### 1. Test SIP Endpoint Validation

The system automatically validates the SIP endpoint on startup. Check logs for:

```
✅ SIP endpoint validated successfully
```

If validation fails:
```
⚠️ SIP endpoint validation failed: [error message]
```

### 2. Test Incoming SIP Call

1. Make a test call to your Twilio number
2. Check logs for:
   ```
   📞 [SIP] Call accept webhook received - call_id: [id], from: [number], to: [number]
   ✅ [SIP] Call accept configured for call_id: [id]
   ```

3. Verify SIP session created:
   ```
   ✅ [SIP] Session created: [call_id]
   📞 [SIP] Call [call_id]: accepted
   ```

### 3. Test Fallback to Media Streams

If SIP fails, the system should automatically fallback to Media Streams:

```
⚠️ [SIP] SIP routing failed, falling back to Media Streams for [number]
📞 [Media Streams] Using Media Streams fallback for [number]
```

## Monitoring

### Session Management

Check active SIP sessions:

```javascript
const sipService = require('./services/sipService.js');
const stats = sipService.getStats();
console.log(stats);
// Output: { activeSessions: 2, isEnabled: true, endpoint: 'configured' }
```

### Status Tracking

SIP status changes are automatically tracked. Check logs for status transitions:

```
📞 [SIP] Call [call_id]: initiated
📞 [SIP] Call [call_id]: accepted
📞 [SIP] Call [call_id]: in-progress
📞 [SIP] Call [call_id]: completed
```

## Troubleshooting

### Issue: SIP calls not connecting

**Symptoms:**
- Calls always use Media Streams
- Logs show "SIP routing failed, falling back to Media Streams"

**Check:**
1. Verify `SIP_ENABLED=true` in `.env` file
2. Verify `OPENAI_SIP_ENDPOINT` is correctly formatted (starts with `sip:`)
3. Verify `TWILIO_SIP_TRUNK_SID` is set and correct
4. Check Twilio Console → SIP Trunk → Origination URI is configured
5. Verify webhook URL is publicly accessible: `curl https://your-domain.com/api/sip/call-accept`
6. Check agent service logs for validation errors on startup
7. Verify TelephonyConfig has `sipSettings.primaryPath = 'sip'`

**Resolution:**
- Run health check: `curl http://localhost:3002/` and check `sip.valid` field
- Review startup logs for SIP validation results
- Test SIP endpoint format: should match `sip:identifier@domain` pattern

### Issue: SIP validation fails on startup

**Symptoms:**
- Logs show: `❌ SIP configuration validation failed`
- Health check shows `sip.valid: false`

**Check:**
1. SIP endpoint URL format is correct (must start with `sip:`)
2. Endpoint follows SIP URI standard format
3. No typos in endpoint string
4. Environment variables are loaded correctly

**Resolution:**
- Verify endpoint format: `sip:your-endpoint@openai.com` (or format provided by OpenAI)
- Check `.env` file is in correct location (`robert-agent-service/.env`)
- Restart agent service after updating `.env`
- Check logs for specific validation error message

### Issue: Calls falling back to Media Streams

**Symptoms:**
- SIP is enabled but calls use Media Streams
- Logs show fallback messages

**Check:**
1. Twilio SIP Trunk Origination URI points to OpenAI SIP endpoint
2. OpenAI SIP endpoint is accepting connections (contact OpenAI support)
3. Check Twilio Console → Monitor → Logs for SIP connection errors
4. Verify SIP session is being created (check logs for "Session created")
5. Check if `shouldUseSip()` returns true (check telephony config)

**Resolution:**
- Verify Twilio SIP Trunk configuration in Twilio Console
- Test SIP endpoint connectivity (may require OpenAI support)
- Check agent service logs for specific error: `grep -i "sip" logs/*.log`
- Verify TelephonyConfig `sipSettings.primaryPath` is set to `'sip'`

### Issue: SIP session not cleaning up

**Symptoms:**
- Active SIP sessions accumulate
- Memory usage increases over time

**Check:**
1. Session cleanup interval is running (check logs for cleanup messages)
2. Terminal states (completed, failed, canceled) are being detected
3. Call status webhooks are being received from OpenAI
4. Check `sipService.getStats()` for active session count

**Resolution:**
- Check session cleanup logs: should see periodic cleanup messages
- Verify call status webhooks are configured correctly
- Manual cleanup: Use admin API or directly call `sipService.deleteSession(callId)`
- Restart agent service to clear in-memory sessions (if needed)

### Issue: Webhook not receiving call.accept

**Symptoms:**
- SIP calls connect but no `call.accept` webhook received
- SIP sessions not being created

**Check:**
1. Webhook URL is publicly accessible (test with curl)
2. Webhook endpoint `/api/sip/call-accept` exists and is working
3. OpenAI has correct webhook URL configured
4. Firewall/security groups allow incoming webhook requests
5. Check agent service logs for incoming webhook requests

**Resolution:**
- Test webhook endpoint: `curl -X POST https://your-domain.com/api/sip/call-accept -d '{"call_id":"test"}'`
- Verify webhook URL in OpenAI configuration matches your domain
- Check nginx/reverse proxy configuration allows POST to `/api/sip/*`
- Review agent service logs for webhook request attempts

## Architecture

```
Twilio Elastic SIP Trunk
    ↓
OpenAI Realtime SIP Endpoint
    ↓
call.accept webhook → Agent Service
    ↓
SIP Session Created
    ↓
Call Handled via OpenAI Realtime API
```

## Fallback Behavior

The system is designed to gracefully fallback to Media Streams if:
- SIP is not enabled
- SIP endpoint validation fails
- SIP routing fails after retries
- SIP connection errors occur

Media Streams remains fully functional and is the default path until SIP is fully configured.

## Next Steps

1. Configure Twilio Elastic SIP Trunk (steps 1-2 above)
2. Set environment variables (step 3)
3. Update TelephonyConfig (step 4)
4. Test incoming calls (Testing section)
5. Monitor SIP sessions and status
6. Once verified, set `primaryPath: 'sip'` in TelephonyConfig

## Support

For issues or questions:
- Check logs in `robert-agent-service` for SIP-related messages
- Review Twilio SIP Trunk logs in Twilio Console
- Contact OpenAI support for SIP endpoint issues
- Refer to Phase 2 implementation documentation

