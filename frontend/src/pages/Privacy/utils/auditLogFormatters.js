/**
 * Audit Log Formatters
 * Provides user-friendly formatting for audit log details
 * Supports both MongoDB records (diff field) and GDPR events (eventData field)
 */

/**
 * Format event type into human-readable label
 * @param {string} eventType - The event type/action
 * @returns {string} Human-readable label
 */
export const formatEventTypeLabel = (eventType) => {
  const labels = {
    // GDPR Events
    'consent_recorded': 'Consent Recorded',
    'dsar_created': 'DSAR Request Created',
    'dsar_processed': 'DSAR Processed',
    'data_exported': 'Data Exported',
    'data_deleted': 'Data Deleted',
    'retention_cleanup': 'Retention Cleanup',
    'breach_reported': 'Breach Reported',
    'compliance_report_generated': 'Compliance Report',
    'pia_generated': 'Privacy Impact Assessment',
    
    // User Events
    'user.create': 'User Created',
    'user.update': 'User Updated',
    'user.delete': 'User Deleted',
    'user.approve': 'User Approved',
    'user.block': 'User Suspended',
    'user.exclude': 'User Suspended',
    
    // Auth Events
    'auth.login': 'Login',
    'auth.logout': 'Logout',
    'auth.login_failed': 'Login Failed',
    
    // Allowlist Events
    'allowlist.add': 'Allowlist Added',
    'allowlist.remove': 'Allowlist Removed'
  };
  
  return labels[eventType] || eventType?.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown';
};

/**
 * Get Chip color based on event type
 * @param {string} eventType - The event type/action
 * @returns {string} MUI color value
 */
export const getEventTypeColor = (eventType) => {
  const colorMap = {
    // Success/Positive events - green
    'consent_recorded': 'success',
    'auth.login': 'success',
    'user.approve': 'success',
    'allowlist.add': 'success',
    'compliance_report_generated': 'success',
    
    // Warning/Attention events - warning
    'auth.login_failed': 'warning',
    'retention_cleanup': 'warning',
    'user.block': 'warning',
    
    // Danger/Critical events - error
    'breach_reported': 'error',
    'data_deleted': 'error',
    'user.delete': 'error',
    'user.exclude': 'error',
    'allowlist.remove': 'error',
    
    // Info/Neutral events - info
    'dsar_created': 'info',
    'dsar_processed': 'info',
    'data_exported': 'info',
    'user.create': 'info',
    'user.update': 'info',
    'auth.logout': 'default',
    'pia_generated': 'info'
  };
  
  return colorMap[eventType] || 'default';
};

/**
 * Format audit log details into user-friendly text
 * @param {Object} log - The audit log entry
 * @returns {string} User-friendly description
 */
export const formatAuditDetails = (log) => {
  const eventType = log.eventType || log.action;
  const data = log.eventData || log.diff || log.details || log.metadata;
  
  if (!data && !eventType) return 'No details available';
  
  try {
    switch (eventType) {
      // Compliance Report
      case 'compliance_report_generated':
        return formatComplianceReport(data);
      
      // DSAR Events
      case 'dsar_created':
        return formatDSARCreated(data);
      case 'dsar_processed':
        return formatDSARProcessed(data);
      
      // Data Events
      case 'data_exported':
        return formatDataExported(data);
      case 'data_deleted':
        return formatDataDeleted(data);
      
      // Consent
      case 'consent_recorded':
        return formatConsentRecorded(data);
      
      // Retention
      case 'retention_cleanup':
        return formatRetentionCleanup(data);
      
      // Breach
      case 'breach_reported':
        return formatBreachReported(data);
      
      // PIA
      case 'pia_generated':
        return formatPIAGenerated(data);
      
      // Allowlist
      case 'allowlist.add':
        return formatAllowlistAdd(data);
      case 'allowlist.remove':
        return formatAllowlistRemove(data);
      
      // User Events
      case 'user.create':
        return formatUserCreate(data);
      case 'user.update':
        return formatUserUpdate(data);
      case 'user.delete':
        return formatUserDelete(data);
      case 'user.approve':
        return formatUserApprove(data);
      case 'user.block':
        return formatUserBlock(data);
      case 'user.exclude':
        return formatUserExclude(data);
      
      // Auth Events
      case 'auth.login':
        return formatAuthLogin(data);
      case 'auth.logout':
        return formatAuthLogout(data);
      case 'auth.login_failed':
        return formatAuthLoginFailed(data);
      
      default:
        return formatGenericData(data);
    }
  } catch (error) {
    console.error('Error formatting audit details:', error);
    return formatGenericData(data);
  }
};

