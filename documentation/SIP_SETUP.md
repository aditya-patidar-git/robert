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

1. **Log in to Twilio Console**
   - Navigate to: https://console.twilio.com/
   - Go to: Phone Numbers → SIP Trunking → Elastic SIP Trunks

2. **Create or Select SIP Trunk**
   - Click "Create new SIP Trunk" or select existing trunk
   - Name: "OpenAI Realtime SIP Trunk" (or your preferred name)

3. **Configure SIP Domain**
   - Create or select a SIP Domain
   - Note the SIP Domain URI (e.g., `your-domain.sip.twilio.com`)

4. **Add Origination SIP URI**
   - In SIP Trunk settings, go to "Origination" section
   - Add SIP URI: `sip:your-openai-sip-endpoint@openai.com`
   - Priority: 1
   - Weight: 1

5. **Configure Authentication** (if required by OpenAI)
   - Go to "Credential Lists" section
   - Create credential list if needed
   - Add username and password (if provided by OpenAI)
   - Attach credential list to SIP Trunk

### 2. OpenAI Realtime SIP Endpoint Setup

1. **Get OpenAI SIP Endpoint**
   - Contact OpenAI support or check OpenAI Realtime API documentation
   - Obtain SIP endpoint URI (format: `sip:endpoint@openai.com`)
   - Obtain authentication credentials if required

2. **Configure Webhook URL**
   - OpenAI will send `call.accept` webhook to your agent service
   - Webhook URL format: `https://your-domain.com/api/sip/call-accept`
   - Ensure webhook endpoint is publicly accessible
   - Configure authentication if required

### 3. Environment Variables

Add the following to your `.env` file:

```bash
# SIP Configuration
SIP_ENABLED=true
OPENAI_SIP_ENDPOINT=sip:your-endpoint@openai.com

# Optional: SIP Authentication
SIP_USERNAME=your-username
SIP_PASSWORD=your-password

# Webhook URL (for OpenAI callbacks)
BASE_URL=https://your-domain.com
TUNNEL_DOMAIN=your-domain.com
```

### 4. Telephony Configuration

Update your TelephonyConfig in the database:

```javascript
{
  sipSettings: {
    primaryPath: 'sip',  // or 'media-streams' to use Media Streams as primary
    enabled: true,
    endpoint: 'sip:your-endpoint@openai.com',
    retryAttempts: 3,
    retryDelay: 1000
  }
}
```

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

**Check:**
1. SIP_ENABLED is set to `true` in `.env`
2. OPENAI_SIP_ENDPOINT is correctly configured
3. Twilio SIP Trunk is properly configured
4. Webhook URL is publicly accessible
5. Check logs for validation errors

### Issue: SIP validation fails

**Check:**
1. SIP endpoint URL format is correct
2. Endpoint is accessible from your network
3. Authentication credentials are correct (if required)

### Issue: Calls falling back to Media Streams

**Check:**
1. SIP trunk routing is configured correctly in Twilio
2. OpenAI SIP endpoint is accepting connections
3. Check logs for specific error messages
4. Verify SIP session is being created

### Issue: SIP session not cleaning up

**Check:**
1. Session cleanup interval is running (check logs)
2. Terminal states are being detected correctly
3. Manual cleanup: `sipService.deleteSession(callId)`

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

