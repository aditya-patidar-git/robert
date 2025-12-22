import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import DSARRequest from '../models/DSARRequest.js';
import CallRecord from '../models/callRecord.js';
import { createAuditLog } from '../controllers/auditLogController.js';
import nodemailer from 'nodemailer';

class GDPRService {
  constructor() {
    this.auditLogPath = './audit-logs';
    this.dataRetentionDays = {
      transcripts: 90,
      recordings: 90,
      metadata: 365,
      personalData: 365
    };
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.auditLogPath)) {
      fs.mkdirSync(this.auditLogPath, { recursive: true });
    }
  }

  // PII Detection and Masking
  detectPII(text) {
    const piiPatterns = {
      phone: /\b(?:\+44|0)[0-9]{10,11}\b/g,
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      creditCard: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,
      postcode: /\b[A-Z]{1,2}[0-9R][0-9A-Z]? [0-9][A-Z]{2}\b/g,
      nationalInsurance: /\b[A-Z]{2}[0-9]{6}[A-Z]\b/g,
      drivingLicense: /\b[A-Z]{5}[0-9]{6}[A-Z]{2}\b/g
    };

    const detectedPII = {};
    
    for (const [type, pattern] of Object.entries(piiPatterns)) {
      const matches = text.match(pattern);
      if (matches) {
        detectedPII[type] = matches;
      }
    }

    return detectedPII;
  }

  maskPII(text, maskType = 'partial') {
    // Handle non-string inputs
    if (typeof text !== 'string') {
        console.warn('maskPII received non-string input:', typeof text, text);
        return text || ''; // Return empty string if null/undefined, or original value
    }
    
    let maskedText = text;
    
    const patterns = {
      phone: /\b(?:\+44|0)[0-9]{10,11}\b/g,
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      creditCard: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,
      postcode: /\b[A-Z]{1,2}[0-9R][0-9A-Z]? [0-9][A-Z]{2}\b/g
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      maskedText = maskedText.replace(pattern, (match) => {
        switch (maskType) {
          case 'full':
            return `[${type.toUpperCase()}_REDACTED]`;
          case 'partial':
            return this.partialMask(match, type);
          default:
            return match;
        }
      });
    }

    return maskedText;
}

  partialMask(text, type) {
    switch (type) {
      case 'phone':
        return text.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2');
      case 'email':
        const [local, domain] = text.split('@');
        return `${local.charAt(0)}****@${domain}`;
      case 'creditCard':
        return text.replace(/\d(?=\d{4})/g, '*');
      default:
        return text.replace(/\w/g, '*');
    }
  }

  // Consent Management
  async recordConsent(callSid, consentType, granted, timestamp = new Date()) {
    const consentRecord = {
      callSid,
      consentType,
      granted,
      timestamp: timestamp.toISOString(),
      ipAddress: 'system', // Would be captured from request
      userAgent: 'robert-ai-system'
    };

    await this.logAuditEvent('consent_recorded', consentRecord);
    return consentRecord;
  }

  async checkConsent(callSid, consentType) {
    // In a real implementation, this would query a database
    // For now, return default consent status
    return {
      granted: true,
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    };
  }

  // DSAR (Data Subject Access Request) Management
  async createDSARRequest(requestorEmail, requestType, userIdentifier, requestorPhone = null) {
    const requestId = `DSAR-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    
    // Generate verification code
    const verificationCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    
    const dsarRequest = await DSARRequest.create({
      requestId,
      requestorEmail,
      requestorPhone,
      requestType,
      userIdentifier,
      verificationMethod: 'email',
      verificationCode,
      status: 'pending'
    });

    // Send verification email
    await this.sendVerificationEmail(requestorEmail, verificationCode, requestId);

    return dsarRequest;
  }

  async verifyDSARRequest(requestId, verificationCode) {
    const request = await DSARRequest.findOne({ requestId });
    
    if (!request) {
      throw new Error('DSAR request not found');
    }

    if (request.verificationCode !== verificationCode) {
      throw new Error('Invalid verification code');
    }

    if (request.verifiedAt) {
      throw new Error('Request already verified');
    }

    request.verifiedAt = new Date();
    request.status = 'processing';
    await request.save();

    return request;
  }

  async generateDSARExport(requestId, maskPII = false) {
    const request = await DSARRequest.findOne({ requestId });
    
    if (!request) {
      throw new Error('DSAR request not found');
    }

    if (request.status !== 'processing' && request.status !== 'pending') {
      throw new Error(`Request cannot be processed. Current status: ${request.status}`);
    }

    if (!request.verifiedAt) {
      throw new Error('Request must be verified before export');
    }

    // Collect all user data
    const userData = {
      userIdentifier: request.userIdentifier,
      callRecords: [],
      transcripts: [],
      recordings: [],
      metadata: {}
    };

    // Find all call records for this user
    const callRecords = await CallRecord.find({
      $or: [
        { from: request.userIdentifier },
        { to: request.userIdentifier },
        { 'transcript': { $regex: request.userIdentifier, $options: 'i' } }
      ]
    }).sort({ createdAt: -1 });

    for (const record of callRecords) {
      userData.callRecords.push({
        callSid: record.callSid,
        from: maskPII ? this.maskPII(record.from) : record.from,
        to: maskPII ? this.maskPII(record.to) : record.to,
        duration: record.duration,
        createdAt: record.createdAt,
        transcript: maskPII ? this.maskPII(record.transcript) : record.transcript,
        summary: maskPII ? this.maskPII(record.summary) : record.summary,
        recordingUrl: record.recordingUrl,
        language: record.language,
        entryPath: record.entryPath
      });
    }

    // Generate export file (JSON format)
    const exportData = JSON.stringify(userData, null, 2);
    const exportFileName = `dsar-export-${requestId}-${Date.now()}.json`;
    const exportPath = path.join(this.auditLogPath, 'exports', exportFileName);
    
    // Ensure exports directory exists
    const exportsDir = path.dirname(exportPath);
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    fs.writeFileSync(exportPath, exportData);

    // Generate secure download URL (in production, use S3 or similar)
    const exportUrl = `/api/gdpr/dsar/${requestId}/export/${exportFileName}`;
    const exportExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    request.exportUrl = exportUrl;
    request.exportExpiresAt = exportExpiresAt;
    request.status = 'completed';
    request.completedAt = new Date();
    await request.save();

    // Send notification email
    await this.sendExportReadyEmail(request.requestorEmail, requestId, exportUrl, exportExpiresAt);

    return {
      requestId,
      exportUrl,
      exportExpiresAt,
      recordCount: callRecords.length,
      fileSize: Buffer.byteLength(exportData)
    };
  }

  async deleteUserData(userIdentifier) {
    // Delete all call records for this user
    const deleteResult = await CallRecord.deleteMany({
      $or: [
        { from: userIdentifier },
        { to: userIdentifier }
      ]
    });

    return {
      userIdentifier,
      deletedRecords: deleteResult.deletedCount,
      deletedAt: new Date()
    };
  }

  async getDSARRequestStatus(requestId) {
    const request = await DSARRequest.findOne({ requestId })
      .populate('processedBy', 'email username');
    
    if (!request) {
      throw new Error('DSAR request not found');
    }

    return request;
  }

  async sendVerificationEmail(email, code, requestId) {
    // In production, use proper email service
    console.log(`📧 Verification email would be sent to ${email} with code ${code} for request ${requestId}`);
    // TODO: Implement actual email sending
  }

  async sendExportReadyEmail(email, requestId, exportUrl, expiresAt) {
    // In production, use proper email service
    console.log(`📧 Export ready email would be sent to ${email} for request ${requestId}`);
    // TODO: Implement actual email sending
  }

  async processDSARRequest(dsarId, action, adminUser) {
    const dsarRequest = {
      id: dsarId,
      action,
      processedBy: adminUser,
      processedAt: new Date().toISOString(),
      status: action === 'approve' ? 'approved' : 'rejected'
    };

    await this.logAuditEvent('dsar_processed', dsarRequest);
    return dsarRequest;
  }

  async exportUserData(userIdentifier, dataTypes = ['transcripts', 'recordings', 'metadata']) {
    const exportId = `export_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    // In a real implementation, this would query the database
    const userData = {
      exportId,
      userIdentifier,
      dataTypes,
      createdAt: new Date().toISOString(),
      status: 'processing',
      data: {
        transcripts: [], // Would contain actual transcript data
        recordings: [], // Would contain recording URLs
        metadata: {},   // Would contain call metadata
        personalInfo: {} // Would contain personal information
      }
    };

    await this.logAuditEvent('data_exported', { exportId, userIdentifier, dataTypes });
    return userData;
  }

  async deleteUserData(userIdentifier, dataTypes = ['all']) {
    const deletionId = `del_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    // In a real implementation, this would delete from database
    const deletionRecord = {
      deletionId,
      userIdentifier,
      dataTypes,
      deletedAt: new Date().toISOString(),
      status: 'completed',
      retentionCompliant: true
    };

    await this.logAuditEvent('data_deleted', deletionRecord);
    return deletionRecord;
  }

  // Data Retention Management
  async checkRetentionPolicies() {
    const now = new Date();
    const retentionChecks = {};

    for (const [dataType, days] of Object.entries(this.dataRetentionDays)) {
      const cutoffDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
      
      // In a real implementation, this would query the database
      retentionChecks[dataType] = {
        cutoffDate: cutoffDate.toISOString(),
        recordsToDelete: 0, // Would contain actual count
        lastCleanup: new Date().toISOString()
      };
    }

    return retentionChecks;
  }

  async cleanupExpiredData() {
    const retentionChecks = await this.checkRetentionPolicies();
    const cleanupResults = {};

    for (const [dataType, check] of Object.entries(retentionChecks)) {
      // In a real implementation, this would delete expired records
      cleanupResults[dataType] = {
        recordsDeleted: 0, // Would contain actual count
        cleanupDate: new Date().toISOString(),
        status: 'completed'
      };
    }

    await this.logAuditEvent('retention_cleanup', cleanupResults);
    return cleanupResults;
  }

  // Audit Logging
  async logAuditEvent(eventType, eventData) {
    const auditLog = {
      id: `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      eventType,
      eventData,
      timestamp: new Date().toISOString(),
      system: 'robert-ai'
    };

    const logFile = path.join(this.auditLogPath, `audit_${new Date().toISOString().split('T')[0]}.json`);
    
    try {
      let existingLogs = [];
      if (fs.existsSync(logFile)) {
        const fileContent = fs.readFileSync(logFile, 'utf8');
        existingLogs = JSON.parse(fileContent);
      }
      
      existingLogs.push(auditLog);
      fs.writeFileSync(logFile, JSON.stringify(existingLogs, null, 2));
      
      console.log(`📝 Audit log: ${eventType}`);
    } catch (error) {
      console.error('Audit logging error:', error);
    }
  }

  async getAuditLogs(filters = {}) {
    const { startDate, endDate, eventType, limit = 100 } = filters;
    
    // In a real implementation, this would query the audit database
    const mockAuditLogs = [
      {
        id: 'audit_001',
        eventType: 'consent_recorded',
        timestamp: new Date().toISOString(),
        eventData: { callSid: 'call_123', consentType: 'recording', granted: true }
      },
      {
        id: 'audit_002',
        eventType: 'data_exported',
        timestamp: new Date().toISOString(),
        eventData: { exportId: 'exp_001', userIdentifier: 'user_123' }
      }
    ];

    return mockAuditLogs;
  }

  async getDSARRequests(filters = {}) {
    const query = {};
    
    if (filters.status) {
      query.status = filters.status;
    }
    
    if (filters.requestType) {
      query.requestType = filters.requestType;
    }
    
    if (filters.requestorEmail) {
      query.requestorEmail = filters.requestorEmail;
    }

    const requests = await DSARRequest.find(query)
      .populate('processedBy', 'email username')
      .sort({ requestedAt: -1 })
      .limit(filters.limit || 100);

    return requests;
  }

  // Get full DSAR request details
  async getDSARRequestDetails(requestId) {
    const request = await DSARRequest.findOne({ requestId })
      .populate('processedBy', 'email username');
    
    if (!request) {
      throw new Error('DSAR request not found');
    }

    return request;
  }

  // Preview DSAR data before export
  async previewDSARData(userIdentifier, dataTypes = ['all']) {
    // In a real implementation, this would query actual data
    const preview = {
      userIdentifier,
      dataTypes,
      summary: {
        transcripts: 0,
        recordings: 0,
        metadata: 0,
        callRecords: 0
      },
      sampleData: {
        transcripts: [],
        recordings: [],
        metadata: [],
        callRecords: []
      }
    };

    // Mock data preview
    if (dataTypes.includes('all') || dataTypes.includes('transcripts')) {
      preview.summary.transcripts = 5; // Would be actual count
      preview.sampleData.transcripts = [
        { id: 'trans_001', date: new Date().toISOString(), duration: 120 }
      ];
    }

    if (dataTypes.includes('all') || dataTypes.includes('recordings')) {
      preview.summary.recordings = 3; // Would be actual count
      preview.sampleData.recordings = [
        { id: 'rec_001', date: new Date().toISOString(), duration: 120, size: 1024000 }
      ];
    }

    return preview;
  }

  // Get DSAR request timeline
  async getDSARRequestTimeline(dsarId) {
    const request = await this.getDSARRequestDetails(dsarId);
    
    // Build timeline from request and audit logs
    const timeline = [
      {
        event: 'request_created',
        timestamp: request.createdAt,
        description: 'DSAR request created',
        user: request.requestorEmail
      }
    ];

    // Add processing events if available
    if (request.status === 'completed') {
      timeline.push({
        event: 'request_processed',
        timestamp: request.updatedAt || request.createdAt,
        description: 'DSAR request processed',
        user: 'admin'
      });
    }

    return timeline;
  }


  // Privacy Impact Assessment
  async generatePrivacyImpactAssessment(processingActivity) {
    const pia = {
      id: `pia_${Date.now()}`,
      processingActivity,
      dataTypes: ['personal_data', 'call_recordings', 'transcripts'],
      lawfulBasis: ['consent', 'legitimate_interest'],
      dataSubjects: ['customers', 'prospects'],
      retentionPeriod: '90 days for recordings, 365 days for metadata',
      securityMeasures: [
        'encryption_at_rest',
        'encryption_in_transit',
        'access_controls',
        'audit_logging'
      ],
      risks: [
        'unauthorized_access',
        'data_breach',
        'excessive_retention'
      ],
      mitigations: [
        'strong_authentication',
        'regular_security_reviews',
        'automated_retention_cleanup'
      ],
      createdAt: new Date().toISOString()
    };

    await this.logAuditEvent('pia_generated', pia);
    return pia;
  }

  // Data Breach Management
  async reportDataBreach(breachData) {
    const breachId = `breach_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    const breachReport = {
      id: breachId,
      ...breachData,
      reportedAt: new Date().toISOString(),
      status: 'investigating',
      severity: breachData.severity || 'medium',
      affectedRecords: breachData.affectedRecords || 0,
      notificationRequired: breachData.affectedRecords > 100
    };

    await this.logAuditEvent('breach_reported', breachReport);
    return breachReport;
  }

  // Compliance Reporting
  async generateComplianceReport(period = 'monthly') {
    const report = {
      id: `compliance_${Date.now()}`,
      period,
      generatedAt: new Date().toISOString(),
      metrics: {
        totalCalls: 0, // Would be actual count
        consentRate: 0.95,
        dsarRequests: 0,
        dataExports: 0,
        dataDeletions: 0,
        retentionCleanups: 0,
        breaches: 0
      },
      complianceStatus: 'compliant',
      recommendations: [
        'Continue regular retention cleanup',
        'Monitor consent rates',
        'Review data processing activities'
      ]
    };

    await this.logAuditEvent('compliance_report_generated', report);
    return report;
  }
}

export default new GDPRService();