// Individual formatters for each event type

const formatComplianceReport = (data) => {
  if (!data) return 'Compliance report generated';
  const period = data.period || 'monthly';
  const status = data.complianceStatus || data.status || 'unknown';
  const metrics = data.metrics || {};
  
  const parts = [`${capitalise(period)} report - ${capitalise(status)}`];
  
  if (metrics.totalCalls !== undefined) {
    parts.push(`${metrics.totalCalls} calls`);
  }
  if (metrics.consentRate !== undefined) {
    parts.push(`${Math.round(metrics.consentRate * 100)}% consent rate`);
  }
  if (metrics.dsarRequests > 0) {
    parts.push(`${metrics.dsarRequests} DSAR requests`);
  }
  if (metrics.breaches > 0) {
    parts.push(`${metrics.breaches} breaches`);
  }
  
  return parts.join(' | ');
};

const formatDSARCreated = (data) => {
  if (!data) return 'DSAR request created';
  const parts = [];
  
  if (data.requestId) parts.push(`Request: ${truncateId(data.requestId)}`);
  if (data.requestType) parts.push(`Type: ${capitalise(data.requestType)}`);
  if (data.requestorEmail) parts.push(`Email: ${maskEmail(data.requestorEmail)}`);
  if (data.status) parts.push(`Status: ${capitalise(data.status)}`);
  
  return parts.length > 0 ? parts.join(' | ') : 'DSAR request created';
};

const formatDSARProcessed = (data) => {
  if (!data) return 'DSAR request processed';
  const parts = [];
  
  if (data.requestId) parts.push(`Request: ${truncateId(data.requestId)}`);
  if (data.status) parts.push(`Status: ${capitalise(data.status)}`);
  if (data.processedAt) parts.push(`Processed: ${formatDate(data.processedAt)}`);
  
  return parts.length > 0 ? parts.join(' | ') : 'DSAR request processed';
};

const formatDataExported = (data) => {
  if (!data) return 'Data exported';
  const parts = [];
  
  if (data.exportId) parts.push(`Export: ${truncateId(data.exportId)}`);
  if (data.userIdentifier) parts.push(`User: ${truncateId(data.userIdentifier)}`);
  if (data.dataTypes && Array.isArray(data.dataTypes)) {
    parts.push(`Types: ${data.dataTypes.join(', ')}`);
  }
  
  return parts.length > 0 ? parts.join(' | ') : 'Data exported';
};

const formatDataDeleted = (data) => {
  if (!data) return 'Data deleted';
  const parts = [];
  
  if (data.deletionId) parts.push(`Deletion: ${truncateId(data.deletionId)}`);
  if (data.userIdentifier) parts.push(`User: ${truncateId(data.userIdentifier)}`);
  if (data.recordsDeleted) parts.push(`Records: ${data.recordsDeleted}`);
  
  return parts.length > 0 ? parts.join(' | ') : 'Data deleted';
};

const formatConsentRecorded = (data) => {
  if (!data) return 'Consent recorded';
  const parts = [];
  
  if (data.callSid) parts.push(`Call: ${truncateId(data.callSid)}`);
  if (data.consentGiven !== undefined) {
    parts.push(`Consent: ${data.consentGiven ? 'Given' : 'Declined'}`);
  }
  if (data.consentType) parts.push(`Type: ${capitalise(data.consentType)}`);
  
  return parts.length > 0 ? parts.join(' | ') : 'Consent recorded';
};

const formatRetentionCleanup = (data) => {
  if (!data) return 'Retention cleanup executed';
  const parts = [];
  
  if (data.recordsProcessed) parts.push(`Processed: ${data.recordsProcessed} records`);
  if (data.recordsDeleted) parts.push(`Deleted: ${data.recordsDeleted} records`);
  if (data.spaceFreed) parts.push(`Space freed: ${formatBytes(data.spaceFreed)}`);
  
  return parts.length > 0 ? parts.join(' | ') : 'Retention cleanup executed';
};

const formatBreachReported = (data) => {
  if (!data) return 'Data breach reported';
  const parts = [];
  
  if (data.breachId) parts.push(`Breach: ${truncateId(data.breachId)}`);
  if (data.severity) parts.push(`Severity: ${capitalise(data.severity)}`);
  if (data.affectedRecords) parts.push(`Affected: ${data.affectedRecords} records`);
  if (data.reportedTo) parts.push(`Reported to: ${data.reportedTo}`);
  
  return parts.length > 0 ? parts.join(' | ') : 'Data breach reported';
};

