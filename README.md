# 🤖 Robert - Universal Motorcycle Training AI Phone Agent

Production-grade speech-to-speech AI phone answering system built with OpenAI Realtime API, Twilio, and Playwright for CRM automation.

## ✨ Features

- **Real-Time Voice AI**: Full-duplex speech-to-speech with barge-in and VAD
- **Multilingual**: Auto language detection (EN, FR, DE, ES, IT, PT, NL, PL)
- **Knowledge Base**: OpenAI File Search over UMT policies and training materials
- **Browser Agent**: Automated CRM bookings via Playwright (ITM, Gear Conversion, CBT)
- **MCP Tools**: Web search, calendar, email integrations
- **GDPR Compliant**: PII masking, DSAR support, consent management
- **Admin Console**: Web UI for prompts, voices, KB, monitoring

## 🛠️ Tech Stack

**Backend**: Node.js 18+, Express.js, MongoDB, OpenAI API, Twilio, Playwright  
**Frontend**: React 19, Vite, Material-UI, TanStack Query

## 🚀 Quick Start

# Clone repository
git clone <repository-url>
cd robert

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Install Playwright browsers
cd ../backend && npx playwright install chromium

# Configure environment
cp backend/env.example backend/.env
# Edit backend/.env with your credentials

# Start services
cd backend && npm start  # Terminal 1
cd frontend && npm run dev  # Terminal 2
cd robert-agent-service && npm run start:agent  # Terminal 3 (agent)
# Access admin console at http://localhost:3000

## Environment (key variables)
- **Frontend**: `VITE_API_BASE` – backend URL for REST and Socket.IO (default in code: `http://localhost:5000`).
- **Backend**: `AGENT_SERVICE_API_KEY` (optional) – when set, `/api/booking` and `/api/itm-booking` require `X-API-Key` or `Authorization: Bearer <key>`.
- **Agent**: `BACKEND_URL` – backend URL for track-crm etc. (default: `http://localhost:5000`). `AGENT_SERVICE_API_KEY` – same as backend when API key is enabled.

📚 Key API Endpoints

- `POST /api/inbound/handle-call` - Handle incoming call
- `POST /api/outbound/make-call` - Initiate outbound call
- `GET /api/transcript/:callSid` - Get call transcript
- `POST /api/kb/search` - Search knowledge base
- `POST /api/booking/itm/test` - Test ITM booking
- `GET /api/admin/ai/config` - Get AI configuration
- `GET /api/dashboard/metrics` - Get metrics

## 🧪 Testing

# Unit tests (Jest, from repo root)
npm run test:unit

# Coverage
npm run test:coverage

# Integration tests (real Twilio/OpenAI; set RUN_INTEGRATION_TESTS=1 and credentials)
npm run test:integration

# Frontend tests
cd frontend && npm test

# Legacy acceptance tests (archived)
npm run test:acceptance

See [tests/README.md](tests/README.md) for structure and CI.## 🔒 Security

- Secrets via environment variables (never hardcoded)
- JWT authentication with Argon2 hashing
- RBAC (admin, supervisor, agent, read-only)
- PII masking in logs/transcripts
- GDPR-compliant retention and DSAR support
- **Audit log retention**: Logs are retained for `AUDIT_LOG_RETENTION_DAYS` (default 365). Call `POST /api/admin/audit/retention-run` (e.g. from cron) to delete older audit log entries.

## 📖 Documentation

- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime)
- [ITM Booking Guide](./1_Introduction_to_Motorcycling_ITM.txt)
- [Gear Conversion Guide](./2_Gear_Conversion.txt)
- [System Prompt](./prompt_2.txt)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

ISC License

---

**Built for Universal Motorcycle Training** | [Issues](https://github.com/your-repo/issues) | [Documentation](./docs)
