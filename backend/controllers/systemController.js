import AudioConfig from "../models/AudioConfig.js";
import TelephonyConfig from "../models/TelephonyConfig.js";
import PrivacyConfig from "../models/PrivacyConfig.js";
import AIConfig from "../models/AIConfig.js";
import ConversationBehaviorConfig from "../models/ConversationBehaviorConfig.js";
import { createAuditLog } from "./auditLogController.js";
import configSyncService from "../services/configSyncService.js";

// GET /api/system/config
export const getSystemConfig = async (req, res) => {
  try {
    // Get all relevant configurations
    const [audioConfig, telephonyConfig, privacyConfig, aiConfig, conversationBehaviorConfig] = await Promise.all([
      AudioConfig.findOne({ isActive: true }),
      TelephonyConfig.findOne({ isActive: true }),
      PrivacyConfig.findOne({ isActive: true }),
      AIConfig.findOne({ isActive: true }),
      ConversationBehaviorConfig.findOne({ isActive: true })
    ]);

    // Combine into system config
    const systemConfig = {
      // MCP Settings (from AIConfig)
      mcpEnabled: aiConfig?.mcpSettings?.enabled ?? true,
      mcpRateLimit: aiConfig?.mcpSettings?.rateLimit ?? 100,
      mcpTimeout: aiConfig?.mcpSettings?.timeout ?? 30,
      
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
      metadataRetention: privacyConfig?.retentionSettings?.metadataRetention ?? 365,
      
      // Conversation Behavior Settings (from ConversationBehaviorConfig)
      conversationBehavior: conversationBehaviorConfig || null
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

    // Update AI Config for MCP settings
    if (configData.mcpEnabled !== undefined || configData.mcpRateLimit !== undefined || configData.mcpTimeout !== undefined) {
      let aiConfig = await AIConfig.findOne({ isActive: true });
      if (!aiConfig) {
        aiConfig = new AIConfig({ name: "default" });
      }
      
      // Initialize mcpSettings if it doesn't exist
      if (!aiConfig.mcpSettings) {
        aiConfig.mcpSettings = {};
      }
      
      if (configData.mcpEnabled !== undefined) {
        aiConfig.mcpSettings.enabled = configData.mcpEnabled;
      }
      if (configData.mcpRateLimit !== undefined) {
        aiConfig.mcpSettings.rateLimit = configData.mcpRateLimit;
      }
      if (configData.mcpTimeout !== undefined) {
        aiConfig.mcpSettings.timeout = configData.mcpTimeout;
      }
      
      await aiConfig.save();
      configSyncService.notifyConfigChange('ai', null, {
        changedBy: req.user?.id || req.user?.username || 'admin'
      });
      console.log("✅ MCP settings saved to AIConfig:", aiConfig.mcpSettings);
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
      configSyncService.notifyConfigChange('telephony', null, {
        changedBy: req.user?.id || req.user?.username || 'admin'
      });
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
      configSyncService.notifyConfigChange('audio', null, {
        changedBy: req.user?.id || req.user?.username || 'admin'
      });
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
      configSyncService.notifyConfigChange('privacy', null, {
        changedBy: req.user?.id || req.user?.username || 'admin'
      });
    }

    const diff = {};
    if (configData.mcpEnabled !== undefined || configData.mcpRateLimit !== undefined || configData.mcpTimeout !== undefined) diff.mcp = true;
    if (configData.outboundCallerId !== undefined || configData.maxConcurrentCalls !== undefined || configData.callTimeout !== undefined || configData.retryAttempts !== undefined || configData.logLevel !== undefined) diff.telephony = true;
    if (configData.vadThreshold !== undefined || configData.startPadding !== undefined || configData.endPadding !== undefined || configData.bargeInPolicy !== undefined || configData.noiseSuppression !== undefined || configData.echoCancellation !== undefined || configData.audioQuality !== undefined || configData.energyThreshold !== undefined || configData.energyThresholdAutoCalibrate !== undefined || configData.noiseSuppressionAlgorithm !== undefined || configData.automaticGainControl !== undefined) diff.audio = true;
    if (configData.transcriptRetention !== undefined || configData.recordingRetention !== undefined || configData.metadataRetention !== undefined) diff.privacy = true;
    if (Object.keys(diff).length > 0 && req.user) {
      await createAuditLog({
        actorId: req.user._id,
        action: 'config.update',
        targetType: 'config',
        targetId: 'system',
        diff,
        req
      });
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

// POST /api/system/backup - Create system backup
export const createBackup = async (req, res) => {
  try {
    const backupService = (await import('../services/backupService.js')).default;
    const { includeScreenshots, includeAuditLogs, collections } = req.body;
    
    const result = await backupService.createBackup({
      includeScreenshots: includeScreenshots || false,
      includeAuditLogs: includeAuditLogs !== false, // default true
      collections: collections || null
    });

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error("Error creating backup:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Internal server error" 
    });
  }
};

// GET /api/system/backups - List all backups
export const listBackups = async (req, res) => {
  try {
    const backupService = (await import('../services/backupService.js')).default;
    const backups = await backupService.listBackups();
    
    res.json({
      success: true,
      backups
    });
  } catch (err) {
    console.error("Error listing backups:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Internal server error" 
    });
  }
};

// GET /api/system/backups/:backupId - Get backup details
export const getBackupDetails = async (req, res) => {
  try {
    const { backupId } = req.params;
    const backupService = (await import('../services/backupService.js')).default;
    const details = await backupService.getBackupDetails(backupId);
    
    res.json({
      success: true,
      ...details
    });
  } catch (err) {
    console.error("Error getting backup details:", err);
    if (err.message === 'Invalid backup ID') {
      return res.status(400).json({ success: false, error: 'Invalid backup ID' });
    }
    res.status(500).json({ 
      success: false, 
      error: err.message || "Internal server error" 
    });
  }
};

// DELETE /api/system/backups/:backupId - Delete backup
export const deleteBackup = async (req, res) => {
  try {
    const { backupId } = req.params;
    const backupService = (await import('../services/backupService.js')).default;
    await backupService.deleteBackup(backupId);
    
    res.json({
      success: true,
      message: 'Backup deleted successfully'
    });
  } catch (err) {
    console.error("Error deleting backup:", err);
    if (err.message === 'Invalid backup ID') {
      return res.status(400).json({ success: false, error: 'Invalid backup ID' });
    }
    res.status(500).json({ 
      success: false, 
      error: err.message || "Internal server error" 
    });
  }
};

// POST /api/system/restore/:backupId - Restore system backup
export const restoreBackup = async (req, res) => {
  try {
    const { backupId } = req.params;
    const { createSafetyBackup, collections, mode } = req.body;
    
    const backupService = (await import('../services/backupService.js')).default;
    
    // Optionally create a safety backup before restore
    if (createSafetyBackup !== false) {
      console.log('📦 Creating safety backup before restore...');
      try {
        await backupService.createBackup({
          description: `Safety backup before restoring ${backupId}`,
          includeAuditLogs: true
        });
      } catch (safetyErr) {
        console.warn('⚠️ Could not create safety backup:', safetyErr.message);
        // Continue with restore even if safety backup fails
      }
    }
    
    const result = await backupService.restoreBackup(backupId, {
      collections: collections || null,
      mode: mode || 'overwrite' // 'overwrite' or 'merge'
    });

    res.json({
      success: result.success,
      ...result
    });
  } catch (err) {
    console.error("Error restoring backup:", err);
    if (err.message === 'Invalid backup ID') {
      return res.status(400).json({ success: false, error: 'Invalid backup ID' });
    }
    res.status(500).json({ 
      success: false, 
      error: err.message || "Internal server error" 
    });
  }
};

// GET /api/system/restore/:backupId/preview - Get restore preview
export const getRestorePreview = async (req, res) => {
  try {
    const { backupId } = req.params;
    const { collections } = req.query;
    
    const backupService = (await import('../services/backupService.js')).default;
    
    // Parse collections from query string if provided
    const collectionsList = collections ? collections.split(',') : null;
    
    const preview = await backupService.getRestorePreview(backupId, collectionsList);
    
    res.json({
      success: true,
      ...preview
    });
  } catch (err) {
    console.error("Error getting restore preview:", err);
    if (err.message === 'Invalid backup ID') {
      return res.status(400).json({ success: false, error: 'Invalid backup ID' });
    }
    res.status(500).json({ 
      success: false, 
      error: err.message || "Internal server error" 
    });
  }
};

// GET /api/system/backup/collections - Get available collections for backup/restore
export const getBackupCollections = async (req, res) => {
  try {
    const backupService = (await import('../services/backupService.js')).default;
    const collections = backupService.getAvailableCollections();
    
    res.json({
      success: true,
      collections
    });
  } catch (err) {
    console.error("Error getting backup collections:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Internal server error" 
    });
  }
};

// POST /api/system/backup/validate/:backupId - Validate backup file
export const validateBackup = async (req, res) => {
  try {
    const { backupId } = req.params;
    const backupService = (await import('../services/backupService.js')).default;
    const validation = await backupService.validateBackup(backupId);
    
    res.json({
      success: true,
      ...validation
    });
  } catch (err) {
    console.error("Error validating backup:", err);
    if (err.message === 'Invalid backup ID') {
      return res.status(400).json({ success: false, error: 'Invalid backup ID' });
    }
    res.status(500).json({ 
      success: false, 
      error: err.message || "Internal server error" 
    });
  }
};