const formatPIAGenerated = (data) => {
  if (!data) return 'Privacy Impact Assessment generated';
  const parts = [];
  
  if (data.assessmentId) parts.push(`Assessment: ${truncateId(data.assessmentId)}`);
  if (data.riskLevel) parts.push(`Risk: ${capitalise(data.riskLevel)}`);
  
  return parts.length > 0 ? parts.join(' | ') : 'Privacy Impact Assessment generated';
};

const formatAllowlistAdd = (data) => {
  if (!data) return 'Allowlist entry added';
  const type = data.type || 'entry';
  const value = data.value || 'unknown';
  return `Added ${type}: ${value}${data.notes ? ` (${data.notes})` : ''}`;
};

const formatAllowlistRemove = (data) => {
  if (!data) return 'Allowlist entry removed';
  const type = data.type || 'entry';
  const value = data.value || 'unknown';
  return `Removed ${type}: ${value}`;
};

const formatUserCreate = (data) => {
  if (!data) return 'User created';
  const parts = [];
  
  if (data.email) parts.push(`Email: ${maskEmail(data.email)}`);
  if (data.role) parts.push(`Role: ${capitalise(data.role)}`);
  if (data.username) parts.push(`Username: ${data.username}`);
  
  return parts.length > 0 ? `Created user - ${parts.join(', ')}` : 'User created';
};

const formatUserUpdate = (data) => {
  if (!data) return 'User updated';
  const changes = Object.keys(data).filter(k => !['_id', 'id'].includes(k));
  if (changes.length === 0) return 'User updated';
  return `Updated: ${changes.join(', ')}`;
};

const formatUserDelete = (data) => {
  if (!data) return 'User deleted';
  if (data.email) return `Deleted user: ${maskEmail(data.email)}`;
  return 'User deleted';
};

const formatUserApprove = (data) => {
  if (!data) return 'User approved';
  if (data.email) return `Approved user: ${maskEmail(data.email)}`;
  return 'User approved';
};

const formatUserBlock = (data) => {
  if (!data) return 'User suspended';
  const parts = [];
  if (data.email) parts.push(maskEmail(data.email));
  if (data.reason) parts.push(`Reason: ${data.reason}`);
  return parts.length > 0 ? `Suspended user: ${parts.join(' | ')}` : 'User suspended';
};

const formatUserExclude = (data) => {
  if (!data) return 'User suspended';
  if (data.email) return `Suspended user: ${maskEmail(data.email)}`;
  return 'User suspended';
};

const formatAuthLogin = (data) => {
  if (!data) return 'User logged in';
  if (data.email) return `Logged in: ${maskEmail(data.email)}`;
  return 'User logged in';
};

const formatAuthLogout = (data) => {
  if (!data) return 'User logged out';
  if (data.email) return `Logged out: ${maskEmail(data.email)}`;
  return 'User logged out';
};

const formatAuthLoginFailed = (data) => {
  if (!data) return 'Login attempt failed';
  const parts = [];
  
  if (data.email) parts.push(maskEmail(data.email));
  if (data.reason) {
    const reasonLabels = {
      'unknown_email': 'Unknown email',
      'invalid_password': 'Invalid password',
      'inactive_user': 'Inactive account'
    };
    parts.push(reasonLabels[data.reason] || data.reason);
  }
  
  return parts.length > 0 ? `Failed login: ${parts.join(' - ')}` : 'Login attempt failed';
};

const formatGenericData = (data) => {
  if (!data) return 'No details';
  if (typeof data === 'string') return data;
  
  // For objects, show key summary
  const keys = Object.keys(data).filter(k => !['_id', 'id', '__v'].includes(k));
  if (keys.length === 0) return 'No details';
  
  // Try to create a meaningful summary
  const summaryParts = [];
  keys.slice(0, 3).forEach(key => {
    const value = data[key];
    if (value !== null && value !== undefined) {
      if (typeof value === 'object') {
        summaryParts.push(`${key}: [object]`);
      } else {
        summaryParts.push(`${key}: ${String(value).slice(0, 30)}`);
      }
    }
  });
  
  if (keys.length > 3) {
    summaryParts.push(`+${keys.length - 3} more`);
  }
  
  return summaryParts.join(' | ') || 'Details available';
};

// Utility helpers

const capitalise = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const truncateId = (id) => {
  if (!id) return 'unknown';
  const str = String(id);
  if (str.length <= 12) return str;
  return `${str.slice(0, 8)}...${str.slice(-4)}`;
};

const maskEmail = (email) => {
  if (!email) return 'unknown';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const maskedLocal = local.length > 2 
    ? `${local.charAt(0)}***${local.charAt(local.length - 1)}`
    : `${local.charAt(0)}***`;
  return `${maskedLocal}@${domain}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};
