import CRMTasksConfig from "../models/CRMTasksConfig.js";
import observabilityService from "../services/observabilityService.js";

// Get current CRM tasks configuration
export const getCRMTasksConfig = async (req, res) => {
  try {
    let config = await CRMTasksConfig.findOne({ isActive: true });
    
    if (!config) {
      // Create default configuration if none exists
      // Only createBooking and cancel tasks are supported
      config = new CRMTasksConfig({
        name: "default",
        tasks: {
          createBooking: { enabled: true, requireConfirmation: true },
          cancel: { enabled: true, requireConfirmation: true }
        },
        generalSettings: {
          dryRunEnforced: true,
          auditLogging: true
        }
      });
      await config.save();
    }

    // Return only supported tasks (createBooking and cancel)
    res.json({
      success: true,
      config: {
        createBooking: config.tasks?.createBooking || { enabled: true, requireConfirmation: true },
        cancel: config.tasks?.cancel || { enabled: true, requireConfirmation: true },
        dryRunEnforced: config.generalSettings?.dryRunEnforced ?? true,
        auditLogging: config.generalSettings?.auditLogging ?? true
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
    // Only createBooking and cancel tasks are supported
    const { 
      createBooking,
      cancel,
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

    // Update task configurations (only createBooking and cancel)
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
        createBooking: config.tasks?.createBooking || { enabled: true, requireConfirmation: true },
        cancel: config.tasks?.cancel || { enabled: true, requireConfirmation: true },
        dryRunEnforced: config.generalSettings?.dryRunEnforced ?? true,
        auditLogging: config.generalSettings?.auditLogging ?? true
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

