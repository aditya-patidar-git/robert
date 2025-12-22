# Changelog

All notable changes to the Robert Voice Agent system will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Transcription model selection UI in Audio Settings (Whisper-1 and GPT-4o Transcribe)
- BaseBookingService abstract class for common booking workflow logic
- Unified Payment Handler supporting payment request links and Twilio Pay
- Admin Guide documentation
- Changelog documentation

### Changed
- Refactored all booking services (CBT, Private Lesson, CBT Executive, Gear Conversion, TfL 1-2-1, TfL Beyond CBT, Full Licence Assessment) to extend BaseBookingService
- Improved code reusability and modularization across booking services
- Enhanced error handling in booking workflows
- Updated AudioConfig schema to include transcriptionModel field

### Fixed
- Removed duplicate workflow code from booking services
- Fixed selectBookingOptions methods to only contain course-specific logic
- Improved payment confirmation handling in booking workflows

## [1.0.0] - 2025-01-15

### Added
- Initial release of Robert Voice Agent system
- Admin portal with comprehensive configuration management
- AI-powered voice agent using OpenAI Realtime API
- CRM integration via browser automation (Playwright)
- Knowledge Base management with vector store integration
- Call monitoring and observability dashboard
- SIP integration support (basic)
- Multiple course booking services:
  - ITM (Introduction to Motorcycling)
  - CBT (Compulsory Basic Training)
  - CBT Executive
  - Private Lesson
  - Gear Conversion
  - TfL 1-2-1
  - TfL Beyond CBT
  - Full Licence Assessment
- Payment processing support (payment request links)
- Email and SMS notification system
- User authentication and authorization
- Privacy and GDPR compliance features
- Model discovery service with hourly refresh
- Tool schema validation
- Abuse prevention service
- KB drift detection service (basic)

### Features
- **Admin Portal**: Web-based administration interface
- **AI Configuration**: Model selection, prompt management, voice configuration
- **Audio Configuration**: VAD settings, audio quality, transcription model selection
- **Telephony Configuration**: Phone number management, routing, SIP settings
- **Knowledge Base**: File upload, tagging, drift detection, vector store integration
- **Observability**: Real-time metrics, call monitoring, error tracking, alerts
- **System Configuration**: MCP tools, CRM tasks, general settings
- **Call Handling**: Real-time voice conversations with OpenAI Realtime API
- **CRM Automation**: Automated booking and customer management
- **Payment Processing**: Payment request link generation
- **Notifications**: Email and SMS confirmations

### Technical Details
- **Backend**: Node.js/Express API server
- **Frontend**: React with Material-UI
- **Agent Service**: Node.js service with Playwright automation
- **Database**: MongoDB
- **AI**: OpenAI Realtime API, GPT-4, Whisper
- **Telephony**: Twilio
- **Vector Store**: OpenAI Vector Store

## [0.9.0] - 2024-12-XX

### Added
- Initial development version
- Basic call handling
- Admin portal foundation
- Knowledge Base integration

---

## Version History

- **1.0.0**: Production-ready release with full feature set
- **0.9.0**: Development and testing phase

## Release Notes

### Version 1.0.0

This is the first production release of the Robert Voice Agent system. The system provides:

- Complete admin portal for configuration and monitoring
- AI-powered voice agent for customer calls
- Automated CRM integration for booking management
- Comprehensive knowledge base management
- Real-time observability and monitoring
- Support for multiple course types and booking workflows

### Upgrade Notes

For users upgrading from 0.9.0:

1. Update environment variables (see `backend/env.example`)
2. Run database migrations if any
3. Review configuration changes in admin portal
4. Test all booking workflows
5. Verify knowledge base files are properly ingested

### Breaking Changes

None in version 1.0.0 (first production release)

### Deprecations

None currently

### Security

- All secrets stored in environment variables
- JWT-based authentication
- PII masking in logs
- SSRF protection
- XSS protection via React and CSP
- Secure logging practices

---

**Note**: This changelog will be updated with each release. For detailed information about specific features, see the Admin Guide and Operations Guide.

