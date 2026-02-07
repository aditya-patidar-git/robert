import gdprService from '../services/gdprService.js';
import observabilityService from '../services/observabilityService.js';
import CallRecord from '../models/callRecord.js';

// Get all DSAR requests
export const getDSARRequests = async (req, res) => {
    try {
        const { 
            status, 
            requestType, 
            requestorEmail, 
            email,
            type,
            search,
            startDate,
            endDate,
            limit 
        } = req.query;
        
        // Build filters object
        const filters = {};
        
        if (status) {
            filters.status = status;
        }
        
        if (requestType || type) {
            filters.requestType = requestType || type;
        }
        
        if (requestorEmail || email) {
            filters.requestorEmail = requestorEmail || email;
        }
        
        // Search filter - search in requestorEmail or userIdentifier
        if (search) {
            filters.$or = [
                { requestorEmail: { $regex: search, $options: 'i' } },
                { userIdentifier: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (startDate || endDate) {
            filters.requestedAt = {};
            if (startDate) {
                const start = new Date(startDate);
                if (!isNaN(start.getTime())) {
                    filters.requestedAt.$gte = start;
                }
            }
            if (endDate) {
                const end = new Date(endDate);
                if (!isNaN(end.getTime())) {
                    end.setHours(23, 59, 59, 999);
                    filters.requestedAt.$lte = end;
                }
            }
        }
        
        if (limit) {
            filters.limit = parseInt(limit);
        }
        
        const dsarRequests = await gdprService.getDSARRequests(filters);
        
        res.json({ success: true, dsarRequests });
    } catch (error) {
        console.error('Get DSAR requests error:', error);
        observabilityService.error('Get DSAR requests error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

// Create DSAR request
export const createDSARRequest = async (req, res) => {
    try {
        const { requestorEmail, requestorName, requestorPhone, requestType, requestedDataTypes, userIdentifier } = req.body;
        
        if (!requestorEmail || !requestType || !userIdentifier) {
            return res.status(400).json({ success: false, error: 'Missing required fields: requestorEmail, requestType, userIdentifier' });
        }

        if (!['export', 'delete', 'rectification'].includes(requestType)) {
            return res.status(400).json({ success: false, error: 'Invalid requestType. Must be: export, delete, or rectification' });
        }
        
        const dsarRequest = await gdprService.createDSARRequest({
            requestorEmail,
            requestorName,
            requestorPhone,
            requestType,
            requestedDataTypes,
            userIdentifier
        });
        
        observabilityService.info('DSAR request created', { requestId: dsarRequest.requestId, requestType });
        res.status(201).json({ success: true, dsarRequest });
    } catch (error) {
        observabilityService.error('Create DSAR request error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

// Verify DSAR request
export const verifyDSARRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { verificationCode } = req.body;
        
        if (!verificationCode) {
            return res.status(400).json({ success: false, error: 'Verification code is required' });
        }
        
        const request = await gdprService.verifyDSARRequest(requestId, verificationCode);
        
        observabilityService.info('DSAR request verified', { requestId });
        res.json({ success: true, request });
    } catch (error) {
        observabilityService.error('Verify DSAR request error', { requestId: req.params.requestId, error: error.message });
        res.status(400).json({ success: false, error: error.message });
    }
};

// Get DSAR request status
export const getDSARRequestStatus = async (req, res) => {
    try {
        const { requestId } = req.params;
        
        const request = await gdprService.getDSARRequestStatus(requestId);
        
        res.json({ success: true, request });
    } catch (error) {
        observabilityService.error('Get DSAR request status error', { requestId: req.params.requestId, error: error.message });
        res.status(404).json({ success: false, error: error.message });
    }
};

// Get DSAR request details
export const getDSARRequestDetails = async (req, res) => {
    try {
        const { requestId } = req.params;
        
        const details = await gdprService.getDSARRequestDetails(requestId);
        
        res.json({ success: true, request: details });
    } catch (error) {
        observabilityService.error('Get DSAR request details error', { requestId: req.params.requestId, error: error.message });
        res.status(404).json({ success: false, error: error.message });
    }
};

// Get DSAR request timeline
export const getDSARRequestTimeline = async (req, res) => {
    try {
        const { requestId } = req.params;
        
        const timeline = await gdprService.getDSARRequestTimeline(requestId);
        
        res.json({ success: true, timeline });
    } catch (error) {
        observabilityService.error('Get DSAR request timeline error', { requestId: req.params.requestId, error: error.message });
        res.status(404).json({ success: false, error: error.message });
    }
};

// Delete DSAR request
export const deleteDSARRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        
        const result = await gdprService.deleteDSARRequest(requestId);
        
        observabilityService.info('DSAR request deleted', { requestId, deletedRequestId: result.deletedRequestId });
        res.json({ success: true, ...result });
    } catch (error) {
        observabilityService.error('Delete DSAR request error', { requestId: req.params.requestId, error: error.message });
        res.status(404).json({ success: false, error: error.message });
    }
};

// Preview DSAR data
export const previewDSARData = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { dataTypes } = req.body;
        
        const request = await gdprService.getDSARRequestDetails(requestId);
        const userIdentifier = request.requestorEmail || request.requestor;
        
        const preview = await gdprService.previewDSARData(
            userIdentifier,
            dataTypes || request.requestedData || ['all']
        );
        
        res.json({ success: true, preview });
    } catch (error) {
        observabilityService.error('Preview DSAR data error', { requestId: req.params.requestId, error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

// Generate DSAR export
export const generateDSARExport = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { maskPII = false } = req.body;
        
        const exportData = await gdprService.generateDSARExport(requestId, maskPII);
        
        observabilityService.info('DSAR export generated', { requestId, recordCount: exportData.recordCount });
        res.json({ success: true, export: exportData });
    } catch (error) {
        observabilityService.error('Generate DSAR export error', { requestId: req.params.requestId, error: error.message });
        res.status(400).json({ success: false, error: error.message });
    }
};

// Download DSAR export
export const downloadDSARExport = async (req, res) => {
    try {
        const { requestId, fileName } = req.params;
        
        const request = await gdprService.getDSARRequestStatus(requestId);
        
        if (!request.exportUrl) {
            return res.status(404).json({ success: false, error: 'Export not found' });
        }

        if (request.exportExpiresAt && new Date(request.exportExpiresAt) < new Date()) {
            return res.status(410).json({ success: false, error: 'Export has expired' });
        }

        // In production, serve from S3 or secure storage
        const fs = await import('fs');
        const path = await import('path');
        const exportPath = path.join('./audit-logs/exports', fileName);
        
        if (!fs.existsSync(exportPath)) {
            return res.status(404).json({ success: false, error: 'Export file not found' });
        }

        res.download(exportPath, fileName);
    } catch (error) {
        observabilityService.error('Download DSAR export error', { requestId: req.params.requestId, error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

// Process DSAR request (admin only)
export const processDSARRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { action, notes } = req.body;
        const adminUser = req.user._id;
        
        if (!action || !['approve', 'reject', 'complete'].includes(action)) {
            return res.status(400).json({ success: false, error: 'Invalid action. Must be: approve, reject, or complete' });
        }
        
        const request = await gdprService.getDSARRequestStatus(requestId);
        
        if (action === 'complete' && request.requestType === 'export') {
            // Generate export if completing an export request
            const exportData = await gdprService.generateDSARExport(requestId, false);
            request.status = 'completed';
            request.completedAt = new Date();
            request.processedBy = adminUser;
            if (notes) request.notes = notes;
            await request.save();
            
            observabilityService.info('DSAR request completed with export', { requestId, adminUser });
            return res.json({ success: true, request, export: exportData });
        } else if (action === 'complete' && request.requestType === 'delete') {
            // Delete user data if completing a delete request
            const deletionResult = await gdprService.deleteUserData(request.userIdentifier);
            request.status = 'completed';
            request.completedAt = new Date();
            request.processedBy = adminUser;
            if (notes) request.notes = notes;
            await request.save();
            
            observabilityService.info('DSAR request completed with deletion', { requestId, adminUser });
            return res.json({ success: true, request, deletion: deletionResult });
        } else if (action === 'reject') {
            request.status = 'rejected';
            request.processedBy = adminUser;
            if (notes) request.notes = notes;
            await request.save();
            
            observabilityService.info('DSAR request rejected', { requestId, adminUser });
            return res.json({ success: true, request });
        }
        
        res.json({ success: true, request });
    } catch (error) {
        observabilityService.error('Process DSAR request error', { requestId: req.params.requestId, error: error.message });
        res.status(400).json({ success: false, error: error.message });
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

// Delete user data (admin only, or via DSAR)
export const deleteUserData = async (req, res) => {
    try {
        const { userIdentifier } = req.params;
        
        const deletionRecord = await gdprService.deleteUserData(userIdentifier);
        
        observabilityService.info('User data deleted', { userIdentifier, deletedRecords: deletionRecord.deletedRecords });
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

// Get consent records from CallRecord collection
export const getConsentRecords = async (req, res) => {
    try {
        const { 
            startDate, 
            endDate, 
            consentType, 
            granted,
            callSid,
            page = 1,
            limit = 15
        } = req.query;
        
        const filter = {
            $or: [
                { 'recordingConsent.requested': { $exists: true } },
                { 'recordingConsent.given': { $exists: true } },
                { 'consentRecorded.recording': { $exists: true } },
                { 'consentRecorded.processing': { $exists: true } }
            ]
        };
        
        if (callSid) {
            filter.callSid = { $regex: callSid, $options: 'i' };
        }
        
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) {
                const start = new Date(startDate);
                if (!isNaN(start.getTime())) {
                    filter.createdAt.$gte = start;
                }
            }
            if (endDate) {
                const end = new Date(endDate);
                if (!isNaN(end.getTime())) {
                    end.setHours(23, 59, 59, 999);
                    filter.createdAt.$lte = end;
                }
            }
        }
        
        const limitNum = Math.min(Math.max(parseInt(limit) || 15, 1), 100);
        const pageNum = Math.max(parseInt(page) || 1, 1);
        const skip = (pageNum - 1) * limitNum;

        const [total, callRecords] = await Promise.all([
            CallRecord.countDocuments(filter),
            CallRecord.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean()
        ]);
        
        // Transform to consent records format
        const consentRecords = callRecords.flatMap(record => {
            const records = [];
            
            // Recording consent (from recordingConsent field)
            if (record.recordingConsent && (
                record.recordingConsent.requested !== undefined ||
                record.recordingConsent.given !== undefined
            )) {
                records.push({
                    id: `${record._id}_recording`,
                    callSid: record.callSid,
                    timestamp: record.recordingConsent?.respondedAt || 
                              record.recordingConsent?.requestedAt || 
                              record.createdAt,
                    consentType: 'recording',
                    granted: record.recordingConsent?.given === true,
                    requested: record.recordingConsent?.requested || false,
                    requestedAt: record.recordingConsent?.requestedAt,
                    respondedAt: record.recordingConsent?.respondedAt,
                    optOutReason: record.recordingConsent?.optOutReason,
                    callerPhone: record.from,
                    callDuration: record.duration,
                    rawData: record
                });
            }
            
            // Processing consent (from consentRecorded.processing)
            if (record.consentRecorded?.processing !== undefined) {
                records.push({
                    id: `${record._id}_processing`,
                    callSid: record.callSid,
                    timestamp: record.consentRecorded?.timestamp || record.createdAt,
                    consentType: 'processing',
                    granted: record.consentRecorded?.processing === true,
                    requested: true,
                    requestedAt: record.consentRecorded?.timestamp || record.createdAt,
                    respondedAt: record.consentRecorded?.timestamp || record.createdAt,
                    optOutReason: record.consentRecorded?.processing === false ? 'Processing consent not given' : null,
                    callerPhone: record.from,
                    callDuration: record.duration,
                    rawData: record
                });
            }
            
            // Recording consent (from consentRecorded.recording)
            if (record.consentRecorded?.recording !== undefined) {
                records.push({
                    id: `${record._id}_recording_recorded`,
                    callSid: record.callSid,
                    timestamp: record.consentRecorded?.timestamp || record.createdAt,
                    consentType: 'recording',
                    granted: record.consentRecorded?.recording === true,
                    requested: true,
                    requestedAt: record.consentRecorded?.timestamp || record.createdAt,
                    respondedAt: record.consentRecorded?.timestamp || record.createdAt,
                    optOutReason: record.consentRecorded?.recording === false ? 'Recording consent not given' : null,
                    callerPhone: record.from,
                    callDuration: record.duration,
                    rawData: record
                });
            }
            
            return records;
        });
        
        // Apply additional filters
        let filtered = consentRecords;
        if (consentType) {
            filtered = filtered.filter(r => r.consentType === consentType);
        }
        if (granted !== undefined && granted !== '') {
            filtered = filtered.filter(r => r.granted === (granted === 'true'));
        }
        
        res.json({
            success: true,
            consentRecords: filtered,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum) || 1
            }
        });
    } catch (error) {
        console.error('Error fetching consent records:', error);
        observabilityService.error('Get consent records error', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to fetch consent records' });
    }
};
