import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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
  async createDSARRequest(requestData) {
    const dsarId = `dsar_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    const dsarRequest = {
      id: dsarId,
      requestorEmail: requestData.email,
      requestorName: requestData.name,
      requestType: requestData.type, // 'access', 'portability', 'deletion'
      status: 'pending',
      createdAt: new Date().toISOString(),
      requestedData: requestData.dataTypes || ['transcripts', 'recordings', 'metadata'],
      verificationRequired: true
    };

    await this.logAuditEvent('dsar_created', dsarRequest);
    return dsarRequest;
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
