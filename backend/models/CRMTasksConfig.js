import mongoose from "mongoose";

const CRMTasksConfigSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    unique: true,
    default: "default"
  },
  // Task-specific configurations
  tasks: {
    createBooking: {
      enabled: {
        type: Boolean,
        default: true
      },
      requireConfirmation: {
        type: Boolean,
        default: true
      }
    },
    reschedule: {
      enabled: {
        type: Boolean,
        default: true
      },
      requireConfirmation: {
        type: Boolean,
        default: true
      }
    },
    cancel: {
      enabled: {
        type: Boolean,
        default: true
      },
      requireConfirmation: {
        type: Boolean,
        default: true
      }
    },
    updateRecord: {
      enabled: {
        type: Boolean,
        default: true
      },
      requireConfirmation: {
        type: Boolean,
        default: false
      }
    },
    issueRefund: {
      enabled: {
        type: Boolean,
        default: false
      },
      requireConfirmation: {
        type: Boolean,
        default: true
      }
    }
  },
  // General settings
  generalSettings: {
    dryRunEnforced: {
      type: Boolean,
      default: true
    },
    auditLogging: {
      type: Boolean,
      default: true
    }
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

export default mongoose.model("CRMTasksConfig", CRMTasksConfigSchema);

