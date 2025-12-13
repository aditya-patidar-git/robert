import AudioConfig from "../models/AudioConfig.js";
import TelephonyConfig from "../models/TelephonyConfig.js";
import PrivacyConfig from "../models/PrivacyConfig.js";
import AIConfig from "../models/AIConfig.js";

// GET /api/system/config
export const getSystemConfig = async (req, res) => {
  try {
    // Get all relevant configurations
    const [audioConfig, telephonyConfig, privacyConfig, aiConfig] = await Promise.all([
      AudioConfig.findOne({ isActive: true }),
      TelephonyConfig.findOne({ isActive: true }),
      PrivacyConfig.findOne({ isActive: true }),
      AIConfig.findOne({ isActive: true })
    ]);

    // Combine into system config
    const systemConfig = {
      // MCP Settings (defaults - can be stored in AIConfig if needed)
      mcpEnabled: true,
      mcpRateLimit: 100,
      mcpTimeout: 30,
      
      // System Settings (from TelephonyConfig)
      maxConcurrentCalls: telephonyConfig?.maxConcurrentCalls ?? 50,
      callTimeout: telephonyConfig?.callTimeout ?? 300,
      retryAttempts: telephonyConfig?.retryAttempts ?? 3,
      logLevel: telephonyConfig?.logLevel ?? (process.env.LOG_LEVEL || 'info'),
      
      // Audio Settings (from AudioConfig)
      vadThreshold: audioConfig?.vadThreshold ?? 500,
      startPadding: audioConfig?.startPadding ?? 250,
      endPadding: audioConfig?.endPadding ?? 300,
      bargeInPolicy: audioConfig?.bargeInPolicy ?? 'pause',
      noiseSuppression: audioConfig?.noiseSuppression ?? true,
      noiseSuppressionAlgorithm: audioConfig?.noiseSuppressionAlgorithm ?? 'basic',
      echoCancellation: audioConfig?.echoCancellation ?? true,
      automaticGainControl: audioConfig?.automaticGainControl ?? false,
      audioQuality: audioConfig?.audioQuality ?? 'high',
      energyThreshold: audioConfig?.energyThreshold ?? null,
      energyThresholdAutoCalibrate: audioConfig?.energyThresholdAutoCalibrate ?? true,
      
      // Telephony Settings
      outboundCallerId: telephonyConfig?.outboundCallerId ?? '+442045726060',
      
      // Privacy Settings (from PrivacyConfig)
      transcriptRetention: privacyConfig?.retentionSettings?.transcriptRetention ?? 90,
      recordingRetention: privacyConfig?.retentionSettings?.recordingRetention ?? 90,
      metadataRetention: privacyConfig?.retentionSettings?.metadataRetention ?? 365
    };

    res.json({
      success: true,
      config: systemConfig
    });
  } catch (err) {
    console.error("Error fetching system config:", err);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
};

// PUT /api/system/config
export const updateSystemConfig = async (req, res) => {
  try {
    const configData = req.body;

    // Update AI Config for MCP settings (if AIConfig model supports these fields)
    // Note: MCP settings are currently managed through MCP tools service
    // This is a placeholder for future MCP configuration storage
    if (configData.mcpEnabled !== undefined || configData.mcpRateLimit !== undefined || configData.mcpTimeout !== undefined) {
      // MCP settings are managed through the MCP tools service
      // These values are stored in memory/config, not in AIConfig model
      // TODO: Add MCP settings to AIConfig model if persistent storage is needed
    }

    // Update Telephony Config for system settings
    if (configData.outboundCallerId !== undefined || 
        configData.maxConcurrentCalls !== undefined || 
        configData.callTimeout !== undefined || 
        configData.retryAttempts !== undefined || 
        configData.logLevel !== undefined) {
      let telephonyConfig = await TelephonyConfig.findOne({ isActive: true });
      if (!telephonyConfig) {
        telephonyConfig = new TelephonyConfig({ name: "default" });
      }
      if (configData.outboundCallerId !== undefined) {
        telephonyConfig.outboundCallerId = configData.outboundCallerId;
      }
      if (configData.maxConcurrentCalls !== undefined) {
        telephonyConfig.maxConcurrentCalls = configData.maxConcurrentCalls;
      }
      if (configData.callTimeout !== undefined) {
        telephonyConfig.callTimeout = configData.callTimeout;
      }
      if (configData.retryAttempts !== undefined) {
        telephonyConfig.retryAttempts = configData.retryAttempts;
      }
      if (configData.logLevel !== undefined) {
        telephonyConfig.logLevel = configData.logLevel;
      }
      await telephonyConfig.save();
    }

    // Update Audio Config
    if (configData.vadThreshold !== undefined || configData.startPadding !== undefined || 
        configData.endPadding !== undefined || configData.bargeInPolicy !== undefined ||
        configData.noiseSuppression !== undefined || configData.echoCancellation !== undefined ||
        configData.audioQuality !== undefined) {
      let audioConfig = await AudioConfig.findOne({ isActive: true });
      if (!audioConfig) {
        audioConfig = new AudioConfig({ name: "default" });
      }
      if (configData.vadThreshold !== undefined) audioConfig.vadThreshold = configData.vadThreshold;
      if (configData.startPadding !== undefined) audioConfig.startPadding = configData.startPadding;
      if (configData.endPadding !== undefined) audioConfig.endPadding = configData.endPadding;
      if (configData.bargeInPolicy !== undefined) audioConfig.bargeInPolicy = configData.bargeInPolicy;
      if (configData.noiseSuppression !== undefined) audioConfig.noiseSuppression = configData.noiseSuppression;
      if (configData.noiseSuppressionAlgorithm !== undefined) audioConfig.noiseSuppressionAlgorithm = configData.noiseSuppressionAlgorithm;
      if (configData.echoCancellation !== undefined) audioConfig.echoCancellation = configData.echoCancellation;
      if (configData.automaticGainControl !== undefined) audioConfig.automaticGainControl = configData.automaticGainControl;
      if (configData.audioQuality !== undefined) audioConfig.audioQuality = configData.audioQuality;
      if (configData.energyThreshold !== undefined) audioConfig.energyThreshold = configData.energyThreshold;
      if (configData.energyThresholdAutoCalibrate !== undefined) audioConfig.energyThresholdAutoCalibrate = configData.energyThresholdAutoCalibrate;
      await audioConfig.save();
    }

    // Update Privacy Config
    if (configData.transcriptRetention !== undefined || configData.recordingRetention !== undefined || 
        configData.metadataRetention !== undefined) {
      let privacyConfig = await PrivacyConfig.findOne({ isActive: true });
      if (!privacyConfig) {
        privacyConfig = new PrivacyConfig({ name: "default" });
      }
      if (configData.transcriptRetention !== undefined) {
        if (!privacyConfig.retentionSettings) privacyConfig.retentionSettings = {};
        privacyConfig.retentionSettings.transcriptRetention = configData.transcriptRetention;
      }
      if (configData.recordingRetention !== undefined) {
        if (!privacyConfig.retentionSettings) privacyConfig.retentionSettings = {};
        privacyConfig.retentionSettings.recordingRetention = configData.recordingRetention;
      }
      if (configData.metadataRetention !== undefined) {
        if (!privacyConfig.retentionSettings) privacyConfig.retentionSettings = {};
        privacyConfig.retentionSettings.metadataRetention = configData.metadataRetention;
      }
      await privacyConfig.save();
    }

    res.json({
      success: true,
      message: "System configuration updated successfully"
    });
  } catch (err) {
    console.error("Error updating system config:", err);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
};

// GET /api/system/mcp-tools - Proxy to MCP tools service
export const getMCPTools = async (req, res) => {
  try {
    // Import dynamically to avoid circular dependencies
    const { getAllTools } = await import("../controllers/mcpToolsController.js");
    return getAllTools(req, res);
  } catch (err) {
    console.error("Error getting MCP tools:", err);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
};

// POST /api/system/mcp-tools/execute - Proxy to MCP tools service
export const executeMCPTool = async (req, res) => {
  try {
    // Import dynamically to avoid circular dependencies
    const { executeTool } = await import("../controllers/mcpToolsController.js");
    return executeTool(req, res);
  } catch (err) {
    console.error("Error executing MCP tool:", err);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
};

// GET /api/system/models - Proxy to AI service
export const getAvailableModels = async (req, res) => {
  try {
    // Import dynamically to avoid circular dependencies
    const { getModels } = await import("../controllers/aiController.js");
    return getModels(req, res);
  } catch (err) {
    console.error("Error getting models:", err);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
};

// PUT /api/system/models/:modelId - Update model config (placeholder - models are managed via AI config)
export const updateModelConfig = async (req, res) => {
  try {
    // Models are managed through AI config, not individually
    res.status(501).json({ 
      success: false, 
      error: "Model configuration is managed through AI configuration" 
    });
  } catch (err) {
    console.error("Error updating model config:", err);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
};

// POST /api/system/backup - Create system backup (placeholder)
export const createBackup = async (req, res) => {
  try {
    // TODO: Implement backup functionality
    res.status(501).json({ 
      success: false, 
      error: "Backup functionality not yet implemented" 
    });
  } catch (err) {
    console.error("Error creating backup:", err);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
};

// POST /api/system/restore/:backupId - Restore system backup (placeholder)
export const restoreBackup = async (req, res) => {
  try {
    // TODO: Implement restore functionality
    res.status(501).json({ 
      success: false, 
      error: "Restore functionality not yet implemented" 
    });
  } catch (err) {
    console.error("Error restoring backup:", err);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
};

