import EmailTemplate from "../models/EmailTemplate.js";
import { BaseTemplateController } from "./baseTemplateController.js";
import templateService from "../services/templateService.js";
import configSyncService from "../services/configSyncService.js";

const baseController = new BaseTemplateController(EmailTemplate, 'email');

// List all email templates
export const listEmailTemplates = baseController.list.bind(baseController);

// Get email template by ID
export const getEmailTemplate = baseController.get.bind(baseController);

// Create email template
export const createEmailTemplate = baseController.create.bind(baseController);

// Update email template
export const updateEmailTemplate = baseController.update.bind(baseController);

// Delete email template
export const deleteEmailTemplate = baseController.delete.bind(baseController);

// Send test email
export const sendTestEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { recipientEmail } = req.body;

    if (!recipientEmail) {
      return res.status(400).json({
        status: "error",
        message: "Recipient email is required"
      });
    }

    const result = await templateService.sendTestEmail(id, recipientEmail);

    res.json({
      status: "success",
      ...result
    });
  } catch (err) {
    console.error("Error sending test email:", err);
    res.status(500).json({
      status: "error",
      message: err.message || "Internal server error"
    });
  }
};

