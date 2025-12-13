# Operations Guide - Robert Voice Agent

This guide provides operational procedures for running and maintaining the Robert Voice Agent system.

## System Architecture

The system consists of three main services:
1. **Backend** - Admin portal API server (Port 5000)
2. **Frontend** - Admin portal web interface (Port 3000)
3. **Agent Service** - Real-time call handling service (Port 3002)

## Service Startup Procedures

### Backend Service

**Location:** `backend/` directory

**Start Command:**
```bash
cd backend
npm install  # First time only
node server.js
```

**Environment Variables Required:**
- `MONGO_URI` - MongoDB connection string
- `PORT` - Server port (default: 5000)
- `FRONTEND_URL` - Frontend URL for CORS
- `OPENAI_API_KEY` - OpenAI API key
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_NUMBER` - Twilio phone number
- `JWT_SECRET` - JWT signing secret

**Health Check:**
- Endpoint: `GET http://localhost:5000/`
- Expected: `"Robert AI backend alive"`

**Startup Verification:**
- Check logs for: `✅ [backend] Connected to MongoDB database`
- Check logs for: `✅ Server running on port 5000`
- Verify no errors in console

### Frontend Service

**Location:** `frontend/` directory

**Start Command:**
```bash
cd frontend
npm install  # First time only
npm run dev
```

