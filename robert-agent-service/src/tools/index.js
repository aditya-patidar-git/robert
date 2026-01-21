import webSearchTool from './webSearch.js';
import calendarTool from './calendar.js';
import emailTool from './email.js';
import sendSMSTool from './sendSMS.js';
import generateReferenceIdTool from './generateReferenceId.js';
import crmTool from './crm.js';
import crmBrowserTool from './crmBrowserTool.js';
import paymentsTool from './payments.js';
import fileSearchTool from './fileSearch.js';
import transferCallTool from './transferCall.js';
import kbaVerificationTool from './kbaVerification.js';
import complaintSubmissionTool from './complaintSubmission.js';
import clientVerificationTool from './clientVerification.js';
import configManager from '../agent/configManager.js';
import ToolRegistry from './toolRegistry.js';
import ToolExecutor from './toolExecutor.js';
import { getToolDefinitions } from './toolDefinitions.js';
import { bookingStepTools } from './bookingSteps/index.js';

/**
 * Tool Executor for OpenAI Realtime API
 * Manages tool registration, execution, and result formatting
 * 
 * This is a facade that combines ToolRegistry, ToolExecutor, and tool definitions
 * to maintain backward compatibility with existing code.
 */
class UnifiedToolExecutor {
  constructor() {
    // Initialize tool registry
    this.toolRegistry = new ToolRegistry();
    this.registerTools();
    
    // Initialize tool executor with registry and config manager
    this.toolExecutor = new ToolExecutor(this.toolRegistry, configManager);
    
    // Expose rate limit checkers for backward compatibility
    this.rateLimitTrackers = this.toolExecutor.rateLimitTrackers;
    this.defaultTimeout = this.toolExecutor.defaultTimeout;
  }

  /**
   * Register all available tools
   */
  registerTools() {
    // Register tool implementations
    const tools = new Map([
      ['web_search', webSearchTool],
      ['calendar', calendarTool],
      ['email', emailTool],
      ['send_sms', sendSMSTool],
      ['generate_reference_id', generateReferenceIdTool],
      ['crm', crmTool],
      ['crm_browser', crmBrowserTool],
      ['payments', paymentsTool],
      ['file_search', fileSearchTool],
      ['transfer_call', transferCallTool],
      ['kba_verification', kbaVerificationTool],
      ['complaint_submission', complaintSubmissionTool],
      ['client_verification', clientVerificationTool]
    ]);
    
    // Register step-based booking tools
    for (const [toolName, toolImpl] of Object.entries(bookingStepTools)) {
      tools.set(toolName, toolImpl);
    }
    
    this.toolRegistry.registerTools(tools);
    
    // Log registered tools (excluding booking workflow tools)
    const allTools = this.toolRegistry.getAvailableTools();
    const publicTools = allTools.filter(toolName => !toolName.startsWith('booking_step_'));
    console.log('📋 [TOOL EXECUTOR] Registered tools:', publicTools.join(', '));
  }

  /**
   * Get tool definitions for OpenAI Realtime API session.update
   * @returns {Array} Array of tool definition objects
   */
  getToolDefinitions() {
    return getToolDefinitions();
  }

  /**
   * Check rate limit for a tool (delegates to ToolExecutor)
   * @param {string} toolName - Tool name
   * @param {Object} rateLimitConfig - Rate limit configuration { limit, windowMs }
   * @returns {boolean} True if within rate limit
   */
  checkRateLimit(toolName, rateLimitConfig) {
    return this.toolExecutor.checkRateLimit(toolName, rateLimitConfig);
  }

  /**
   * Execute a tool (delegates to ToolExecutor)
   * @param {string} toolName - Name of the tool to execute
   * @param {object} parameters - Tool parameters
   * @param {object} callContext - Call context (callSid, phoneNumber, etc.)
   * @param {Function} progressCallback - Optional callback for progress updates
   * @param {number} timeout - Execution timeout in ms (optional)
   * @returns {Promise<object>} Tool execution result
   */
  async execute(toolName, parameters, callContext = {}, progressCallback = null, timeout = this.defaultTimeout) {
    return this.toolExecutor.execute(toolName, parameters, callContext, progressCallback, timeout);
  }

  /**
   * Check if a tool is available (delegates to ToolRegistry)
   * @param {string} toolName - Name of the tool
   * @returns {boolean} True if tool exists
   */
  hasTool(toolName) {
    return this.toolRegistry.has(toolName);
  }

  /**
   * Get list of available tool names (delegates to ToolRegistry)
   * @returns {Array<string>} Array of tool names
   */
  getAvailableTools() {
    return this.toolRegistry.getAvailableTools();
  }

  /**
   * Update tool usage statistics in database (delegates to ToolExecutor)
   * @param {string} toolName - Tool name
   */
  async updateToolUsage(toolName) {
    return this.toolExecutor.updateToolUsage(toolName);
  }
}

// Export singleton instance for backward compatibility
const toolExecutor = new UnifiedToolExecutor();
export default toolExecutor;
