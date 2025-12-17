import express from 'express';
import {
    getDSARRequests,
    createDSARRequest,
    processDSARRequest,
    getDSARRequestDetails,
    previewDSARData,
    generateDSARExport,
    getDSARRequestTimeline,
    exportUserData,
    deleteUserData,
    getAuditLogs,
    checkRetentionPolicies,
    cleanupExpiredData,
    generatePrivacyImpactAssessment,
    reportDataBreach,
    generateComplianceReport,
    maskPII,
    recordConsent,
    checkConsent
} from '../controllers/gdprController.js';

const router = express.Router();

// DSAR Management
router.get('/dsar', getDSARRequests);
router.post('/dsar', createDSARRequest);
router.get('/dsar/:dsarId', getDSARRequestDetails);
router.get('/dsar/:dsarId/timeline', getDSARRequestTimeline);
router.post('/dsar/:dsarId/preview', previewDSARData);
router.post('/dsar/:dsarId/export', generateDSARExport);
router.put('/dsar/:dsarId/process', processDSARRequest);

// Data Management
router.post('/export/:userIdentifier', exportUserData);
router.delete('/delete/:userIdentifier', deleteUserData);

// Audit & Compliance
router.get('/audit-logs', getAuditLogs);
router.get('/retention-policies', checkRetentionPolicies);
router.post('/cleanup-expired', cleanupExpiredData);
router.post('/privacy-impact-assessment', generatePrivacyImpactAssessment);
router.post('/data-breach', reportDataBreach);
router.get('/compliance-report', generateComplianceReport);

// PII Management
router.post('/mask-pii', maskPII);

// Consent Management
router.post('/consent', recordConsent);
router.get('/consent/:callSid/:consentType', checkConsent);

export default router;
