/**
 * Model Registry
 * Centralized management of all Mongoose models for backup/restore operations
 * 
 * Following single-responsibility principle - this module handles model registration
 * and provides utilities for bulk operations across models.
 */

import AIConfig from './AIConfig.js';
import AudioConfig from './AudioConfig.js';
import TelephonyConfig from './TelephonyConfig.js';
import ToolConfig from './ToolConfig.js';
import PrivacyConfig from './PrivacyConfig.js';
import CRMTasksConfig from './CRMTasksConfig.js';
import ConversationBehaviorConfig from './ConversationBehaviorConfig.js';
import User from './User.js';
import Allowlist from './Allowlist.js';
import Booking from './Booking.js';
import CallMemory from './CallMemory.js';
import ConversationContext from './ConversationContext.js';
import UnansweredQuestion from './UnansweredQuestion.js';
import Prompt from './Prompt.js';
import PromptVersion from './PromptVersion.js';
import KnowledgeBase from './KnowledgeBase.js';
import Voice from './Voice.js';
import LanguageVoiceMapping from './LanguageVoiceMapping.js';
import AuditLog from './AuditLog.js';
import Alert from './Alert.js';
import DSARRequest from './DSARRequest.js';
import CallRecord from './CallRecord.js';
import ComplaintRecord from './ComplaintRecord.js';
import EscalationLog from './EscalationLog.js';
import Provenance from './Provenance.js';
import FlowParameterOverride from './FlowParameterOverride.js';
import ModelHistory from './ModelHistory.js';
import SMSTemplate from './SMSTemplate.js';
import EmailTemplate from './EmailTemplate.js';
// Note: BaseTemplate is a Schema (not a Model) used by EmailTemplate/SMSTemplate discriminators
import PaymentGatewayConfig from './PaymentGatewayConfig.js';
import PaymentRecord from './PaymentRecord.js';

/**
 * Model registry with metadata for backup/restore operations
 * 
 * Fields:
 * - model: The Mongoose model
 * - category: Grouping for UI (config, data, logs, users)
 * - backupPriority: Order for restore (configs first, then data)
 * - excludeFields: Fields to exclude from backup (sensitive data)
 * - isSingleton: True if collection should have only one document
 */
export const modelRegistry = {
  // Configuration models (singleton - one doc each)
  aiConfig: {
    model: AIConfig,
    category: 'config',
    backupPriority: 1,
    excludeFields: [],
    isSingleton: true,
    displayName: 'AI Configuration'
  },
  audioConfig: {
    model: AudioConfig,
    category: 'config',
    backupPriority: 1,
    excludeFields: [],
    isSingleton: true,
    displayName: 'Audio Configuration'
  },
  telephonyConfig: {
    model: TelephonyConfig,
    category: 'config',
    backupPriority: 1,
    excludeFields: [],
    isSingleton: true,
    displayName: 'Telephony Configuration'
  },
  toolConfig: {
    model: ToolConfig,
    category: 'config',
    backupPriority: 1,
    excludeFields: [],
    isSingleton: true,
    displayName: 'Tool Configuration'
  },
  privacyConfig: {
    model: PrivacyConfig,
    category: 'config',
    backupPriority: 1,
    excludeFields: [],
    isSingleton: true,
    displayName: 'Privacy Configuration'
  },
  crmTasksConfig: {
    model: CRMTasksConfig,
    category: 'config',
    backupPriority: 1,
    excludeFields: [],
    isSingleton: true,
    displayName: 'CRM Tasks Configuration'
  },
  conversationBehaviorConfig: {
    model: ConversationBehaviorConfig,
    category: 'config',
    backupPriority: 1,
    excludeFields: [],
    isSingleton: true,
    displayName: 'Conversation Behavior Configuration'
  },
  paymentGatewayConfig: {
    model: PaymentGatewayConfig,
    category: 'config',
    backupPriority: 1,
    excludeFields: ['apiKey', 'secretKey'], // Exclude sensitive payment credentials
    isSingleton: true,
    displayName: 'Payment Gateway Configuration'
  },

  // User management models
  users: {
    model: User,
    category: 'users',
    backupPriority: 2,
    excludeFields: ['passwordHash'], // Never backup password hashes
    isSingleton: false,
    displayName: 'Users'
  },
  allowlist: {
    model: Allowlist,
    category: 'users',
    backupPriority: 2,
    excludeFields: [],
    isSingleton: false,
    displayName: 'Allowlist'
  },

  // Content models (prompts, KB, templates)
  prompts: {
    model: Prompt,
    category: 'content',
    backupPriority: 3,
    excludeFields: [],
    isSingleton: false,
    displayName: 'Prompts'
  },
  promptVersions: {
    model: PromptVersion,
    category: 'content',
    backupPriority: 3,
    excludeFields: [],
    isSingleton: false,
    displayName: 'Prompt Versions'
  },
  knowledgeBase: {
    model: KnowledgeBase,
    category: 'content',
    backupPriority: 3,
    excludeFields: [],
    isSingleton: false,
    displayName: 'Knowledge Base'
  },
  voices: {
    model: Voice,
    category: 'content',
    backupPriority: 3,
    excludeFields: [],
    isSingleton: false,
    displayName: 'Voices'
  },
  languageVoiceMappings: {
    model: LanguageVoiceMapping,
    category: 'content',
    backupPriority: 3,
    excludeFields: [],
    isSingleton: false,
    displayName: 'Language Voice Mappings'
  },
  flowParameterOverrides: {
    model: FlowParameterOverride,
    category: 'content',
    backupPriority: 3,
    excludeFields: [],
    isSingleton: false,
    displayName: 'Flow Parameter Overrides'
  },
  smsTemplates: {
    model: SMSTemplate,
    category: 'content',
    backupPriority: 3,
    excludeFields: [],
    isSingleton: false,
    displayName: 'SMS Templates'
  },
  emailTemplates: {
    model: EmailTemplate,
    category: 'content',
    backupPriority: 3,
    excludeFields: [],
    isSingleton: false,
    displayName: 'Email Templates'
  },
  // Note: BaseTemplate is excluded - it's a Schema used by EmailTemplate/SMSTemplate, not a standalone Model

  // Operational data models
  bookings: {
    model: Booking,
    category: 'data',
    backupPriority: 4,
    excludeFields: [],
    isSingleton: false,
    displayName: 'Bookings'
  },
  callMemory: {
    model: CallMemory,
    category: 'data',
    backupPriority: 4,
    excludeFields: [],
    isSingleton: false,
    displayName: 'Call Memory'
  },
  conversationContexts: {
    model: ConversationContext,
    category: 'data',
    backupPriority: 4,
    excludeFields: [],
    isSingleton: false,
    displayName: 'Conversation Contexts'
  },
  unansweredQuestions: {
    model: UnansweredQuestion,
    category: 'data',
    backupPriority: 4,
    excludeFields: [],
    isSingleton: false,
    displayName: 'Unanswered Questions'
  },
  dsarRequests: {
    model: DSARRequest,
    category: 'data',
    backupPriority: 4,
    excludeFields: [],
    isSingleton: false,
    displayName: 'DSAR Requests'
  },
  paymentRecords: {
    model: PaymentRecord,
    category: 'data',
    backupPriority: 4,
    excludeFields: ['cardLast4', 'cardBrand'], // Mask payment details
    isSingleton: false,
    displayName: 'Payment Records'
  },

  // Log/audit models (optional backup)
  callRecords: {
    model: CallRecord,
    category: 'logs',
    backupPriority: 5,
    excludeFields: [],
    isSingleton: false,
    displayName: 'Call Records'
  },
  auditLogs: {
    model: AuditLog,
    category: 'logs',
    backupPriority: 5,
    excludeFields: [],
    isSingleton: false,
    displayName: 'Audit Logs'
  },
  alerts: {
    model: Alert,
    category: 'logs',
    backupPriority: 5,
    excludeFields: [],
    isSingleton: false,
    displayName: 'Alerts'
  },
  complaintRecords: {
    model: ComplaintRecord,
    category: 'logs',
    backupPriority: 5,
    excludeFields: [],
    isSingleton: false,
    displayName: 'Complaint Records'
  },
  escalationLogs: {
    model: EscalationLog,
    category: 'logs',
    backupPriority: 5,
    excludeFields: [],
    isSingleton: false,
    displayName: 'Escalation Logs'
  },
  provenances: {
    model: Provenance,
    category: 'logs',
    backupPriority: 5,
    excludeFields: [],
    isSingleton: false,
    displayName: 'Provenance Records'
  },
  modelHistory: {
    model: ModelHistory,
    category: 'logs',
    backupPriority: 5,
    excludeFields: [],
    isSingleton: false,
    displayName: 'Model History'
  }
};

