# Robert Voice Agent Service

Independent agent service with integrated MCP server for real-time call handling. This service handles all Twilio media streams, WebSocket connections, and OpenAI Realtime API interactions, while fetching configurations dynamically from MongoDB.

## Features

- Real-time call handling via Twilio Media Streams
- Dynamic configuration fetching from MongoDB (updates every 30 seconds)
- Per-number profile support
- Integrated MCP server with tools (web search, calendar, email, CRM, payments)
- OpenAI Realtime API integration with configurable voice, temperature, and VAD settings
- Confidence threshold checking via uncertainty gate

## Architecture

```
robert-agent-service/
├── src/
│   ├── mcp-server/          # MCP Server (stdio transport)
│   ├── agent/               # Main agent service
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
- `DOMAIN` - Tunnel domain (ngrok/cloudflare) for WebSocket
- `PORT` - Service port (default: 3002)

4. Start the agent service:
```bash
npm run start:agent
```

5. (Optional) Start MCP server separately:
```bash
npm run start:mcp
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

## MCP Server

The MCP server exposes:
- **Tools**: web_search, calendar, email, crm, payments
- **Resources**: config://ai, config://audio, config://telephony

Run with: `npm run start:mcp`

## Development

```bash
# Run in development mode with auto-reload
npm run dev:agent
npm run dev:mcp
```

## Notes

- The agent service runs independently from the admin portal
- Both services share the same MongoDB database
- Configurations are managed in the admin portal
- The agent service reads configurations (no write access needed)
- All call records are written to the shared database

