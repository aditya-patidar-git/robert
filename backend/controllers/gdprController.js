import gdprService from '../services/gdprService.js';
import observabilityService from '../services/observabilityService.js';

// Create DSAR request
export const createDSARRequest = async (req, res) => {
    try {
        const { email, name, type, dataTypes } = req.body;
        
        if (!email || !name || !type) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        const dsarRequest = await gdprService.createDSARRequest({
            email,
            name,
            type,
            dataTypes
        });
        
        observabilityService.info('DSAR request created', { dsarId: dsarRequest.id, type });
        res.json({ success: true, dsarRequest });
    } catch (error) {
        observabilityService.error('Create DSAR request error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

// Process DSAR request
export const processDSARRequest = async (req, res) => {
    try {
        const { dsarId } = req.params;
        const { action, adminUser } = req.body;
        
        if (!action || !adminUser) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        const result = await gdprService.processDSARRequest(dsarId, action, adminUser);
        
        observabilityService.info('DSAR request processed', { dsarId, action, adminUser });
        res.json({ success: true, result });
    } catch (error) {
        observabilityService.error('Process DSAR request error', { dsarId: req.params.dsarId, error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

// Export user data
export const exportUserData = async (req, res) => {
    try {
        const { userIdentifier } = req.params;
        const { dataTypes } = req.body;
        
        const exportData = await gdprService.exportUserData(userIdentifier, dataTypes);
        
        observabilityService.info('User data exported', { userIdentifier, dataTypes });
        res.json({ success: true, exportData });
    } catch (error) {
        observabilityService.error('Export user data error', { userIdentifier: req.params.userIdentifier, error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

// Delete user data
export const deleteUserData = async (req, res) => {
    try {
        const { userIdentifier } = req.params;
        const { dataTypes } = req.body;
        
        const deletionRecord = await gdprService.deleteUserData(userIdentifier, dataTypes);
        
        observabilityService.info('User data deleted', { userIdentifier, dataTypes });
        res.json({ success: true, deletionRecord });
    } catch (error) {
        observabilityService.error('Delete user data error', { userIdentifier: req.params.userIdentifier, error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get audit logs
export const getAuditLogs = async (req, res) => {
    try {
        const { startDate, endDate, eventType, limit } = req.query;
        
        const filters = {
            startDate,
            endDate,
            eventType,
            limit: limit ? parseInt(limit) : 100
        };
        
        const auditLogs = await gdprService.getAuditLogs(filters);
        
        res.json({ success: true, auditLogs });
    } catch (error) {
        observabilityService.error('Get audit logs error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

// Check retention policies
export const checkRetentionPolicies = async (req, res) => {
    try {
        const retentionChecks = await gdprService.checkRetentionPolicies();
        
        res.json({ success: true, retentionChecks });
    } catch (error) {
        observabilityService.error('Check retention policies error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

// Cleanup expired data
export const cleanupExpiredData = async (req, res) => {
    try {
        const cleanupResults = await gdprService.cleanupExpiredData();
        
        observabilityService.info('Expired data cleanup completed', { cleanupResults });
        res.json({ success: true, cleanupResults });
    } catch (error) {
        observabilityService.error('Cleanup expired data error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

// Generate privacy impact assessment
export const generatePrivacyImpactAssessment = async (req, res) => {
    try {
        const { processingActivity } = req.body;
        
        if (!processingActivity) {
            return res.status(400).json({ success: false, error: 'Processing activity is required' });
        }
        
        const pia = await gdprService.generatePrivacyImpactAssessment(processingActivity);
        
        observabilityService.info('Privacy impact assessment generated', { piaId: pia.id });
        res.json({ success: true, pia });
    } catch (error) {
        observabilityService.error('Generate PIA error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

// Report data breach
export const reportDataBreach = async (req, res) => {
    try {
        const { breachData } = req.body;
        
        if (!breachData) {
            return res.status(400).json({ success: false, error: 'Breach data is required' });
        }
        
        const breachReport = await gdprService.reportDataBreach(breachData);
        
        observabilityService.warn('Data breach reported', { breachId: breachReport.id, severity: breachReport.severity });
        res.json({ success: true, breachReport });
    } catch (error) {
        observabilityService.error('Report data breach error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

// Generate compliance report
export const generateComplianceReport = async (req, res) => {
    try {
        const { period } = req.query;
        
        const report = await gdprService.generateComplianceReport(period);
        
        observabilityService.info('Compliance report generated', { period, reportId: report.id });
        res.json({ success: true, report });
    } catch (error) {
        observabilityService.error('Generate compliance report error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

// Mask PII in text
export const maskPII = async (req, res) => {
    try {
        const { text, maskType } = req.body;
        
        if (!text) {
            return res.status(400).json({ success: false, error: 'Text is required' });
        }
        
        const maskedText = gdprService.maskPII(text, maskType || 'partial');
        const detectedPII = gdprService.detectPII(text);
        
        res.json({ 
            success: true, 
            originalText: text,
            maskedText,
            detectedPII,
            maskType: maskType || 'partial'
        });
    } catch (error) {
        observabilityService.error('Mask PII error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

// Record consent
export const recordConsent = async (req, res) => {
    try {
        const { callSid, consentType, granted } = req.body;
        
        if (!callSid || !consentType || granted === undefined) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        const consentRecord = await gdprService.recordConsent(callSid, consentType, granted);
        
        observabilityService.info('Consent recorded', { callSid, consentType, granted });
        res.json({ success: true, consentRecord });
    } catch (error) {
        observabilityService.error('Record consent error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

// Check consent
export const checkConsent = async (req, res) => {
    try {
        const { callSid, consentType } = req.params;
        
        const consent = await gdprService.checkConsent(callSid, consentType);
        
        res.json({ success: true, consent });
    } catch (error) {
        observabilityService.error('Check consent error', { callSid: req.params.callSid, error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};
