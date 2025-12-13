# Deployment Runbook - Robert Voice Agent

This runbook provides step-by-step procedures for deploying the Robert Voice Agent system to different environments.

## Pre-Deployment Checklist

### Environment Preparation

- [ ] Target environment identified (dev/staging/production)
- [ ] Environment variables documented and ready
- [ ] Database access verified
- [ ] External service credentials available (OpenAI, Twilio)
- [ ] Network access configured (firewall rules, DNS)
- [ ] SSL certificates obtained (for production)
- [ ] Monitoring and alerting configured
- [ ] Backup procedures tested

### Code Preparation

- [ ] All code changes reviewed and approved
- [ ] Tests passing (if applicable)
- [ ] Dependencies updated and compatible
- [ ] Environment-specific configurations identified
- [ ] Migration scripts prepared (if needed)

### Infrastructure Preparation

- [ ] Server resources allocated (CPU, memory, disk)
- [ ] MongoDB instance provisioned and accessible
- [ ] WebSocket tunnel configured (ngrok/cloudflare)
- [ ] Load balancer configured (if applicable)
- [ ] DNS records updated (if applicable)

## Environment Variable Setup

### Backend Environment Variables

Create `backend/.env` with:

```bash
# Database
MONGO_URI=mongodb://[host]:[port]/[database]

# Server
PORT=5000
FRONTEND_URL=https://your-frontend-domain.com

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_VECTOR_STORE_ID=vs_...
OPENAI_VECTOR_STORE_NAME=UNIVERSALAIDATABASE

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_NUMBER=+44...

# JWT
JWT_SECRET=[strong-random-secret]

# Optional: Web Search
BRAVE_SEARCH_API_KEY=...

# Optional: SIP
SIP_ENABLED=false
OPENAI_SIP_ENDPOINT=sip:...

# Security
ENCRYPTION_KEY=[strong-random-key]
```

### Frontend Environment Variables

Create `frontend/.env` (optional, can use defaults):

```bash
VITE_API_URL=https://your-backend-domain.com
```

### Agent Service Environment Variables

Create `robert-agent-service/.env` with:

```bash
# Database (shared with backend)
MONGO_URI=mongodb://[host]:[port]/[database]

# Service
PORT=3002
TUNNEL_DOMAIN=your-domain.ngrok.io  # or your custom domain

# Twilio
TWILIO_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_NUMBER=+44...

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_VECTOR_STORE_ID=vs_...
OPENAI_VECTOR_STORE_NAME=UNIVERSALAIDATABASE

# CRM (Browser Agent)
CRM_LOGIN_URL=https://takeabyte.co.uk/InContact/Account/Login
CRM_USERNAME=universalmct
CRM_PASSWORD=...
CRM_USER_AGENT=auagent

# Optional: SIP
SIP_ENABLED=false
OPENAI_SIP_ENDPOINT=sip:...
```

## Database Migration Steps

### Initial Setup

1. **Connect to MongoDB:**
   ```bash
   mongosh "mongodb://[host]:[port]/[database]"
   ```

2. **Verify Connection:**
   ```javascript
   db.adminCommand('ping')
   ```

3. **Create Indexes (if needed):**
   - Indexes are created automatically by Mongoose models
   - Verify with: `db.collection.getIndexes()`

### Data Migration (if applicable)

1. **Export from Source:**
   ```bash
   mongodump --uri="[source-uri]" --out=/backup/migration
   ```

2. **Import to Target:**
   ```bash
   mongorestore --uri="[target-uri]" /backup/migration
   ```

3. **Verify Data:**
   ```javascript
   // Check document counts
   db.users.countDocuments()
   db.callRecords.countDocuments()
   // etc.
   ```

### Schema Updates

- Mongoose handles schema migrations automatically
- Review model changes before deployment
- Test migrations in staging first

## Service Deployment Order

### 1. Backend Service

**Steps:**
1. Stop existing backend service (if running)
2. Pull latest code: `git pull origin main`
3. Install dependencies: `npm install`
4. Set environment variables in `.env`
5. Start service: `node server.js` or use PM2/systemd
6. Verify health: `curl http://localhost:5000/`
7. Check logs for errors