/**
 * Get all model keys
 * @returns {string[]} Array of model registry keys
 */
export function getAllModelKeys() {
  return Object.keys(modelRegistry);
}

/**
 * Get models by category
 * @param {string} category - Category name (config, users, content, data, logs)
 * @returns {Object} Filtered model registry
 */
export function getModelsByCategory(category) {
  return Object.fromEntries(
    Object.entries(modelRegistry).filter(([_, info]) => info.category === category)
  );
}

/**
 * Get models sorted by backup priority
 * @returns {Array} Array of [key, info] pairs sorted by priority
 */
export function getModelsSortedByPriority() {
  return Object.entries(modelRegistry)
    .sort((a, b) => a[1].backupPriority - b[1].backupPriority);
}

/**
 * Get collection names for UI display
 * @returns {Object} Map of key to displayName
 */
export function getCollectionDisplayNames() {
  return Object.fromEntries(
    Object.entries(modelRegistry).map(([key, info]) => [key, info.displayName])
  );
}

/**
 * Get default backup collections (excludes logs and users by default)
 * Users are excluded to keep sessions intact during restore operations
 * @returns {string[]} Array of model keys to backup by default
 */
export function getDefaultBackupCollections() {
  return Object.entries(modelRegistry)
    .filter(([_, info]) => info.category !== 'logs' && info.category !== 'users')
    .map(([key]) => key);
}

/**
 * Check if a model key is valid
 * @param {string} key - Model registry key
 * @returns {boolean}
 */
export function isValidModelKey(key) {
  return key in modelRegistry;
}

// Export individual models for direct imports
export {
  AIConfig,
  AudioConfig,
  TelephonyConfig,
  ToolConfig,
  PrivacyConfig,
  CRMTasksConfig,
  ConversationBehaviorConfig,
  User,
  Allowlist,
  Booking,
  CallMemory,
  ConversationContext,
  UnansweredQuestion,
  Prompt,
  PromptVersion,
  KnowledgeBase,
  Voice,
  LanguageVoiceMapping,
  AuditLog,
  Alert,
  DSARRequest,
  CallRecord,
  ComplaintRecord,
  EscalationLog,
  Provenance,
  FlowParameterOverride,
  ModelHistory,
  SMSTemplate,
  EmailTemplate,
  PaymentGatewayConfig,
  PaymentRecord
};

export default modelRegistry;
