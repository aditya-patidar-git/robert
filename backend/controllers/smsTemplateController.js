import SMSTemplate from "../models/SMSTemplate.js";
import { BaseTemplateController } from "./baseTemplateController.js";
import templateService from "../services/templateService.js";

const baseController = new BaseTemplateController(SMSTemplate, 'sms');

// List all SMS templates
export const listSMSTemplates = baseController.list.bind(baseController);

// Get SMS template by ID
export const getSMSTemplate = baseController.get.bind(baseController);

// Create SMS template
export const createSMSTemplate = baseController.create.bind(baseController);

// Update SMS template
export const updateSMSTemplate = baseController.update.bind(baseController);

// Delete SMS template
export const deleteSMSTemplate = baseController.delete.bind(baseController);

// Send test SMS
export const sendTestSMS = async (req, res) => {
  try {
    const { id } = req.params;
    const { recipientPhone } = req.body;

    if (!recipientPhone) {
      return res.status(400).json({
        status: "error",
        message: "Recipient phone number is required"
      });
    }

    const result = await templateService.sendTestSMS(id, recipientPhone);

    res.json({
      status: "success",
      ...result
    });
  } catch (err) {
    console.error("Error sending test SMS:", err);
    res.status(500).json({
      status: "error",
      message: err.message || "Internal server error"
    });
  }
};