**PM2 Example:**
```bash
pm2 start server.js --name robert-backend
pm2 save
```

**Systemd Example:**
```ini
[Unit]
Description=Robert Backend Service
After=network.target

[Service]
Type=simple
User=robert
WorkingDirectory=/opt/robert/backend
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

### 2. Frontend Service

**Steps:**
1. Stop existing frontend service (if running)
2. Pull latest code: `git pull origin main`
3. Install dependencies: `npm install`
4. Build production bundle: `npm run build`
5. Serve static files (nginx, Apache, or Node.js)
6. Verify accessibility: Open in browser
7. Test API connectivity

**Nginx Configuration Example:**
```nginx
server {
    listen 80;
    server_name your-frontend-domain.com;
    root /opt/robert/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**Node.js Serve Example:**
```bash
npm install -g serve
serve -s dist -l 3000
```

### 3. Agent Service

**Steps:**
1. Stop existing agent service (if running)
2. Pull latest code: `git pull origin main`
3. Install dependencies: `npm install`
4. Set environment variables in `.env`
5. Verify TUNNEL_DOMAIN is accessible
6. Start service: `npm run start:agent` or use PM2/systemd
7. Verify health: `curl http://localhost:3002/`
8. Check logs for initialization success

**PM2 Example:**
```bash
pm2 start src/agent/index.js --name robert-agent
pm2 save
```

**Important:** Agent service must be accessible via public URL for Twilio WebSocket connections.

## Post-Deployment Verification

### Backend Verification

1. **Health Check:**
   ```bash
   curl http://localhost:5000/
   # Expected: "Robert AI backend alive"
   ```

2. **Database Connection:**
   - Check logs for: `✅ [backend] Connected to MongoDB database`
   - Verify no connection errors

3. **API Endpoints:**
   ```bash
   # Test auth endpoint
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test"}'
   ```

4. **Config Loading:**
   - Check logs for service initialization
   - Verify configs loaded from database

### Frontend Verification

1. **Accessibility:**
   - Open frontend URL in browser
   - Verify page loads without errors

2. **API Connection:**
   - Check browser console for API errors
   - Verify login functionality works
   - Test dashboard loads

3. **Build Verification:**
   - Check for console errors
   - Verify all assets load
   - Test responsive design

### Agent Service Verification

1. **Health Check:**
   ```bash
   curl http://localhost:3002/
   # Expected: JSON with service status
   ```

2. **Secrets Validation:**
   - Check logs for: `✅ Secrets Manager initialized successfully`
   - Verify no missing secrets errors

3. **Config Loading:**
   - Check logs for: `✅ ConfigManager initialized`
   - Verify all configs loaded (AI, Audio, Telephony, Tools)

4. **WebSocket Test:**
   - Use test endpoint: `GET http://localhost:3002/test-websocket`
   - Verify WebSocket connection works

5. **Test Call:**
   ```bash
   # Make test call
   curl "http://localhost:3002/call?to=+1234567890"
   # Verify call connects and agent responds
   ```

### Integration Verification

1. **End-to-End Test:**
   - Make test call to Twilio number
   - Verify call connects
   - Verify agent responds
   - Verify call recording (if enabled)

2. **Admin Portal Test:**
   - Login to admin portal
   - Verify dashboard loads
   - Test configuration changes
   - Verify changes reflect in agent service

3. **CRM Integration Test:**
   - Test booking creation via call
   - Verify browser agent works
   - Check screenshots captured

## Rollback Procedures

### Quick Rollback (Code Only)

1. **Stop Services:**
   ```bash
   pm2 stop robert-backend robert-agent
   # or systemctl stop robert-backend robert-agent
   ```

2. **Revert Code:**
   ```bash
   git checkout [previous-commit-hash]
   npm install  # If dependencies changed
   ```

3. **Restart Services:**
   ```bash
   pm2 restart robert-backend robert-agent
   ```

### Full Rollback (Code + Database)

1. **Stop All Services:**
   ```bash
   pm2 stop all
   ```

2. **Restore Database:**
   ```bash
   mongorestore --uri="[mongo-uri]" /backup/pre-deployment-backup
   ```

3. **Revert Code:**
   ```bash
   git checkout [previous-commit-hash]
   npm install
   ```

4. **Restart Services:**
   ```bash
   pm2 restart all
   ```

5. **Verify Rollback:**
   - Check health endpoints
   - Test critical functionality
   - Verify data integrity

### Rollback Verification Checklist

- [ ] Services start successfully
- [ ] Health checks pass
- [ ] Database connection works
- [ ] API endpoints respond
- [ ] Test call connects
- [ ] Admin portal accessible
- [ ] No critical errors in logs

## Environment-Specific Configurations

### Development Environment

**Characteristics:**
- Local development
- Debug logging enabled
- Relaxed security (CORS, etc.)
- Test credentials

**Configuration:**
```bash
NODE_ENV=development
LOG_LEVEL=debug
FRONTEND_URL=http://localhost:3000
```

### Staging Environment

**Characteristics:**
- Production-like setup
- Real credentials (test accounts)
- Monitoring enabled
- Staging database

**Configuration:**
```bash
NODE_ENV=staging
LOG_LEVEL=info
FRONTEND_URL=https://staging.yourdomain.com
```

### Production Environment

**Characteristics:**
- Production credentials
- Full security enabled
- Monitoring and alerting
- Production database
- SSL/TLS required

**Configuration:**
```bash
NODE_ENV=production
LOG_LEVEL=info
FRONTEND_URL=https://yourdomain.com
# All production secrets
# SSL certificates configured
```

## Deployment Best Practices

### Version Control

- Tag releases: `git tag v1.0.0`
- Use semantic versioning
- Document changes in CHANGELOG.md

### Deployment Strategy

**Blue-Green Deployment (Recommended):**
1. Deploy new version to "green" environment
2. Test green environment
3. Switch traffic to green
4. Keep "blue" as backup for quick rollback

**Rolling Deployment:**
1. Deploy to subset of servers
2. Verify functionality
3. Gradually deploy to remaining servers

### Monitoring During Deployment

- Monitor error rates
- Watch for increased latency
- Check resource usage
- Verify call success rates
- Monitor database connections

### Communication

- Notify team of deployment window
- Post deployment status updates
- Document any issues encountered
- Update runbook with lessons learned

## Troubleshooting Deployment Issues

### Issue: Service won't start

**Check:**
1. Environment variables set correctly
2. Port not already in use
3. Dependencies installed
4. Database accessible
5. File permissions correct

### Issue: Database connection fails

**Check:**
1. MongoDB running and accessible
2. MONGO_URI format correct
3. Network connectivity
4. Firewall rules
5. Credentials correct

### Issue: Frontend can't connect to backend

**Check:**
1. Backend running and healthy
2. CORS configuration
3. FRONTEND_URL matches actual URL
4. Network connectivity
5. SSL certificates (if HTTPS)

### Issue: Agent service not receiving calls

**Check:**
1. TUNNEL_DOMAIN accessible
2. WebSocket URL correct in Twilio
3. Agent service running
4. Twilio credentials correct
5. Firewall rules for WebSocket

## Post-Deployment Tasks

### Immediate (Within 1 hour)

- [ ] Verify all health checks pass
- [ ] Test critical functionality
- [ ] Monitor error logs
- [ ] Check system metrics
- [ ] Verify monitoring alerts configured

### Short-term (Within 24 hours)

- [ ] Review deployment logs
- [ ] Monitor performance metrics
- [ ] Check user feedback
- [ ] Verify backup procedures
- [ ] Update documentation if needed

### Long-term (Within 1 week)

- [ ] Performance analysis
- [ ] Security review
- [ ] Cost analysis
- [ ] User acceptance testing
- [ ] Documentation updates

## Additional Resources

- **Operations Guide:** See `docs/OPERATIONS_GUIDE.md`
- **Security Audit:** See `docs/SECURITY_AUDIT.md`
- **Testing Guide:** See `robert-agent-service/TESTING_GUIDE.md`

