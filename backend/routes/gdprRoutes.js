import express from 'express';
import {
    getDSARRequests,
    createDSARRequest,
    verifyDSARRequest,
    getDSARRequestStatus,
    processDSARRequest,
    getDSARRequestDetails,
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
    checkConsent
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

// Data Management (admin only)
router.post('/export/:userIdentifier', protect, authorizeRoles('owner', 'admin'), exportUserData);
router.delete('/delete/:userIdentifier', protect, authorizeRoles('owner', 'admin'), deleteUserData);

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
