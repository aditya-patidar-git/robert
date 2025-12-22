# Admin Guide - Robert Voice Agent

This guide provides comprehensive instructions for administrators using the Robert Voice Agent admin portal.

## Table of Contents

1. [System Overview](#system-overview)
2. [Getting Started](#getting-started)
3. [Admin Portal Navigation](#admin-portal-navigation)
4. [Configuration Management](#configuration-management)
5. [Knowledge Base Management](#knowledge-base-management)
6. [Call Monitoring and Observability](#call-monitoring-and-observability)
7. [User Management](#user-management)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)

## System Overview

### Architecture

The Robert Voice Agent system consists of three main components:

1. **Backend Service** (Port 5000)
   - RESTful API server
   - MongoDB database
   - Configuration management
   - Authentication and authorization

2. **Frontend Admin Portal** (Port 3000)
   - Web-based administration interface
   - Real-time configuration updates
   - Monitoring and observability dashboards

3. **Agent Service** (Port 3002)
   - Real-time call handling
   - OpenAI Realtime API integration
   - Browser automation for CRM tasks
   - WebSocket connections for live calls

### Key Features

- **AI-Powered Voice Agent**: Handles customer calls using OpenAI's Realtime API
- **CRM Integration**: Automated booking and customer management via browser automation
- **Knowledge Base**: Vector-based knowledge retrieval for accurate responses
- **Call Monitoring**: Real-time observability and call analytics
- **Configuration Management**: Dynamic configuration without service restarts
- **SIP Integration**: Support for SIP-based telephony (v1.1)

## Getting Started

### Accessing the Admin Portal

1. Navigate to the admin portal URL (typically `http://localhost:3000` in development)
2. Log in with your administrator credentials
3. You'll be redirected to the dashboard

### Initial Setup

Before using the system, ensure:

1. **Backend Service** is running and connected to MongoDB
2. **Agent Service** is running and connected to OpenAI
3. **Twilio** credentials are configured
4. **Environment Variables** are properly set (see Operations Guide)

### First-Time Configuration

1. **Configure AI Model**: Go to AI & Knowledge Base → AI Configuration
   - Select primary AI model
   - Configure voice settings
   - Set up fallback chain

2. **Configure Audio Settings**: Go to Audio & Telephony → Audio Settings
   - Set VAD thresholds
   - Configure audio quality
   - Select transcription model

3. **Configure Telephony**: Go to Audio & Telephony → Telephony Routing
   - Add phone numbers
   - Configure routing rules
   - Set up transfer numbers

4. **Upload Knowledge Base**: Go to AI & Knowledge Base → Knowledge Base Management
   - Upload PDF, HTML, or Markdown files
   - Tag files appropriately
   - Verify ingestion status

## Admin Portal Navigation

### Main Pages

The admin portal consists of the following main pages:

#### 1. Dashboard
- System overview and health status
- Quick access to key features
- Recent activity summary

#### 2. AI & Knowledge Base (`/kb`)
**Tabs:**
- **Knowledge Base Management**: Upload, manage, and organize KB files
- **AI Configuration**: Configure AI models, prompts, and voices
- **System Operations**: Prompt versioning and flow parameters
- **Analytics & Monitoring**: KB usage analytics

**Key Features:**
- File upload (PDF, HTML, Markdown, Plain Text)
- File search and filtering
- Tag management
- Drift detection
- Prompt versioning with rollback
- Flow parameter overrides

#### 3. Audio & Telephony (`/audio-telephony`)
**Tabs:**
- **Audio Settings**: VAD thresholds, padding, audio quality, transcription model
- **Voice Management**: Model selection, voice configuration, language mapping
- **Telephony Routing**: Phone number management, routing rules, transfer numbers
- **SIP Configuration**: SIP endpoint settings, credentials, connection status
- **Call Quality**: Call quality metrics and settings

**Key Features:**
- Real-time audio configuration
- Voice preview and testing
- Phone number CRUD operations
- SIP connection testing
- Call quality monitoring

#### 4. System Configuration (`/system`)
**Tabs:**
- **MCP Tools**: Enable/disable and configure MCP tools
- **CRM Tasks**: Configure CRM automation tasks
- **General Settings**: System-wide settings
- **Conversation Behavior**: Conversation flow parameters
- **Email Test**: Test email functionality
- **Payment Gateway**: Payment gateway configuration
- **Email/SMS Templates**: Manage communication templates

**Key Features:**
- Tool enable/disable toggles
- Rate limiting configuration
- CRM task configuration
- Email/SMS template management

#### 5. Observability (`/observability`)
**Tabs:**
- **Metrics & Logs**: System metrics, error logs, performance data
- **Live Calls**: Real-time call monitoring
- **Error Budgets**: SLO/SLI tracking
- **Alerts**: System alerts and notifications

**Key Features:**
- Real-time metrics dashboard
- Call timeline visualization
- Tool execution traces
- Alert management
- Data export capabilities

#### 6. Privacy (`/privacy`)
- GDPR compliance settings
- Data retention policies
- PII handling configuration
- Data export and deletion

### Navigation Tips

- **Config Sync Status**: Most pages show a config sync status indicator at the top
- **Save Buttons**: Configuration changes require clicking "Save Configuration" button
- **Tabs**: Use tabs to navigate between related settings within a page
- **Dialogs**: Many actions open dialogs for detailed configuration

## Configuration Management

### AI Configuration

**Location:** AI & Knowledge Base → AI Configuration

#### Primary Model Selection

1. Select the primary AI model from the dropdown
2. Choose a compatible voice for the model
3. Configure model parameters:
   - **Temperature**: Controls randomness (0.0-2.0, default: 0.4)
   - **Top P**: Nucleus sampling (0.0-1.0, default: 1.0)
   - **Max Tokens**: Maximum response length (50-500, default: 150)
   - **Speech Rate**: Voice speed multiplier (0.5-2.0, default: 1.0)

#### Fallback Chain

Configure a fallback chain for model redundancy:

1. Add models to the fallback chain in order of preference
2. The system will automatically switch if the primary model fails
3. Drag and drop to reorder models

#### Global Prompt

Edit the global system prompt that guides the AI's behavior:

- Use clear, specific instructions
- Include examples when helpful
- Test changes in a staging environment first
- Use prompt versioning for safe rollbacks

#### Uncertainty Gate

Configure the uncertainty gate to improve response quality:

- **Enabled**: Toggle uncertainty checking
- **Confidence Threshold**: Minimum confidence level (0.0-1.0, default: 0.8)
- **Min Sources**: Minimum number of KB sources required

### Audio Configuration

**Location:** Audio & Telephony → Audio Settings

#### Voice Activity Detection (VAD)

- **VAD Threshold**: Time in milliseconds before speech is considered ended (100-2000ms, default: 500ms)
- **Start Padding**: Audio captured before speech detection (0-1000ms, default: 250ms)
- **End Padding**: Audio captured after speech ends (0-1500ms, default: 300ms)

#### Audio Quality Settings

- **Audio Quality**: Standard, High, or Premium
- **Noise Suppression**: Enable/disable with algorithm selection (Basic, RNNoise, WebRTC)
- **Echo Cancellation**: Enable/disable AEC
- **Automatic Gain Control**: Enable/disable AGC

#### Energy Threshold

- **Auto-calibrate**: Automatically adjust threshold per call (recommended)
- **Manual Threshold**: Set fixed threshold (0-100) if auto-calibrate is disabled

#### Transcription Model Selection

Choose the transcription model for speech-to-text:

- **Whisper-1**: Standard transcription model (default)
- **GPT-4o Transcribe**: Enhanced accuracy and context understanding

### Telephony Configuration

**Location:** Audio & Telephony → Telephony Routing

#### Phone Number Management

**Add Phone Number:**
1. Click "Add Phone Number" button
2. Enter phone number (E.164 format)
3. Configure routing settings:
   - **Primary Route**: Direct to agent or IVR
   - **Transfer Numbers**: Numbers to transfer calls to
   - **Business Hours**: When calls are accepted
4. Save configuration

**Edit/Delete:**
- Click edit icon to modify settings
- Click delete icon to remove number (with confirmation)

#### Transfer Numbers

Configure numbers for call transfers:

1. Add transfer numbers with labels
2. Set priority order
3. Configure transfer conditions

#### SIP Configuration

**Location:** Audio & Telephony → SIP Configuration

**Basic Settings:**
- **Enable OpenAI SIP**: Toggle SIP integration
- **Primary Path**: SIP or Media Streams
- **Fallback Path**: Backup path if primary fails
- **Codec**: Audio codec (Opus recommended)
- **Region**: Deployment region

**Credentials:**
- **OpenAI SIP Endpoint**: SIP endpoint URL
- **OpenAI SIP Webhook URL**: Webhook for SIP events
- **Twilio SIP Trunk SID**: Twilio trunk identifier
- **Twilio SIP Username/Password**: Authentication credentials

**Connection Status:**
- Test SIP connection
- View connection status
- Monitor connection health

### Tool Configuration

**Location:** System Configuration → MCP Tools

#### Enable/Disable Tools

Toggle tools on/off as needed:

- **crm_browser**: CRM automation (booking, customer management)
- **check_availability**: Course availability checking
- **send_email**: Email sending
- **send_sms**: SMS sending
- **payments**: Payment processing

#### Rate Limiting

Configure rate limits for each tool:

- **Requests per minute**: Maximum requests allowed
- **Tokens per minute**: Token usage limits (if applicable)

### CRM Tasks Configuration

**Location:** System Configuration → CRM Tasks

Configure which CRM tasks are enabled:

- **Create Booking**: Enable booking creation
- **Update Customer**: Enable customer updates
- **Check Availability**: Enable availability checking
- **Send Confirmation**: Enable confirmation emails/SMS

## Knowledge Base Management

**Location:** AI & Knowledge Base → Knowledge Base Management

### Uploading Files

1. Click "Upload File" button
2. Select file (PDF, HTML, Markdown, or Plain Text)
3. Add title and tags
4. Click "Upload"
5. Wait for processing (status shown in file list)

### File Management

**View File:**
- Click file name to view content
- View metadata and ingestion status

**Edit Tags:**
- Click tag icon to edit tags
- Add or remove tags
- Tags help with file organization and retrieval

**Reingest File:**
- Click reingest icon to update file in vector store
- Use when file content has changed

**Detect Drift:**
- Click drift detection icon
- Compares file content with source website
- Shows drift score and status

**Delete File:**
- Click delete icon
- Confirmation required
- Removes file from KB and vector store

### File Search

Use the search bar to find files:

- Search by title or content
- Filter by tags
- Filter by status (Active, Processing, Error, Inactive)

### Drift Detection

**Manual Detection:**
- Click "Detect Drift" on individual files
- View drift score and comparison

**Automatic Detection:**
- Configure file-URL mappings
- Schedule automatic drift checks
- Receive alerts for stale files

### Prompt Versioning

**Location:** AI & Knowledge Base → System Operations

**View Versions:**
- See all prompt versions with timestamps
- View version details and changes

**Compare Versions:**
- Select two versions to compare
- See diff of changes

**Rollback:**
- Rollback to previous version
- Confirmation required
- Immediate effect

**Edit Version:**
- Edit existing version (creates new version)
- Add version notes

## Call Monitoring and Observability

**Location:** Observability

### Metrics Dashboard

View real-time system metrics:

- **Call Volume**: Calls per time period
- **Success Rate**: Percentage of successful calls
- **Average Duration**: Average call length
- **Error Rate**: Percentage of failed calls
- **Latency**: Response time metrics

### Live Calls

Monitor active calls in real-time:

- View all active calls
- See call details (SID, duration, status)
- View call timeline
- Monitor tool executions

### Error Logs

View and filter error logs:

- Filter by log level (Error, Warning, Info, Debug)
- Filter by time range
- Search logs
- Export logs for analysis

### Alerts

Manage system alerts:

- View active alerts
- Filter by severity (Critical, Warning, Info)
- Acknowledge alerts
- Resolve alerts
- View alert history

### Call Timeline

View detailed call timeline:

1. Click "View Timeline" on a call
2. See chronological events:
   - Call start/end
   - AI responses
   - Tool executions
   - Errors and warnings

### Tool Traces

View tool execution traces:

1. Click "View Tool Traces" on a call
2. See all tool calls:
   - Tool name
   - Parameters
   - Results
   - Execution time
   - Errors

## User Management

### Authentication

- Login with username and password
- JWT token-based authentication
- Session management
- Logout functionality

### User Roles

**Owner:**
- Full system access
- Can modify all configurations
- Can manage users

**Admin:**
- Configuration access
- Monitoring access
- Limited user management

**Viewer:**
- Read-only access
- Can view configurations and metrics
- Cannot make changes

### User Permissions

Permissions are role-based:

- **Configuration Changes**: Owner and Admin only
- **User Management**: Owner only
- **Viewing**: All roles
- **Export**: Owner and Admin only

## Troubleshooting

### Common Issues

#### Configuration Not Saving

**Symptoms:**
- Changes not persisting
- "Save Configuration" button not working

**Solutions:**
1. Check browser console for errors
2. Verify backend service is running
3. Check network connectivity
4. Verify user permissions
5. Check MongoDB connection

#### Knowledge Base Files Not Processing

**Symptoms:**
- Files stuck in "Processing" status
- Files showing "Error" status

**Solutions:**
1. Check file format (PDF, HTML, Markdown, Plain Text only)
2. Verify file size (check limits)
3. Check OpenAI API key and quota
4. Review error logs in Observability
5. Try reingesting the file

#### Calls Not Connecting

**Symptoms:**
- Calls not reaching agent
- WebSocket connection errors

**Solutions:**
1. Verify Agent Service is running
2. Check Twilio credentials
3. Verify WebSocket URL is accessible
4. Check firewall settings
5. Review Agent Service logs

#### Audio Quality Issues

**Symptoms:**
- Poor audio quality
- Echo or noise

**Solutions:**
1. Adjust VAD thresholds
2. Enable noise suppression
3. Enable echo cancellation
4. Adjust audio quality setting
5. Test with different voices

#### Model Not Responding

**Symptoms:**
- AI not generating responses
- Timeout errors

**Solutions:**
1. Check OpenAI API key and quota
2. Verify model is available
3. Check fallback chain configuration
4. Review error logs
5. Test with different model

### Getting Help

1. **Check Logs**: Review logs in Observability page
2. **Review Documentation**: Consult Operations Guide
3. **Check Status**: Verify all services are running
4. **Contact Support**: Reach out to development team with:
   - Error messages
   - Steps to reproduce
   - Relevant logs
   - System configuration

## Best Practices

### Configuration Changes

1. **Test in Staging First**: Always test changes in a non-production environment
2. **Use Prompt Versioning**: Use versioning for prompt changes to enable rollback
3. **Monitor After Changes**: Watch metrics after making changes
4. **Document Changes**: Keep notes on configuration changes
5. **Backup Before Major Changes**: Create backups before major updates

### Knowledge Base Management

1. **Organize with Tags**: Use consistent tagging strategy
2. **Regular Updates**: Keep KB files up to date
3. **Monitor Drift**: Regularly check for content drift
4. **Test After Upload**: Verify files are properly ingested
5. **Clean Up**: Remove outdated or duplicate files

### Monitoring

1. **Set Up Alerts**: Configure alerts for critical issues
2. **Regular Reviews**: Review metrics and logs regularly
3. **Track Trends**: Monitor trends over time
4. **Export Data**: Export data for analysis
5. **Document Incidents**: Keep records of incidents and resolutions

### Security

1. **Strong Passwords**: Use strong, unique passwords
2. **Regular Updates**: Keep system updated
3. **Access Control**: Limit access to necessary users
4. **Audit Logs**: Review audit logs regularly
5. **Secrets Management**: Use proper secrets management (AWS/Vault)

### Performance

1. **Optimize Prompts**: Keep prompts concise and clear
2. **Monitor Token Usage**: Track token consumption
3. **Optimize KB**: Remove unnecessary KB files
4. **Cache Configuration**: Leverage configuration caching
5. **Load Testing**: Perform load testing before production

## Additional Resources

- **Operations Guide**: See `documentation/OPERATIONS_GUIDE.md` for operational procedures
- **Security Audit**: See `documentation/SECURITY_AUDIT.md` for security information
- **SIP Setup**: See `documentation/SIP_SETUP.md` for SIP configuration
- **Deployment Runbook**: See `documentation/DEPLOYMENT_RUNBOOK.md` for deployment procedures

## Support

For additional support or questions:

1. Review this guide and Operations Guide
2. Check system logs and observability dashboards
3. Contact the development team with specific issues
4. Include error messages, logs, and steps to reproduce

---

**Last Updated:** January 2025  
**Version:** 1.0

