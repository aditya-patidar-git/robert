import PrivacyConfig from "../models/PrivacyConfig.js";
import observabilityService from "../services/observabilityService.js";
import configSyncService from "../services/configSyncService.js";

// Get current privacy configuration
export const getPrivacyConfig = async (req, res) => {
  try {
    let config = await PrivacyConfig.findOne({ isActive: true });
    
    if (!config) {
      // Create default configuration if none exists
      config = new PrivacyConfig({
        name: "default",
        consentScript: "For training and quality, this call may be recorded and handled in line with our Privacy Policy.",
        retentionSettings: {
          transcriptRetention: 90,
          recordingRetention: 90,
          metadataRetention: 365
        },
        consentSettings: {
          optOutAllowed: true,
          optOutEmailRoute: "complaints@universalmct.co.uk",
          requireExplicitConsent: true
        },
        privacyPolicy: {
          url: "",
          lastUpdated: new Date()
        },
        lawfulBasis: {
          consent: true,
          legitimateInterest: true,
          contract: false,
          legalObligation: false,
          vitalInterests: false,
          publicTask: false
        },
        ukGdprCompliance: {
          dataProcessingLocation: "UK"
        }
      });
      await config.save();
    }

    res.json({
      success: true,
      config: {
        consentScript: config.consentScript,
        transcriptRetention: config.retentionSettings.transcriptRetention,
        recordingRetention: config.retentionSettings.recordingRetention,
        metadataRetention: config.retentionSettings.metadataRetention,
        optOutAllowed: config.consentSettings.optOutAllowed,
        optOutEmailRoute: config.consentSettings.optOutEmailRoute,
        requireExplicitConsent: config.consentSettings.requireExplicitConsent,
        privacyPolicyUrl: config.privacyPolicy.url,
        lawfulBasis: config.lawfulBasis,
        ukGdprCompliance: config.ukGdprCompliance
      }
    });
  } catch (err) {
    observabilityService.error('Get privacy config error', { error: err.message });
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
};

// Update privacy configuration
export const updatePrivacyConfig = async (req, res) => {
  try {
    const { 
      consentScript,
      transcriptRetention,
      recordingRetention,
      metadataRetention,
      optOutAllowed,
      optOutEmailRoute,
      requireExplicitConsent,
      privacyPolicyUrl,
      lawfulBasis,
      ukGdprCompliance
    } = req.body;

    let config = await PrivacyConfig.findOne({ isActive: true });
    
    if (!config) {
      // Initialize with name and ensure nested objects are created
      config = new PrivacyConfig({
        name: "default"
      });
    }

    // Ensure nested objects exist before setting properties
    // This is necessary because Mongoose may not initialize nested objects until save
    if (!config.retentionSettings) {
      config.retentionSettings = {};
    }
    if (!config.consentSettings) {
      config.consentSettings = {};
    }
    if (!config.privacyPolicy) {
      config.privacyPolicy = {};
    }
    if (!config.lawfulBasis) {
      config.lawfulBasis = {};
    }
    if (!config.ukGdprCompliance) {
      config.ukGdprCompliance = {};
    }

    // Update fields
    if (consentScript !== undefined) config.consentScript = consentScript;
    
    if (transcriptRetention !== undefined) {
      config.retentionSettings.transcriptRetention = transcriptRetention;
    }
    if (recordingRetention !== undefined) {
      config.retentionSettings.recordingRetention = recordingRetention;
    }
    if (metadataRetention !== undefined) {
      config.retentionSettings.metadataRetention = metadataRetention;
    }
    
    if (optOutAllowed !== undefined) {
      config.consentSettings.optOutAllowed = optOutAllowed;
    }
    if (optOutEmailRoute !== undefined) {
      config.consentSettings.optOutEmailRoute = optOutEmailRoute;
    }
    if (requireExplicitConsent !== undefined) {
      config.consentSettings.requireExplicitConsent = requireExplicitConsent;
    }
    
    if (privacyPolicyUrl !== undefined) {
      config.privacyPolicy.url = privacyPolicyUrl;
      config.privacyPolicy.lastUpdated = new Date();
    }
    
    if (lawfulBasis !== undefined) {
      Object.keys(lawfulBasis).forEach(key => {
        if (lawfulBasis[key] !== undefined) {
          config.lawfulBasis[key] = lawfulBasis[key];
        }
      });
    }
    
    if (ukGdprCompliance !== undefined) {
      Object.keys(ukGdprCompliance).forEach(key => {
        if (ukGdprCompliance[key] !== undefined) {
          config.ukGdprCompliance[key] = ukGdprCompliance[key];
        }
      });
    }

    config.createdBy = req.user?.id || "admin";
    await config.save();

    // Notify config change
    configSyncService.notifyConfigChange('privacy', null, {
      changedBy: req.user?.id || req.user?.username || 'admin',
      action: 'update'
    });

    observabilityService.info('Privacy config updated', { updatedBy: req.user?.id });
    res.json({
      success: true,
      message: "Privacy configuration updated successfully",
      config: {
        consentScript: config.consentScript,
        transcriptRetention: config.retentionSettings?.transcriptRetention,
        recordingRetention: config.retentionSettings?.recordingRetention,
        metadataRetention: config.retentionSettings?.metadataRetention,
        optOutAllowed: config.consentSettings?.optOutAllowed,
        optOutEmailRoute: config.consentSettings?.optOutEmailRoute,
        requireExplicitConsent: config.consentSettings?.requireExplicitConsent,
        privacyPolicyUrl: config.privacyPolicy?.url,
        lawfulBasis: config.lawfulBasis,
        ukGdprCompliance: config.ukGdprCompliance
      }
    });
  } catch (err) {
    observabilityService.error('Update privacy config error', { error: err.message });
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
};

