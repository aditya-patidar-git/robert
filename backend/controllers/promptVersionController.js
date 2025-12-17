import PromptVersion from "../models/PromptVersion.js";
import diffService from "../services/diffService.js";

// Get all versions for global prompt
export const getPromptVersions = async (req, res) => {
  try {
    const promptId = req.query.promptId || 'global';
    const versions = await PromptVersion.find({ promptId })
      .sort({ version: -1 })
      .select('-__v');
    
    // Populate author names if User model is available
    try {
      const User = (await import("../models/User.js")).default;
      const versionsWithAuthors = await Promise.all(
        versions.map(async (version) => {
          const versionObj = version.toObject();
          if (version.createdBy) {
            try {
              // Try to find user by ID first, then by username/email
              let user = await User.findById(version.createdBy);
              if (!user) {
                user = await User.findOne({ 
                  $or: [
                    { username: version.createdBy },
                    { email: version.createdBy }
                  ]
                });
              }
              if (user) {
                versionObj.createdByName = user.username || user.email || user.name || version.createdBy;
              } else {
                versionObj.createdByName = version.createdBy;
              }
            } catch (userError) {
              // If user lookup fails, use createdBy as fallback
              versionObj.createdByName = version.createdBy;
            }
          } else {
            versionObj.createdByName = 'admin';
          }
          return versionObj;
        })
      );
      
      res.json({
        status: "success",
        versions: versionsWithAuthors
      });
    } catch (populateError) {
      // If User model is not available or populate fails, return versions as-is
      res.json({
        status: "success",
        versions
      });
    }
  } catch (error) {
    console.error("Error fetching prompt versions:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Get specific version by ID
export const getPromptVersion = async (req, res) => {
  try {
    const { versionId } = req.params;
    const version = await PromptVersion.findById(versionId);
    
    if (!version) {
      return res.status(404).json({
        status: "error",
        message: "Version not found"
      });
    }
    
    res.json({
      status: "success",
      version
    });
  } catch (error) {
    console.error("Error fetching prompt version:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Get current active version
export const getCurrentVersion = async (req, res) => {
  try {
    const promptId = req.query.promptId || 'global';
    const version = await PromptVersion.findOne({ promptId, isActive: true })
      .sort({ version: -1 });
    
    if (!version) {
      return res.status(404).json({
        status: "error",
        message: "No active version found"
      });
    }
    
    res.json({
      status: "success",
      version
    });
  } catch (error) {
    console.error("Error fetching current version:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Rollback to specific version
export const rollbackToVersion = async (req, res) => {
  try {
    const { versionId } = req.params;
    const { changeReason } = req.body;
    
    const targetVersion = await PromptVersion.findById(versionId);
    
    if (!targetVersion) {
      return res.status(404).json({
        status: "error",
        message: "Version not found"
      });
    }
    
    const promptId = targetVersion.promptId;
    
    // Get current active version to use as previousContent
    const currentVersion = await PromptVersion.findOne({ promptId, isActive: true });
    const previousContent = currentVersion ? currentVersion.content : '';
    
    // Get the highest version number
    const latestVersion = await PromptVersion.findOne({ promptId })
      .sort({ version: -1 })
      .select('version');
    
    const nextVersion = latestVersion ? latestVersion.version + 1 : 1;
    
    // Mark all previous versions as inactive
    await PromptVersion.updateMany(
      { promptId, isActive: true },
      { isActive: false }
    );
    
    // Create new version with content from target version (rollback creates new version)
    const rollbackVersion = new PromptVersion({
      promptId,
      version: nextVersion,
      content: targetVersion.content,
      previousContent: previousContent,
      createdBy: req.user?.id || req.user?.username || 'admin',
      changeReason: changeReason || `Rollback to version ${targetVersion.version}`,
      isActive: true,
      metadata: {
        rolledBackFrom: targetVersion._id,
        rolledBackVersion: targetVersion.version,
        originalMetadata: targetVersion.metadata || {}
      }
    });
    
    await rollbackVersion.save();
    
    // IMPORTANT: Update AIConfig.globalPrompt to match the rolled-back content
    const AIConfig = (await import("../models/AIConfig.js")).default;
    let config = await AIConfig.findOne({ isActive: true });
    if (!config) {
      config = new AIConfig();
    }
    config.globalPrompt = targetVersion.content;
    config.createdBy = req.user?.id || req.user?.username || 'admin';
    await config.save();
    
    res.json({
      status: "success",
      message: `Rolled back to version ${targetVersion.version}. New version ${nextVersion} created.`,
      version: rollbackVersion,
      promptContent: rollbackVersion.content
    });
  } catch (error) {
    console.error("Error rolling back version:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Activate a specific version
export const activateVersion = async (req, res) => {
  try {
    const { versionId } = req.params;
    
    const targetVersion = await PromptVersion.findById(versionId);
    
    if (!targetVersion) {
      return res.status(404).json({
        status: "error",
        message: "Version not found"
      });
    }

    const promptId = targetVersion.promptId;

    // Mark all other versions as inactive
    await PromptVersion.updateMany(
      { promptId, isActive: true },
      { isActive: false }
    );

    // Mark the selected version as active
    targetVersion.isActive = true;
    await targetVersion.save();

    // Update AIConfig.globalPrompt to match the activated version's content
    const AIConfig = (await import("../models/AIConfig.js")).default;
    let config = await AIConfig.findOne({ isActive: true });
    if (!config) {
      config = new AIConfig();
    }
    config.globalPrompt = targetVersion.content;
    config.createdBy = req.user?.id || req.user?.username || 'admin';
    await config.save();

    res.json({
      status: "success",
      message: `Version ${targetVersion.version} activated successfully`,
      version: targetVersion,
      promptContent: targetVersion.content
    });
  } catch (error) {
    console.error("Error activating version:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Clear all inactive versions
export const clearInactiveVersions = async (req, res) => {
  try {
    const promptId = req.query.promptId || 'global';
    
    // Find and delete all inactive versions
    const result = await PromptVersion.deleteMany({
      promptId,
      isActive: false
    });

    res.json({
      status: "success",
      message: `Cleared ${result.deletedCount} inactive version(s)`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error("Error clearing inactive versions:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Compare two versions
export const compareVersions = async (req, res) => {
  try {
    const { versionId1, versionId2 } = req.params;
    
    const version1 = await PromptVersion.findById(versionId1);
    const version2 = await PromptVersion.findById(versionId2);
    
    if (!version1 || !version2) {
      return res.status(404).json({
        status: "error",
        message: "One or both versions not found"
      });
    }

    // Use diff service for better comparison
    const diff = diffService.compareVersions(version1.content, version2.content, { mode: 'lines' });
    const formattedDiff = diffService.formatDiff(diff, { format: 'side-by-side' });

    res.json({
      status: "success",
      version1: {
        id: version1._id,
        version: version1.version,
        content: version1.content,
        createdAt: version1.createdAt,
        createdBy: version1.createdBy
      },
      version2: {
        id: version2._id,
        version: version2.version,
        content: version2.content,
        createdAt: version2.createdAt,
        createdBy: version2.createdBy
      },
      diff: formattedDiff
    });
  } catch (error) {
    console.error("Error comparing versions:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Get diff between versions
export const getVersionDiff = async (req, res) => {
  try {
    const { versionId } = req.params;
    const { compareWith } = req.query; // Optional: compare with another version ID
    
    const version = await PromptVersion.findById(versionId);
    
    if (!version) {
      return res.status(404).json({
        status: "error",
        message: "Version not found"
      });
    }

    let compareVersion = null;
    if (compareWith) {
      compareVersion = await PromptVersion.findById(compareWith);
      if (!compareVersion) {
        return res.status(404).json({
          status: "error",
          message: "Compare version not found"
        });
      }
    } else if (version.previousContent) {
      // Compare with previous content if available
      const diff = diffService.compareVersions(version.previousContent, version.content, { mode: 'lines' });
      const formattedDiff = diffService.formatDiff(diff, { format: 'unified' });
      
      return res.json({
        status: "success",
        diff: formattedDiff
      });
    } else {
      return res.status(400).json({
        status: "error",
        message: "No previous version or compare version specified"
      });
    }

    // Compare with specified version
    const diff = diffService.compareVersions(compareVersion.content, version.content, { mode: 'lines' });
    const formattedDiff = diffService.formatDiff(diff, { format: 'unified' });

    res.json({
      status: "success",
      diff: formattedDiff
    });
  } catch (error) {
    console.error("Error getting version diff:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Restore version (create new version from old)
export const restoreVersion = async (req, res) => {
  try {
    const { versionId } = req.params;
    const { changeReason } = req.body;
    
    const sourceVersion = await PromptVersion.findById(versionId);
    
    if (!sourceVersion) {
      return res.status(404).json({
        status: "error",
        message: "Version not found"
      });
    }

    const promptId = sourceVersion.promptId;
    
    // Get current active version to use as previous content
    const currentVersion = await PromptVersion.findOne({ promptId, isActive: true });
    const previousContent = currentVersion ? currentVersion.content : '';
    
    // Get next version number
    const maxVersion = await PromptVersion.findOne({ promptId })
      .sort({ version: -1 });
    const nextVersion = maxVersion ? maxVersion.version + 1 : 1;

    // Create new version with content from source version
    const restoredVersion = new PromptVersion({
      promptId,
      version: nextVersion,
      content: sourceVersion.content,
      previousContent: previousContent,
      createdBy: req.user?.id || req.user?.username || 'admin',
      changeReason: changeReason || `Restored from version ${sourceVersion.version}`,
      isActive: true,
      metadata: {
        restoredFrom: sourceVersion._id,
        restoredVersion: sourceVersion.version
      }
    });
    
    await restoredVersion.save();
    
    // Deactivate other versions
    await PromptVersion.updateMany(
      { promptId, _id: { $ne: restoredVersion._id } },
      { isActive: false }
    );
    
    // Update AIConfig.globalPrompt
    const AIConfig = (await import("../models/AIConfig.js")).default;
    let config = await AIConfig.findOne({ isActive: true });
    if (!config) {
      config = new AIConfig();
    }
    config.globalPrompt = sourceVersion.content;
    config.createdBy = req.user?.id || req.user?.username || 'admin';
    await config.save();
    
    res.json({
      status: "success",
      message: `Version ${sourceVersion.version} restored. New version ${nextVersion} created.`,
      version: restoredVersion,
      promptContent: restoredVersion.content
    });
  } catch (error) {
    console.error("Error restoring version:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

