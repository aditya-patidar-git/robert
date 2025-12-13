import TelephonyConfig from "../models/TelephonyConfig.js";

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










