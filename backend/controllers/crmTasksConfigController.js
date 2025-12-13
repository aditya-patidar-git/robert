import CRMTasksConfig from "../models/CRMTasksConfig.js";
import observabilityService from "../services/observabilityService.js";

// Get current CRM tasks configuration
export const getCRMTasksConfig = async (req, res) => {
  try {
    let config = await CRMTasksConfig.findOne({ isActive: true });
    
    if (!config) {
      // Create default configuration if none exists
      config = new CRMTasksConfig({
        name: "default",
        tasks: {
          createBooking: { enabled: true, requireConfirmation: true },
          reschedule: { enabled: true, requireConfirmation: true },
          cancel: { enabled: true, requireConfirmation: true },
          updateRecord: { enabled: true, requireConfirmation: false },
          issueRefund: { enabled: false, requireConfirmation: true }
        },
        generalSettings: {
          dryRunEnforced: true,
          auditLogging: true
        }
      });
      await config.save();
    }

    res.json({
      success: true,
      config: {
        createBooking: config.tasks.createBooking,
        reschedule: config.tasks.reschedule,
        cancel: config.tasks.cancel,
        updateRecord: config.tasks.updateRecord,
        issueRefund: config.tasks.issueRefund,
        dryRunEnforced: config.generalSettings.dryRunEnforced,
        auditLogging: config.generalSettings.auditLogging
      }
    });
  } catch (err) {
    observabilityService.error('Get CRM tasks config error', { error: err.message });
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
};

// Update CRM tasks configuration
export const updateCRMTasksConfig = async (req, res) => {
  try {
    const { 
      createBooking,
      reschedule,
      cancel,
      updateRecord,
      issueRefund,
      dryRunEnforced,
      auditLogging
    } = req.body;

    let config = await CRMTasksConfig.findOne({ isActive: true });
    
    if (!config) {
      // Initialize with name and ensure nested objects are created
      config = new CRMTasksConfig({
        name: "default"
      });
    }

    // Ensure nested objects exist before setting properties
    if (!config.tasks) {
      config.tasks = {};
    }
    if (!config.generalSettings) {
      config.generalSettings = {};
    }

    // Update task configurations
    if (createBooking !== undefined) {
      if (!config.tasks.createBooking) {
        config.tasks.createBooking = {};
      }
      if (createBooking.enabled !== undefined) {
        config.tasks.createBooking.enabled = createBooking.enabled;
      }
      if (createBooking.requireConfirmation !== undefined) {
        config.tasks.createBooking.requireConfirmation = createBooking.requireConfirmation;
      }
    }

    if (reschedule !== undefined) {
      if (!config.tasks.reschedule) {
        config.tasks.reschedule = {};
      }
      if (reschedule.enabled !== undefined) {
        config.tasks.reschedule.enabled = reschedule.enabled;
      }
      if (reschedule.requireConfirmation !== undefined) {
        config.tasks.reschedule.requireConfirmation = reschedule.requireConfirmation;
      }
    }

    if (cancel !== undefined) {
      if (!config.tasks.cancel) {
        config.tasks.cancel = {};
      }
      if (cancel.enabled !== undefined) {
        config.tasks.cancel.enabled = cancel.enabled;
      }
      if (cancel.requireConfirmation !== undefined) {
        config.tasks.cancel.requireConfirmation = cancel.requireConfirmation;
      }
    }

    if (updateRecord !== undefined) {
      if (!config.tasks.updateRecord) {
        config.tasks.updateRecord = {};
      }
      if (updateRecord.enabled !== undefined) {
        config.tasks.updateRecord.enabled = updateRecord.enabled;
      }
      if (updateRecord.requireConfirmation !== undefined) {
        config.tasks.updateRecord.requireConfirmation = updateRecord.requireConfirmation;
      }
    }

    if (issueRefund !== undefined) {
      if (!config.tasks.issueRefund) {
        config.tasks.issueRefund = {};
      }
      if (issueRefund.enabled !== undefined) {
        config.tasks.issueRefund.enabled = issueRefund.enabled;
      }
      if (issueRefund.requireConfirmation !== undefined) {
        config.tasks.issueRefund.requireConfirmation = issueRefund.requireConfirmation;
      }
    }

    // Update general settings
    if (dryRunEnforced !== undefined) {
      config.generalSettings.dryRunEnforced = dryRunEnforced;
    }
    if (auditLogging !== undefined) {
      config.generalSettings.auditLogging = auditLogging;
    }

    config.createdBy = req.user?.id || "admin";
    await config.save();

    observabilityService.info('CRM tasks config updated', { updatedBy: req.user?.id });
    res.json({
      success: true,
      message: "CRM tasks configuration updated successfully",
      config: {
        createBooking: config.tasks.createBooking,
        reschedule: config.tasks.reschedule,
        cancel: config.tasks.cancel,
        updateRecord: config.tasks.updateRecord,
        issueRefund: config.tasks.issueRefund,
        dryRunEnforced: config.generalSettings.dryRunEnforced,
        auditLogging: config.generalSettings.auditLogging
      }
    });
  } catch (err) {
    observabilityService.error('Update CRM tasks config error', { error: err.message });
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
};

