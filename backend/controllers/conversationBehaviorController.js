import ConversationBehaviorConfig from "../models/ConversationBehaviorConfig.js";
import configSyncService from "../services/configSyncService.js";

// GET /api/conversation-behavior/config
export const getConfig = async (req, res) => {
  try {
    const config = await ConversationBehaviorConfig.findOne({ isActive: true });
    
    if (!config) {
      // Return default config if none exists
      return res.json({
        success: true,
        config: {
          name: "default",
          progressIndicators: {
            enabled: true,
            acknowledgmentThresholdMs: 2000,
            updateIntervalMs: 5000,
            acknowledgmentMessages: [
              "Let me check that for you.",
              "I'm looking into that now.",
              "Just a moment, please."
            ],
            updateMessages: [
              "This is taking a bit longer than usual, please hold on.",
              "I'm still working on that, just a moment.",
              "Almost there, please bear with me."
            ]
          },
          silenceDetection: {
            enabled: true,
            silenceThresholdMs: 15000,
            proactiveMessages: [
              "Are you still there?",
              "Is there anything else I can help you with?",
              "Would you like me to continue?"
            ],
            maxProactiveAttempts: 2
          },
          conversationFlow: {
            userSpeakingWindowMs: 6000,
            adaptivePacing: true,
            adaptationWindowSize: 5,
            minAdaptiveWindowMs: 3000,
            maxAdaptiveWindowMs: 15000,
            minResponseDelayMs: 300,
            maxResponseDelayMs: 2000,
            speechContinuation: {
              enabled: true,
              gracePeriodMs: 1500,
              pauseDetectionMs: 800,
              maxGracePeriodExtensions: 2
            }
          },
          errorHandling: {
            retryEnabled: true,
            maxRetries: 2,
            retryBackoffMs: 1000,
            userFriendlyErrorMessages: true
          },
          qualityMetrics: {
            enabled: true,
            trackLatency: true,
            trackInterruptions: true,
            trackToolSuccess: true
          },
          proactiveAssistance: {
            enabled: true,
            hesitationThresholdMs: 3000,
            enableFollowUpSuggestions: true,
            suggestionDelayMs: 2000
          },
          isActive: true
        }
      });
    }

    res.json({
      success: true,
      config: config
    });
  } catch (err) {
    console.error("Error fetching conversation behavior config:", err);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
};

// POST /api/conversation-behavior/config
export const updateConfig = async (req, res) => {
  try {
    const raw = req.body;
    const { _id, __v, ...configData } = raw;

    let config = await ConversationBehaviorConfig.findOne({ isActive: true });
    
    if (!config) {
      await ConversationBehaviorConfig.updateMany(
        { isActive: true },
        { isActive: false }
      );
      config = new ConversationBehaviorConfig({
        name: configData.name || "default",
        ...configData,
        isActive: true,
        createdBy: req.user?.username || "admin"
      });
    } else {
      Object.assign(config, configData);
      if (req.user?.username) {
        config.createdBy = req.user.username;
      }
    }

    await config.save();

    configSyncService.notifyConfigChange('conversation-behavior', null, {
      changedBy: req.user?.id || req.user?.username || 'admin'
    });

    res.json({
      success: true,
      message: "Conversation behavior configuration updated successfully",
      config: config
    });
  } catch (err) {
    console.error("Error updating conversation behavior config:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Internal server error" 
    });
  }
};

