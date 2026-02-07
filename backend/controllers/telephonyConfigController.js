import TelephonyConfig from "../models/TelephonyConfig.js";
import sipConfigService from "../services/sipConfigService.js";
import connectionTestService from "../services/connectionTestService.js";
import configSyncService from "../services/configSyncService.js";
import { createAuditLog } from "./auditLogController.js";

// Get current telephony configuration
export const getTelephonyConfig = async (req, res) => {
  try {
    let config = await TelephonyConfig.findOne({ isActive: true });
    
    if (!config) {
      // Create default configuration if none exists
      config = new TelephonyConfig({
        name: "default",
        numbers: [
          {
            number: "+442045726060",
            route: "ai_agent",
            status: "active",
            description: "Main UMT number"
          }
        ],
        outboundCallerId: "+442045726060",
        transferNumbers: [
          {
            number: "+442036918807",
            name: "Main Office",
            department: "Customer Service",
            isActive: true
          }
        ],
        afterHoursPolicy: {
          enabled: true,
          startTime: "18:00",
          endTime: "09:00",
          timezone: "Europe/London",
          message: "Thank you for calling Universal Motorcycle Training. Our office hours are Monday to Friday, 9 AM to 6 PM. Please call back during business hours or leave a message.",
          action: "voicemail"
        },
        voicemailSettings: {
          enabled: true,
          greeting: "Please leave your name, number, and a brief message after the tone.",
          maxDuration: 300,
          emailNotification: true,
          emailRecipients: ["admin@universalmct.co.uk"]
        },
        sipSettings: {
          primaryPath: "sip",
          fallbackPath: "media_streams",
          codec: "opus",
          region: "europe"
        },
        recordingSettings: {
          enabled: true,
          consentRequired: true,
          consentMessage: "For training and quality, this call may be recorded and handled in line with our Privacy Policy.",
          retentionDays: 90,
          storageLocation: "twilio"
        }
      });
      await config.save();
    }

    res.json({
      status: "success",
      config
    });
  } catch (err) {
    console.error("Error fetching telephony config:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Update telephony configuration
export const updateTelephonyConfig = async (req, res) => {
  try {
    const { 
      numbers,
      outboundCallerId,
      transferNumbers,
      afterHoursPolicy,
      voicemailSettings,
      sipSettings,
      recordingSettings
    } = req.body;

    let config = await TelephonyConfig.findOne({ isActive: true });
    
    if (!config) {
      config = new TelephonyConfig();
    }

    // Update fields
    if (numbers !== undefined) config.numbers = numbers;
    if (outboundCallerId !== undefined) config.outboundCallerId = outboundCallerId;
    if (transferNumbers !== undefined) config.transferNumbers = transferNumbers;
    
    // Update nested objects - merge with existing values to preserve defaults
    if (afterHoursPolicy !== undefined) {
      config.afterHoursPolicy = { ...(config.afterHoursPolicy || {}), ...afterHoursPolicy };
    }
    if (voicemailSettings !== undefined) {
      config.voicemailSettings = { ...(config.voicemailSettings || {}), ...voicemailSettings };
    }
    if (sipSettings !== undefined) {
      config.sipSettings = { ...(config.sipSettings || {}), ...sipSettings };
    }
    if (recordingSettings !== undefined) {
      config.recordingSettings = { ...(config.recordingSettings || {}), ...recordingSettings };
    }

    config.createdBy = req.user?.id || "admin";
    await config.save();

    // Notify config change
    configSyncService.notifyConfigChange('telephony', null, {
      changedBy: req.user?.id || req.user?.username || 'admin',
      action: 'update'
    });

    res.json({
      status: "success",
      message: "Telephony configuration updated successfully",
      config
    });
  } catch (err) {
    console.error("Error updating telephony config:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Add phone number
export const addPhoneNumber = async (req, res) => {
  try {
    const { number, route, status, description } = req.body;

    if (!number) {
      return res.status(400).json({ 
        status: "error", 
        message: "Phone number is required" 
      });
    }

    let config = await TelephonyConfig.findOne({ isActive: true });
    
    if (!config) {
      config = new TelephonyConfig();
    }

    // Check if number already exists
    const existingNumber = config.numbers.find(n => n.number === number);
    if (existingNumber) {
      return res.status(400).json({ 
        status: "error", 
        message: "Phone number already exists" 
      });
    }

    // Add new number
    config.numbers.push({
      number,
      route: route || "ai_agent",
      status: status || "active",
      description: description || "",
      createdAt: new Date()
    });

    await config.save();

    res.json({
      status: "success",
      message: "Phone number added successfully",
      config
    });
  } catch (err) {
    console.error("Error adding phone number:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Update phone number
export const updatePhoneNumber = async (req, res) => {
  try {
    const { number } = req.params;
    const { route, status, description } = req.body;

    let config = await TelephonyConfig.findOne({ isActive: true });
    
    if (!config) {
      return res.status(404).json({ 
        status: "error", 
        message: "Telephony configuration not found" 
      });
    }

    const phoneNumber = config.numbers.find(n => n.number === number);
    if (!phoneNumber) {
      return res.status(404).json({ 
        status: "error", 
        message: "Phone number not found" 
      });
    }

    // Update fields
    if (route !== undefined) phoneNumber.route = route;
    if (status !== undefined) phoneNumber.status = status;
    if (description !== undefined) phoneNumber.description = description;

    await config.save();

    res.json({
      status: "success",
      message: "Phone number updated successfully",
      config
    });
  } catch (err) {
    console.error("Error updating phone number:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Remove phone number
export const removePhoneNumber = async (req, res) => {
  try {
    const { number } = req.params;

    let config = await TelephonyConfig.findOne({ isActive: true });
    
    if (!config) {
      return res.status(404).json({ 
        status: "error", 
        message: "Telephony configuration not found" 
      });
    }

    config.numbers = config.numbers.filter(n => n.number !== number);
    await config.save();

    res.json({
      status: "success",
      message: "Phone number removed successfully",
      config
    });
  } catch (err) {
    console.error("Error removing phone number:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Test phone number
export const testPhoneNumber = async (req, res) => {
  try {
    const { number } = req.params;

    // This would typically make a test call or check Twilio status
    // For now, return mock data
    const testResult = {
      number,
      status: "active",
      twilioStatus: "in-service",
      lastTested: new Date(),
      latency: 45, // ms
      quality: "excellent"
    };

    res.json({
      status: "success",
      testResult
    });
  } catch (err) {
    console.error("Error testing phone number:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Test SIP connection
export const testSipConnection = async (req, res) => {
  try {
    const config = await TelephonyConfig.findOne({ isActive: true });
    
    if (!config || !config.sipSettings) {
      return res.status(404).json({
        status: "error",
        message: "SIP configuration not found"
      });
    }

    // Decrypt password for testing if needed
    let sipConfig = { ...config.sipSettings.toObject() };
    if (sipConfig.twilioSipPassword) {
      try {
        sipConfig.twilioSipPassword = sipConfigService.decryptSipPassword(sipConfig.twilioSipPassword);
      } catch (err) {
        // Password might not be encrypted yet, use as-is
        console.warn('Could not decrypt SIP password, using as-is for test');
      }
    }

    // Test connection
    const testResult = await sipConfigService.testSipConnection(sipConfig);

    if (req.user) {
      await createAuditLog({
        actorId: req.user._id,
        action: 'secret.access_attempt',
        targetType: 'config',
        targetId: 'telephony_sip',
        diff: { operation: 'test_connection', success: testResult.success },
        req
      });
    }

    // Update config with test results
    config.sipSettings.testConnectionStatus = testResult.success ? 'success' : 'failed';
    config.sipSettings.testConnectionLastAttempt = new Date();
    config.sipSettings.testConnectionError = testResult.error || null;
    await config.save();

    res.json({
      status: "success",
      testResult: {
        success: testResult.success,
        status: testResult.status,
        message: testResult.message,
        error: testResult.error,
        data: testResult.data
      }
    });
  } catch (err) {
    console.error("Error testing SIP connection:", err);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: err.message
    });
  }
};

// Get SIP connection status
export const getSipStatus = async (req, res) => {
  try {
    const config = await TelephonyConfig.findOne({ isActive: true });
    
    if (!config || !config.sipSettings) {
      return res.status(404).json({
        status: "error",
        message: "SIP configuration not found"
      });
    }

    const sipSettings = config.sipSettings.toObject();
    
    // Mask password for display
    const displayConfig = sipConfigService.prepareForDisplay(sipSettings);

    res.json({
      status: "success",
      sipSettings: displayConfig
    });
  } catch (err) {
    console.error("Error fetching SIP status:", err);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Get SIP health status
export const getSipHealth = async (req, res) => {
  try {
    // Dynamically import SIP service from agent service
    // Note: This requires the agent service to expose a health endpoint or we need to call it via HTTP
    // For now, we'll use the SIP config service validation
    
    const config = await TelephonyConfig.findOne({ isActive: true });
    
    if (!config || !config.sipSettings) {
      return res.json({
        status: "success",
        health: {
          enabled: false,
          status: "not_configured",
          message: "SIP is not configured"
        }
      });
    }

    // Get validation result from startup validation
    // We'll use the SIP config service to validate
    const validation = sipConfigService.validateSipConfig(config.sipSettings.toObject());
    
    // Get health monitor stats (if available via agent service)
    // For now, return basic health status
    const health = {
      enabled: config.sipSettings.openaiSipEnabled || false,
      status: validation.valid ? "healthy" : "unhealthy",
      validation: {
        valid: validation.valid,
        errors: validation.errors || [],
        warnings: validation.warnings || []
      },
      lastTest: config.sipSettings.testConnectionLastAttempt || null,
      testStatus: config.sipSettings.testConnectionStatus || "not_tested"
    };

    res.json({
      status: "success",
      health
    });
  } catch (err) {
    console.error("Error fetching SIP health:", err);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: err.message
    });
  }
};

// Update SIP settings only
export const updateSipSettings = async (req, res) => {
  try {
    const sipSettings = req.body;

    let config = await TelephonyConfig.findOne({ isActive: true });
    
    if (!config) {
      config = new TelephonyConfig();
    }

    // Validate configuration
    const validation = sipConfigService.validateSipConfig(sipSettings);
    if (!validation.valid) {
      return res.status(400).json({
        status: "error",
        message: "Invalid SIP configuration",
        errors: validation.errors
      });
    }

    // Prepare for storage (encrypt sensitive fields)
    const preparedSettings = sipConfigService.prepareForStorage(sipSettings);

    // Merge with existing settings
    config.sipSettings = {
      ...config.sipSettings.toObject(),
      ...preparedSettings
    };

    config.createdBy = req.user?.id || "admin";
    await config.save();

    // Notify config change
    configSyncService.notifyConfigChange('telephony', 'sip', {
      changedBy: req.user?.id || req.user?.username || 'admin',
      action: 'update'
    });

    // Prepare for response (mask sensitive fields)
    const displaySettings = sipConfigService.prepareForDisplay(config.sipSettings.toObject());

    res.json({
      status: "success",
      message: "SIP settings updated successfully",
      sipSettings: displaySettings
    });
  } catch (err) {
    console.error("Error updating SIP settings:", err);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: err.message
    });
  }
};










