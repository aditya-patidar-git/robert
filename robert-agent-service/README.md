# Robert Voice Agent Service

Independent agent service for real-time call handling with direct tool integration. This service handles all Twilio media streams, WebSocket connections, and OpenAI Realtime API interactions, while fetching configurations dynamically from MongoDB.

## Features

- Real-time call handling via Twilio Media Streams
- Dynamic configuration fetching from MongoDB (updates every 30 seconds)
- Per-number profile support
- Direct tool integration (web search, calendar, email, CRM, payments, file search, transfer call)
- OpenAI Realtime API integration with configurable voice, temperature, and VAD settings
- Confidence threshold checking via uncertainty gate

## Architecture

```
robert-agent-service/
├── src/
│   ├── agent/               # Main agent service
│   ├── tools/               # All tools (webSearch, calendar, email, crm, payments, fileSearch, transferCall)
│   ├── handlers/            # Call handlers
│   ├── database/            # MongoDB models and connection
│   ├── utils/               # Utilities
│   └── shared/              # Shared state
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

3. Configure environment variables:
- `MONGO_URI` - MongoDB connection string (shared with admin portal)
- `TWILIO_SID` - Twilio Account SID
- `TWILIO_AUTH_TOKEN` - Twilio Auth Token
- `TWILIO_NUMBER` - Twilio phone number
- `OPENAI_API_KEY` - OpenAI API key
- `CONSENT_LLM_CLASSIFY_ENABLED` - Set to `false` to disable GPT-based recording consent when transcript regex misses (default: on when API key present; max 3 calls per consent wait)
- `CONSENT_LLM_MODEL` - Classifier model (default: `gpt-4o-mini`)
- `TRANSCRIPT_EN_ENABLED` - Set to `false` to skip storing English translations on call transcripts (`transcriptEn` in MongoDB). When not `false`, each persisted user/agent line is translated via Chat Completions (requires `OPENAI_API_KEY`).
- `TRANSCRIPT_EN_MODEL` - Model for transcript English (default: `gpt-4o-mini`)
- `DOMAIN` - Tunnel domain (ngrok/cloudflare) for WebSocket
- `PORT` - Service port (default: 3002)

4. Start the agent service:
```bash
npm run start:agent
```

## Configuration

The agent service automatically fetches configurations from MongoDB:
- **AIConfig**: Voice, temperature, instructions, model settings
- **AudioConfig**: VAD thresholds, padding, per-number profiles
- **TelephonyConfig**: Phone numbers, routing settings

Configurations are cached for 30 seconds and automatically refreshed. Changes made in the admin portal will be picked up by the agent service within 30 seconds.

## API Endpoints

- `GET /` - Health check
- `POST /api/outbound/make-call` - Initiate outbound calls
- `POST /api/outbound/ai-intro` - TwiML for call initiation
- `GET /api/outbound/get-all-calls` - Get all call records
- `POST /api/outbound/call-status` - Call status callback
- `POST /api/outbound/recording-status` - Recording status callback
- `GET /api/outbound/recording/:callSid` - Proxy recording audio
- `GET /call?to=+1234567890` - Manual call trigger (testing)

## WebSocket

- `/media-stream` - Twilio Media Stream WebSocket endpoint

## Tools

The agent service includes direct tool integration:
- **web_search**: Search the web for time-sensitive information
- **calendar**: Manage calendar events and availability
- **email**: Send and manage emails
- **crm**: Access CRM system for customer management
- **payments**: Process payments and refunds
- **file_search**: Search the knowledge base for relevant information
- **transfer_call**: Transfer call to human agent (caller hears a short hold message, then instrumental hold from `public/audio/hold-music.mp3` via Conference `waitUrl` while the agent hears the handover summary; requires `TUNNEL_DOMAIN` or public `BASE_URL` for Twilio to fetch hold audio)

## Development

```bash
# Run in development mode with auto-reload
npm run dev:agent
```

## Notes

- The agent service runs independently from the admin portal
- Both services share the same MongoDB database
- Configurations are managed in the admin portal
- The agent service reads configurations (no write access needed)
- All call records are written to the shared database

