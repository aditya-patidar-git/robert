import mongoose from "mongoose";

const ConversationBehaviorConfigSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    unique: true,
    default: "default"
  },
  // Progress Indicators Settings
  progressIndicators: {
    enabled: { 
      type: Boolean, 
      default: true 
    },
    acknowledgmentThresholdMs: { 
      type: Number, 
      default: 2000,
      min: 0,
      max: 10000
    },
    updateIntervalMs: { 
      type: Number, 
      default: 12000,
      min: 1000,
      max: 30000
    },
    acknowledgmentMessages: {
      type: [String],
      default: [
        "Let me check that for you.",
        "I'm looking into that now.",
        "Just a moment, please."
      ]
    },
    updateMessages: {
      type: [String],
      default: [
        "This is taking a bit longer than usual, please hold on.",
        "I'm still working on that, just a moment.",
        "Almost there, please bear with me."
      ]
    }
  },
  // Silence Detection Settings
  silenceDetection: {
    enabled: { 
      type: Boolean, 
      default: true 
    },
    silenceThresholdMs: { 
      type: Number, 
      default: 28000,
      min: 5000,
      max: 60000
    },
    proactiveMessages: {
      type: [String],
      default: [
        "Are you still there?",
        "Is there anything else I can help you with?",
        "Would you like me to continue?"
      ]
    },
    maxProactiveAttempts: { 
      type: Number, 
      default: 2,
      min: 0,
      max: 5
    }
  },
  // Conversation Flow Settings
  conversationFlow: {
    userSpeakingWindowMs: { 
      type: Number, 
      default: 6000,
      min: 1000,
      max: 30000
    },
    adaptivePacing: { 
      type: Boolean, 
      default: true 
    },
    adaptationWindowSize: {
      type: Number,
      default: 5,
      min: 3,
      max: 20
    },
    minAdaptiveWindowMs: {
      type: Number,
      default: 3000,
      min: 1000,
      max: 10000
    },
    maxAdaptiveWindowMs: {
      type: Number,
      default: 15000,
      min: 5000,
      max: 30000
    },
    minResponseDelayMs: { 
      type: Number, 
      default: 300,
      min: 0,
      max: 2000
    },
    maxResponseDelayMs: { 
      type: Number, 
      default: 2000,
      min: 500,
      max: 5000
    },
    speechContinuation: {
      enabled: { 
        type: Boolean, 
        default: true 
      },
      gracePeriodMs: { 
        type: Number, 
        default: 1500, 
        min: 500, 
        max: 5000 
      },
      pauseDetectionMs: { 
        type: Number, 
        default: 800, 
        min: 300, 
        max: 2000 
      },
      maxGracePeriodExtensions: {
        type: Number,
        default: 2,
        min: 0,
        max: 5
      }
    }
  },
  bargeInTail: {
    drainBufferMs: {
      type: Number,
      default: 2000,
      min: 500,
      max: 5000
    },
    maxTailMs: {
      type: Number,
      default: 8000,
      min: 1000,
      max: 30000
    },
    /** After last 20ms frame sent to Twilio, barge-in still treats agent as "playing" for this long (OpenAI may clear response before the ear hears the end). */
    twilioPlayoutAfterLastFrameMs: {
      type: Number,
      default: 4500,
      min: 0,
      max: 60000
    }
  },
  // Error Handling Settings
  errorHandling: {
    retryEnabled: { 
      type: Boolean, 
      default: true 
    },
    maxRetries: { 
      type: Number, 
      default: 2,
      min: 0,
      max: 5
    },
    retryBackoffMs: { 
      type: Number, 
      default: 1000,
      min: 100,
      max: 10000
    },
    userFriendlyErrorMessages: { 
      type: Boolean, 
      default: true 
    }
  },
  // Quality Metrics Settings
  qualityMetrics: {
    enabled: { 
      type: Boolean, 
      default: true 
    },
    trackLatency: { 
      type: Boolean, 
      default: true 
    },
    trackInterruptions: { 
      type: Boolean, 
      default: true 
    },
    trackToolSuccess: { 
      type: Boolean, 
      default: true 
    }
  },
  // Proactive Assistance Settings
  proactiveAssistance: {
    enabled: { 
      type: Boolean, 
      default: true 
    },
    hesitationThresholdMs: { 
      type: Number, 
      default: 3000,
      min: 1000,
      max: 10000
    },
    enableFollowUpSuggestions: { 
      type: Boolean, 
      default: true 
    },
    suggestionDelayMs: { 
      type: Number, 
      default: 2000,
      min: 500,
      max: 5000
    }
  },
  /** When true (default), allow brief tool-free replies while a long-running browser tool is active (silence between holding messages). */
  allowMidToolEpistemicReplies: {
    type: Boolean,
    default: true
  },
  // System Settings
  isActive: { 
    type: Boolean, 
    default: true 
  },
  createdBy: { 
    type: String, 
    default: "admin"
  }
}, { 
  timestamps: true 
});

export default mongoose.model("ConversationBehaviorConfig", ConversationBehaviorConfigSchema);