**Environment Variables:**
- `VITE_API_URL` - Backend API URL (default: http://localhost:5000)

**Health Check:**
- Open browser: `http://localhost:3000`
- Should display login page or dashboard

**Startup Verification:**
- Check browser console for errors
- Verify API connection to backend

### Agent Service

**Location:** `robert-agent-service/` directory

**Start Command:**
```bash
cd robert-agent-service
npm install  # First time only
npm run start:agent
```

**Development Mode (with auto-reload):**
```bash
npm run dev:agent
```

**Environment Variables Required:**
- `MONGO_URI` - MongoDB connection string (shared with backend)
- `PORT` - Service port (default: 3002)
- `TWILIO_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_NUMBER` - Twilio phone number
- `OPENAI_API_KEY` - OpenAI API key
- `TUNNEL_DOMAIN` - Public domain for WebSocket (ngrok/cloudflare)
- `OPENAI_VECTOR_STORE_ID` - Vector store ID for KB
- `OPENAI_VECTOR_STORE_NAME` - Vector store name

**Health Check:**
- Endpoint: `GET http://localhost:3002/`
- Expected: JSON with service status and configs

**Startup Verification:**
- Check logs for: `✅ Secrets Manager initialized successfully`
- Check logs for: `✅ ConfigManager initialized and polling every 30 seconds`
- Check logs for: `🤖 ROBERT VOICE AGENT SERVICE READY`
- Verify all configs loaded (AI, Audio, Telephony, Tools)

## Health Check Endpoints

### Backend Health
- **URL:** `GET /`
- **Response:** `"Robert AI backend alive"`
- **Status Codes:** 200 = healthy

### Agent Service Health
- **URL:** `GET http://localhost:3002/`
- **Response:** JSON with service status
- **Fields:**
  - `status`: "ok"
  - `service`: "robert-voice-agent"
  - `configs`: Status of loaded configs
  - `websocket`: WebSocket URL and status

## Monitoring

### Key Metrics to Monitor

1. **Call Metrics:**
   - Active calls count
   - Call success rate
   - Average call duration
   - Call pickup latency

2. **System Metrics:**
   - CPU and memory usage
   - Database connection pool
   - WebSocket connections
   - API response times

3. **Error Metrics:**
   - Error rate by type
   - Failed tool executions
   - OpenAI API errors
   - Twilio API errors

### Log Locations

- **Backend Logs:** Console output (stdout)
- **Frontend Logs:** Browser console + build logs
- **Agent Service Logs:** Console output (stdout)
- **Audit Logs:** `backend/audit-logs/` (JSON files by date)
- **Screenshots:** `robert-agent-service/screenshots/` (browser automation)
- **Call Recordings:** Stored via Twilio (if enabled)

### Log Analysis

**Common Log Patterns:**
- `✅` - Success operations
- `❌` - Errors
- `⚠️` - Warnings
- `📞` - Call-related events
- `🔧` - Tool executions
- `🌐` - Browser automation

**Search Logs For:**
- Error patterns: `grep "❌" logs.txt`
- Call issues: `grep "📞.*error" logs.txt`
- Tool failures: `grep "🔧.*failed" logs.txt`

## Common Troubleshooting Scenarios

### Issue: Backend won't start

**Symptoms:**
- Port already in use error
- MongoDB connection failed

**Solutions:**
1. Check if port 5000 is in use: `lsof -i :5000` (Linux/Mac) or `netstat -ano | findstr :5000` (Windows)
2. Kill process or change PORT in .env
3. Verify MongoDB is running: `mongosh` or check MongoDB service
4. Verify MONGO_URI is correct in .env

### Issue: Frontend can't connect to backend

**Symptoms:**
- CORS errors in browser console
- Network errors when making API calls

**Solutions:**
1. Verify backend is running on correct port
2. Check FRONTEND_URL in backend .env matches frontend URL
3. Verify CORS configuration in backend/server.js
4. Check browser console for specific error messages

### Issue: Agent service not receiving calls

**Symptoms:**
- Calls not connecting
- WebSocket connection failures

**Solutions:**
1. Verify TUNNEL_DOMAIN is set and accessible
2. Check WebSocket URL in Twilio console
3. Verify agent service is running and healthy
4. Check firewall rules for WebSocket port
5. Verify Twilio credentials are correct

### Issue: OpenAI API errors

**Symptoms:**
- 401 Unauthorized errors
- Rate limit errors (429)
- 500 Internal Server errors

**Solutions:**
1. Verify OPENAI_API_KEY is set and valid
2. Check API key permissions and quotas
3. Implement retry logic (already in place)
4. Check OpenAI status page for outages
5. Review rate limits in OpenAI dashboard

### Issue: Database connection issues

**Symptoms:**
- MongoDB connection errors
- Timeout errors
- Connection pool exhausted

**Solutions:**
1. Verify MongoDB is running
2. Check MONGO_URI format and credentials
3. Verify network connectivity to MongoDB
4. Check MongoDB connection pool settings
5. Review MongoDB logs for errors

### Issue: Browser agent failures

**Symptoms:**
- CRM booking failures
- Timeout errors
- Screenshot errors

**Solutions:**
1. Verify CRM credentials in .env
2. Check CRM website accessibility
3. Review screenshots in `screenshots/` directory
4. Check browser agent logs for specific errors
5. Verify Playwright is installed: `npx playwright install`

## Configuration Management

### Environment Variables

All services use `.env` files for configuration. See `backend/env.example` for reference.

**Key Configuration Files:**
- `backend/.env` - Backend configuration
- `frontend/.env` - Frontend configuration (optional)
- `robert-agent-service/.env` - Agent service configuration

### Dynamic Configuration

The system uses MongoDB for dynamic configuration:
- **AIConfig** - AI model settings, prompts, voices
- **AudioConfig** - VAD thresholds, padding, audio quality
- **TelephonyConfig** - Phone numbers, routing, SIP settings
- **ToolConfig** - Tool enable/disable, rate limits
- **PrivacyConfig** - GDPR settings, retention policies

**Config Updates:**
- Changes in admin portal are saved to MongoDB
- Agent service polls for updates every 30 seconds
- No service restart required for config changes

### Secret Rotation

**Current Implementation:**
- Secrets stored in environment variables
- No automatic rotation (manual process)

**Rotation Procedure:**
1. Update secret in environment variable
2. Restart affected service(s)
3. Verify service starts successfully
4. Test functionality with new secret

**Future Enhancement:**
- AWS Secrets Manager integration (placeholder in secretsManager.js)
- Automatic secret rotation
- Secret versioning

## Performance Tuning

### Database Optimization

**MongoDB Indexes:**
- Ensure indexes exist on frequently queried fields
- Check index usage with `db.collection.getIndexes()`
- Monitor slow queries

**Connection Pool:**
- Default MongoDB connection pool: 10
- Adjust based on concurrent call volume
- Monitor connection pool usage

### Memory Management

**Session Cleanup:**
- Sessions automatically cleaned up after TTL (default: 60 minutes)
- Configurable via `SESSION_TTL_MINUTES`
- Max sessions enforced (default: 100)

**Token Management:**
- Automatic truncation when approaching limits
- Summarization strategy for old messages
- Configurable thresholds in TokenManagementService

### Call Handling

**Concurrent Calls:**
- Default max: 50 concurrent calls
- Adjustable via `MAX_CONCURRENT_CALLS`
- Monitor system resources under load

**WebSocket Management:**
- Each call uses one WebSocket connection
- Connections cleaned up on call end
- Monitor WebSocket connection count

## Backup and Recovery

### Database Backups

**MongoDB Backup:**
```bash
# Create backup
mongodump --uri="mongodb://localhost:27017/robert-ai" --out=/backup/robert-ai-$(date +%Y%m%d)

# Restore backup
mongorestore --uri="mongodb://localhost:27017/robert-ai" /backup/robert-ai-YYYYMMDD
```

**Backup Schedule:**
- Daily backups recommended
- Retain backups for 30 days minimum
- Test restore procedures regularly

### Configuration Backups

**Export Configurations:**
- Use admin portal to export configurations
- Or use MongoDB export for specific collections
- Store backups securely

### Recovery Procedures

**Service Recovery:**
1. Verify environment variables are set
2. Start services in order: Backend → Frontend → Agent Service
3. Verify health checks pass
4. Test with a sample call

**Database Recovery:**
1. Stop all services
2. Restore MongoDB from backup
3. Verify data integrity
4. Restart services
5. Test functionality

## Maintenance Windows

### Recommended Maintenance Schedule

**Daily:**
- Review error logs
- Check system health metrics
- Monitor call success rates

**Weekly:**
- Review audit logs
- Check database size and growth
- Review performance metrics
- Clean up old screenshots/recordings

**Monthly:**
- Database backup verification
- Security audit review
- Configuration review
- Dependency updates

### Zero-Downtime Updates

**Configuration Updates:**
- No downtime required
- Changes take effect within 30 seconds (polling interval)

**Code Updates:**
- Deploy new version
- Restart services (brief downtime)
- Or use blue-green deployment for zero downtime

## Support and Escalation

### Log Levels

- **ERROR** - Critical issues requiring immediate attention
- **WARN** - Issues that may cause problems
- **INFO** - Normal operational messages
- **DEBUG** - Detailed debugging information

### Escalation Path

1. **Level 1:** Check logs and common troubleshooting
2. **Level 2:** Review system metrics and health checks
3. **Level 3:** Contact development team with error logs
4. **Level 4:** Emergency escalation for production outages

### Useful Commands

```bash
# Check service status
curl http://localhost:5000/  # Backend
curl http://localhost:3002/  # Agent Service

# View recent logs
tail -f backend/logs.txt
tail -f robert-agent-service/logs.txt

# Check MongoDB connection
mongosh "mongodb://localhost:27017/robert-ai"

# Check process status
ps aux | grep node
```

## Additional Resources

- **Deployment Guide:** See `docs/DEPLOYMENT_RUNBOOK.md`
- **Security Audit:** See `docs/SECURITY_AUDIT.md`
- **SIP Setup:** See `docs/SIP_SETUP.md`
- **Testing Guide:** See `robert-agent-service/TESTING_GUIDE.md`

