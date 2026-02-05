import express from 'express';
import {
    getDSARRequests,
    createDSARRequest,
    verifyDSARRequest,
    getDSARRequestStatus,
    processDSARRequest,
    getDSARRequestDetails,
    deleteDSARRequest,
    previewDSARData,
    generateDSARExport,
    downloadDSARExport,
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
    checkConsent,
    getConsentRecords
} from '../controllers/gdprController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/rbacMiddleware.js';

const router = express.Router();

// DSAR Management (public endpoints for request creation and verification)
router.get('/dsar', protect, authorizeRoles('owner', 'admin'), getDSARRequests);
router.post('/dsar', createDSARRequest); // Public - users can create requests
router.post('/dsar/:requestId/verify', verifyDSARRequest); // Public - users can verify
router.get('/dsar/:requestId/status', getDSARRequestStatus); // Public - users can check status
router.get('/dsar/:requestId', protect, authorizeRoles('owner', 'admin'), getDSARRequestDetails);
router.get('/dsar/:requestId/timeline', protect, authorizeRoles('owner', 'admin'), getDSARRequestTimeline);
router.post('/dsar/:requestId/preview', protect, authorizeRoles('owner', 'admin'), previewDSARData);
router.post('/dsar/:requestId/export', protect, authorizeRoles('owner', 'admin'), generateDSARExport);
router.get('/dsar/:requestId/export/:fileName', downloadDSARExport); // Public download link
router.put('/dsar/:requestId/process', protect, authorizeRoles('owner', 'admin'), processDSARRequest);
router.delete('/dsar/:requestId', protect, authorizeRoles('owner', 'admin'), deleteDSARRequest);

// Data Management (admin only)
router.post('/export/:userIdentifier', protect, authorizeRoles('owner', 'admin'), exportUserData);
router.delete('/delete/:userIdentifier', protect, authorizeRoles('owner', 'admin'), deleteUserData);

// Audit & Compliance (protected - admin only)
router.get('/audit-logs', protect, authorizeRoles('owner', 'admin'), getAuditLogs);
router.get('/retention-policies', protect, authorizeRoles('owner', 'admin'), checkRetentionPolicies);
router.post('/cleanup-expired', protect, authorizeRoles('owner', 'admin'), cleanupExpiredData);
router.post('/privacy-impact-assessment', protect, authorizeRoles('owner', 'admin'), generatePrivacyImpactAssessment);
router.post('/data-breach', protect, authorizeRoles('owner', 'admin'), reportDataBreach);
router.get('/compliance-report', protect, authorizeRoles('owner', 'admin'), generateComplianceReport);

// PII Management (protected - admin only)
router.post('/mask-pii', protect, authorizeRoles('owner', 'admin'), maskPII);

// Consent Management
router.get('/consent-records', protect, authorizeRoles('owner', 'admin'), getConsentRecords);
router.post('/consent', recordConsent); // Public - called by agent during calls
router.get('/consent/:callSid/:consentType', checkConsent); // Public - called by agent during calls

export default router;
