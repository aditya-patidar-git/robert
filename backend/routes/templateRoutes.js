import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/rbacMiddleware.js";
import {
  listEmailTemplates,
  getEmailTemplate,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  sendTestEmail
} from "../controllers/emailTemplateController.js";
import {
  listSMSTemplates,
  getSMSTemplate,
  createSMSTemplate,
  updateSMSTemplate,
  deleteSMSTemplate,
  sendTestSMS
} from "../controllers/smsTemplateController.js";

const router = express.Router();

// Protect all routes + RBAC
router.use(protect);
router.use(authorizeRoles("owner", "admin"));

// Email Template Routes
router.get("/email-templates", listEmailTemplates);
router.get("/email-templates/:id", getEmailTemplate);
router.post("/email-templates", createEmailTemplate);
router.put("/email-templates/:id", updateEmailTemplate);
router.delete("/email-templates/:id", deleteEmailTemplate);
router.post("/email-templates/:id/test", sendTestEmail);

// SMS Template Routes
router.get("/sms-templates", listSMSTemplates);
router.get("/sms-templates/:id", getSMSTemplate);
router.post("/sms-templates", createSMSTemplate);
router.put("/sms-templates/:id", updateSMSTemplate);
router.delete("/sms-templates/:id", deleteSMSTemplate);
router.post("/sms-templates/:id/test", sendTestSMS);

export default router;

