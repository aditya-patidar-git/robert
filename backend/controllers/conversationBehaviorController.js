import ConversationBehaviorConfig from "../models/ConversationBehaviorConfig.js";

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
            minResponseDelayMs: 300,
            maxResponseDelayMs: 2000
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
    const configData = req.body;

    // Find active config or create new one
    let config = await ConversationBehaviorConfig.findOne({ isActive: true });
    
    if (!config) {
      // Deactivate any existing configs
      await ConversationBehaviorConfig.updateMany(
        { isActive: true },
        { isActive: false }
      );
      
      // Create new config
      config = new ConversationBehaviorConfig({
        name: configData.name || "default",
        ...configData,
        isActive: true,
        createdBy: req.user?.username || "admin"
      });
    } else {
      // Update existing config
      Object.assign(config, configData);
      if (req.user?.username) {
        config.createdBy = req.user.username;
      }
    }

    await config.save();

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

