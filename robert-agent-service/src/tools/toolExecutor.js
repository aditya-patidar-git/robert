/**
 * Tool Executor
 * Handles tool execution with validation, rate limiting, timeout, and metrics
 */

import { trace, SpanStatusCode } from '@opentelemetry/api';
import { validateToolParameters } from '../utils/toolSchemaValidator.js';
import { recordToolMetrics } from '../services/metricsService.js';
import ToolConfig from '../database/models/ToolConfig.js';
import { setCancellationContext } from '../config/cancellationPhrases.js';
import { conversations } from '../shared/state.js';

const tracer = trace.getTracer('robert-agent-service', '1.0.0');

class ToolExecutor {
  constructor(toolRegistry, configManager) {
    this.toolRegistry = toolRegistry;
    this.configManager = configManager;
    this.defaultTimeout = 10000; // 10 seconds
    this.rateLimitTrackers = new Map(); // Track rate limits per tool
    this.globalRateLimitTracker = null; // Track global MCP rate limit
  }

  /**
   * Check global MCP rate limit
   * @returns {boolean} True if within global rate limit
   */
  checkGlobalRateLimit() {
    const globalRateLimit = this.configManager.getMCPRateLimit();
    if (!globalRateLimit) {
      return true; // No global rate limit configured
    }

    const now = Date.now();
    const windowMs = 60000; // 1 minute window for global rate limit

    if (!this.globalRateLimitTracker) {
      this.globalRateLimitTracker = {
        requests: 0,
        windowStart: now
      };
    }

    // Reset window if expired
    if (now - this.globalRateLimitTracker.windowStart >= windowMs) {
      this.globalRateLimitTracker.requests = 0;
      this.globalRateLimitTracker.windowStart = now;
    }

    // Check if under global limit
    if (this.globalRateLimitTracker.requests >= globalRateLimit) {
      return false;
    }

    this.globalRateLimitTracker.requests++;
    return true;
  }

  /**
   * Check rate limit for a tool
   * @param {string} toolName - Tool name
   * @param {Object} rateLimitConfig - Rate limit configuration { limit, windowMs }
   * @returns {boolean} True if within rate limit
   */
  checkRateLimit(toolName, rateLimitConfig) {
    if (!rateLimitConfig || !rateLimitConfig.limit) {
      return true; // No rate limit configured
    }

    const now = Date.now();
    let tracker = this.rateLimitTrackers.get(toolName);

    if (!tracker) {
      tracker = {
        requests: 0,
        windowStart: now
      };
      this.rateLimitTrackers.set(toolName, tracker);
    }

    // Reset window if expired
    if (now - tracker.windowStart >= rateLimitConfig.windowMs) {
      tracker.requests = 0;
      tracker.windowStart = now;
    }

    // Check if under limit
    if (tracker.requests >= rateLimitConfig.limit) {
      return false;
    }

    tracker.requests++;
    return true;
  }

  /**
   * Map course display strings to schema enum. Handles "ITM - Introduction to Motorcycle - £125" etc.
   */
  _normalizeCourseTypeValue(value) {
    if (value == null || typeof value !== 'string') return value;
    const s = value.trim();

    // ITM / Introduction to Motorcycling
    if (/^ITM$|^Introduction to Motorcycling$/i.test(s)) return 'Introduction to Motorcycling';
    if (/ITM|Introduction to Motorcycl(e|ing)/i.test(s)) return 'Introduction to Motorcycling';

    // CBT / Compulsory Basic Training
    if (/^CBT$|^Compulsory Basic Training$/i.test(s)) return 'Compulsory Basic Training';
    if (/Compulsory Basic Training|CBT\b/i.test(s)) {
      if (/Executive/i.test(s)) return 'CBT Executive';
      return 'Compulsory Basic Training';
    }

    // Other courses
    if (/Private Lesson/i.test(s)) return 'Private Lesson';
    if (/Gear Conversion/i.test(s)) return 'Gear Conversion';
    if (/TfL.*Motorcycle Skills/i.test(s)) return 'TfL 1-2-1 Motorcycle Skills';
    if (/TfL.*Beyond CBT/i.test(s)) return 'TfL Beyond CBT';
    if (/Full.*Licence.*Assessment/i.test(s)) return 'Full Licence Assessment';

    return value;
  }

  /**
   * Check if a (non-registered) tool name is an alias for booking_step_select_booking_options.
   * Used only when the tool is not in the registry, to avoid "Unknown tool" for common model mistakes.
   */
  _isBookingOptionsAlias(toolName) {
    if (!toolName || typeof toolName !== 'string') return false;
    const n = toolName.trim().toLowerCase();
    if (n === 'booking_step_select_booking_options') return true; // already canonical
    const aliases = [
      'booking_step_finalize_booking',
      'booking_step_finalize_course_options',
      'booking_step_select_options',
      'booking_step_booking_options',
      'select_booking_options',
      'finalize_booking_options',
      'select_options'
    ];
    if (aliases.includes(n)) return true;
    if (n.startsWith('booking_step_') && (n.includes('option') || n.includes('finalize'))) return true;
    return false;
  }

  /**
   * Check if a (non-registered) tool name is an alias for booking_step_fill_contact_details.
   * The LLM frequently hallucinate "save_contact_details" instead of "fill_contact_details".
   */
  _isFillContactDetailsAlias(toolName) {
    if (!toolName || typeof toolName !== 'string') return false;
    const n = toolName.trim().toLowerCase();
    if (n === 'booking_step_fill_contact_details') return true; // already canonical
    const aliases = [
      'booking_step_save_contact_details',
      'booking_step_save_contact',
      'booking_step_fill_details',
      'booking_step_submit_contact_details',
      'booking_step_enter_contact_details',
      'booking_step_input_contact_details',
      'save_contact_details',
      'fill_contact_details'
    ];
    if (aliases.includes(n)) return true;
    if (n.startsWith('booking_step_') && n.includes('save') && n.includes('contact')) return true;
    return false;
  }

  /**
   * Check if a (non-registered) tool name is an alias for booking_step_lookup_contact.
   * The LLM frequently hallucinates "select_contact" instead of "lookup_contact".
   */
  _isLookupContactAlias(toolName) {
    if (!toolName || typeof toolName !== 'string') return false;
    const n = toolName.trim().toLowerCase();
    if (n === 'booking_step_lookup_contact') return true; // already canonical
    const aliases = [
      'booking_step_select_contact',
      'booking_step_find_contact',
      'booking_step_contact_lookup',
      'booking_step_get_contact',
      'select_contact',
      'lookup_contact',
      'find_contact'
    ];
    if (aliases.includes(n)) return true;
    if (n.startsWith('booking_step_') && n.includes('select') && n.includes('contact')) return true;
    return false;
  }

  /**
   * Normalize parameters for booking_step_select_booking_options when the model sent an alias
   * (e.g. selectedOptions.bikeType -> bikeType, and inject courseType/workflowType from session if missing).
   */
  _normalizeBookingOptionsParams(parameters, callSid) {
    if (!parameters || typeof parameters !== 'object') return parameters;
    const out = { ...parameters };
    const so = out.selectedOptions;
    if (so && typeof so === 'object') {
      if (so.bikeType != null && out.bikeType == null) out.bikeType = so.bikeType;
      if (so.courseType != null && out.courseType == null) out.courseType = so.courseType;
      if (so.cbtType != null && out.cbtType == null) out.cbtType = so.cbtType;
      if (so.duration != null && out.duration == null) out.duration = so.duration;
      delete out.selectedOptions;
    }
    if ((out.courseType == null || out.courseType === '') && callSid && conversations[callSid]?.bookingSession?.courseType) {
      out.courseType = conversations[callSid].bookingSession.courseType;
    }
    if ((out.workflowType == null || out.workflowType === '') && callSid && conversations[callSid]?.bookingSession?.workflowType) {
      const w = conversations[callSid].bookingSession.workflowType;
      if (w === 'existing' || w === 'new') out.workflowType = w;
    }
    return out;
  }

  /**
   * Normalize parameters for booking/cancellation step tools so model-sent aliases match schema.
   * Maps course_name -> courseType, start_date/date/preferred_date -> preferredDate.
   * Derives courseType from selectedSlot.course when missing; normalizes courseType to schema enum.
   */
  normalizeStepToolParameters(toolName, parameters) {
    if (!parameters || typeof parameters !== 'object') {
      return parameters;
    }
    const isStepTool = toolName.startsWith('booking_step_') || toolName.startsWith('cancellation_step_');
    if (!isStepTool) {
      return parameters;
    }
    const normalized = { ...parameters };
    if (normalized.course_name != null && normalized.courseType == null) {
      normalized.courseType = normalized.course_name;
      delete normalized.course_name;
    }
    if (normalized.selectedSlot?.course != null && normalized.courseType == null) {
      normalized.courseType = this._normalizeCourseTypeValue(normalized.selectedSlot.course);
    }
    // booking_step_authenticate schema uses agreedSlot; derive courseType from it when missing
    if (normalized.agreedSlot?.course != null && normalized.courseType == null) {
      normalized.courseType = this._normalizeCourseTypeValue(normalized.agreedSlot.course);
    }
    if (normalized.courseType != null) {
      normalized.courseType = this._normalizeCourseTypeValue(normalized.courseType);
    }
    if (normalized.start_date != null && normalized.preferredDate == null) {
      normalized.preferredDate = normalized.start_date;
      delete normalized.start_date;
    }
    if (normalized.date != null && normalized.preferredDate == null) {
      normalized.preferredDate = normalized.date;
      delete normalized.date;
    }
    if (normalized.preferred_date != null && normalized.preferredDate == null) {
      normalized.preferredDate = normalized.preferred_date;
      delete normalized.preferred_date;
    }
    if (normalized.end_date != null) {
      delete normalized.end_date;
    }
    // booking_step_search_client / cancellation_step_search_client: model often sends phoneOrEmail
    if ((toolName === 'booking_step_search_client' || toolName === 'cancellation_step_search_client') &&
        normalized.phoneOrEmail != null && normalized.customerMobile == null) {
      normalized.customerMobile = normalized.phoneOrEmail;
      delete normalized.phoneOrEmail;
    }
    // Same tools: model sometimes sends "contact" (phone or email) instead of customerMobile/customerEmail
    if ((toolName === 'booking_step_search_client' || toolName === 'cancellation_step_search_client') &&
        normalized.contact != null && normalized.contact !== '') {
      const contact = String(normalized.contact).trim();
      if (contact.includes('@') && (normalized.customerEmail == null || normalized.customerEmail === '')) {
        normalized.customerEmail = contact;
      } else if (normalized.customerMobile == null || normalized.customerMobile === '') {
        // Treat as phone: strip to digits for UK format (no spaces)
        normalized.customerMobile = contact.replace(/\D/g, '') || contact;
      }
      delete normalized.contact;
    }
    // Same tools: model sometimes sends "phone" or "mobile" instead of customerMobile
    if ((toolName === 'booking_step_search_client' || toolName === 'cancellation_step_search_client') &&
        (normalized.phone != null || normalized.mobile != null) && (normalized.customerMobile == null || normalized.customerMobile === '')) {
      const raw = String(normalized.phone ?? normalized.mobile ?? '').trim();
      if (raw) {
        normalized.customerMobile = raw.replace(/\D/g, '') || raw;
      }
      if (normalized.phone != null) delete normalized.phone;
      if (normalized.mobile != null) delete normalized.mobile;
    }
    // booking_step_fill_contact_details: model often sends name/email/mobile; schema expects customerName/customerEmail/customerMobile
    if (toolName === 'booking_step_fill_contact_details') {
      if (normalized.name != null && (normalized.customerName == null || normalized.customerName === '')) {
        normalized.customerName = normalized.name;
        delete normalized.name;
      }
      if (normalized.email != null && (normalized.customerEmail == null || normalized.customerEmail === '')) {
        normalized.customerEmail = normalized.email;
        delete normalized.email;
      }
      if (normalized.mobile != null && (normalized.customerMobile == null || normalized.customerMobile === '')) {
        normalized.customerMobile = normalized.mobile;
        delete normalized.mobile;
      }
    }
    return normalized;
  }

  /**
   * Execute a tool asynchronously with timeout protection
   * @param {string} toolName - Name of the tool to execute
   * @param {object} parameters - Tool parameters
   * @param {object} callContext - Call context (callSid, phoneNumber, etc.)
   * @param {Function} progressCallback - Optional callback for progress updates
   * @param {number} timeout - Execution timeout in ms (optional)
   * @returns {Promise<object>} Tool execution result
   */
  async execute(toolName, parameters, callContext = {}, progressCallback = null, timeout = this.defaultTimeout) {
    const startTime = Date.now();
    let resolvedToolName = toolName;
    if (toolName === 'booking_step_initiate') {
      resolvedToolName = 'booking_step_check_availability';
    }
    const callSid = callContext.callSid || 'unknown';
    const phoneNumber = callContext.phoneNumber || 'unknown';

    if (resolvedToolName.startsWith('cancellation_step_')) {
      setCancellationContext(callSid);
    }

    // Create span for tool execution
    const span = tracer.startSpan(`tool.execute.${resolvedToolName}`, {
      attributes: {
        'tool.name': resolvedToolName,
        'call.sid': callSid,
        'call.phone_number': phoneNumber
      }
    });

    try {
      // ========== GLOBAL MCP SETTINGS CHECK ==========
      // Check if MCP tools are globally enabled
      if (!this.configManager.isMCPEnabled()) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'MCP tools are globally disabled' });
        span.end();
        console.error(`❌ [${callSid}] MCP tools are globally disabled. Tool ${toolName} blocked.`);
        throw new Error('MCP tools are currently disabled. Please contact an administrator.');
      }

      // Check global MCP rate limit (applies to all tools)
      if (!this.checkGlobalRateLimit()) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Global MCP rate limit exceeded' });
        span.end();
        console.error(`❌ [${callSid}] Global MCP rate limit exceeded`);
        throw new Error('Global rate limit exceeded. Too many tool calls. Please try again later.');
      }
      // ================================================

      // Alias resolution: if model called a non-existent "booking options" style name, resolve to canonical tool
      if (!this.toolRegistry.has(resolvedToolName) && this._isBookingOptionsAlias(resolvedToolName)) {
        const canonical = 'booking_step_select_booking_options';
        if (this.toolRegistry.has(canonical)) {
          resolvedToolName = canonical;
          parameters = this._normalizeBookingOptionsParams(parameters, callSid);
          console.log(`🔧 [${callSid}] [TOOL EXECUTOR] Resolved alias to ${canonical}`);
        }
      }

      // Alias resolution: "save_contact_details" → "fill_contact_details"
      if (!this.toolRegistry.has(resolvedToolName) && this._isFillContactDetailsAlias(resolvedToolName)) {
        const canonical = 'booking_step_fill_contact_details';
        if (this.toolRegistry.has(canonical)) {
          console.log(`🔧 [${callSid}] [TOOL EXECUTOR] Resolved alias "${resolvedToolName}" → ${canonical}`);
          resolvedToolName = canonical;
        }
      }

      // Alias resolution: "select_contact" → "lookup_contact"
      if (!this.toolRegistry.has(resolvedToolName) && this._isLookupContactAlias(resolvedToolName)) {
        const canonical = 'booking_step_lookup_contact';
        if (this.toolRegistry.has(canonical)) {
          console.log(`🔧 [${callSid}] [TOOL EXECUTOR] Resolved alias "${resolvedToolName}" → ${canonical}`);
          resolvedToolName = canonical;
        }
      }

      // Alias resolution: "booking_step_confirm_payment_request" → "booking_step_send_payment_request" with confirmed: true
      // There is NO separate confirm tool; the model sometimes invents this name. Redirect to send_payment_request and force confirmed: true so the send button is clicked.
      if (resolvedToolName === 'booking_step_confirm_payment_request') {
        if (this.toolRegistry.has('booking_step_send_payment_request')) {
          console.log(`🔧 [${callSid}] [TOOL EXECUTOR] Resolved alias "booking_step_confirm_payment_request" → booking_step_send_payment_request with confirmed: true`);
          parameters = { ...parameters, confirmed: true };
          resolvedToolName = 'booking_step_send_payment_request';
        }
      }

      // Alias resolution: "booking_step_confirm_booking" does not exist. Model invents it after select_booking_options. Redirect to the actual next step: lookup_contact (existing) or create_new_contact (new).
      if (resolvedToolName === 'booking_step_confirm_booking') {
        const wt = parameters?.workflowType || conversations[callSid]?.bookingSession?.workflowType || 'existing';
        const nextTool = wt === 'new' ? 'booking_step_create_new_contact' : 'booking_step_lookup_contact';
        if (this.toolRegistry.has(nextTool)) {
          console.log(`🔧 [${callSid}] [TOOL EXECUTOR] Resolved alias "booking_step_confirm_booking" → ${nextTool} (workflowType: ${wt})`);
          resolvedToolName = nextTool;
        }
      }

      if (!this.toolRegistry.has(resolvedToolName)) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `Tool not found: ${resolvedToolName}` });
        span.end();
        console.error(`❌ [${callSid}] Tool not found: ${resolvedToolName}`);
        throw new Error(`Unknown tool: ${resolvedToolName}`);
      }

      let normalizedParams = this.normalizeStepToolParameters(resolvedToolName, parameters);
      if (resolvedToolName === 'client_verification' && normalizedParams.phone_number != null && normalizedParams.telephoneNumber == null) {
        normalizedParams = { ...normalizedParams, telephoneNumber: normalizedParams.phone_number };
        delete normalizedParams.phone_number;
      }

      // For booking step tools that require workflowType or courseType: inject from session when model omits it
      if (resolvedToolName.startsWith('booking_step_')) {
        if (normalizedParams.workflowType == null || normalizedParams.workflowType === '') {
          const sessionWorkflowType = conversations[callSid]?.bookingSession?.workflowType;
          if (sessionWorkflowType === 'existing' || sessionWorkflowType === 'new') {
            normalizedParams.workflowType = sessionWorkflowType;
          }
        }

        if (normalizedParams.courseType == null || normalizedParams.courseType === '') {
          const sessionCourseType = conversations[callSid]?.bookingSession?.courseType;
          if (sessionCourseType) {
            normalizedParams.courseType = sessionCourseType;
          }
        }
      }

      // Strip null values from parameters to prevent Zod validation failures for optional fields
      // OpenAI often sends null for optional fields it decides not to populate.
      const cleanedParams = Object.fromEntries(
        Object.entries(normalizedParams).filter(([_, v]) => v !== null)
      );

      // Validate tool parameters using Zod schema
      const validation = validateToolParameters(resolvedToolName, cleanedParams);
      if (!validation.success) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `Parameter validation failed: ${validation.error}` });
        span.end();
        console.error(`❌ [${callSid}] Tool parameter validation failed for ${resolvedToolName}:`, validation.error);
        throw new Error(`Invalid parameters for tool ${resolvedToolName}: ${validation.error}`);
      }

      // Use validated parameters
      const validatedParameters = validation.data;
      span.setAttribute('tool.parameters_validated', true);

      // Get tool configuration from ConfigManager
      const toolConfig = this.configManager.getToolConfig(resolvedToolName);

      // Check if tool is enabled (per-tool setting)
      if (!toolConfig.enabled) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Tool is disabled' });
        span.end();
        console.error(`❌ [${callSid}] Tool ${resolvedToolName} is disabled`);
        throw new Error(`Tool ${resolvedToolName} is disabled`);
      }

      // Check per-tool rate limit (simple in-memory tracking per tool executor instance)
      // Note: For distributed systems, this should be in Redis or similar
      if (!this.checkRateLimit(resolvedToolName, toolConfig.rateLimit)) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Rate limit exceeded' });
        span.end();
        console.error(`❌ [${callSid}] Rate limit exceeded for tool ${resolvedToolName}`);
        throw new Error(`Rate limit exceeded for tool ${resolvedToolName}`);
      }

      // Check domain allowlist if URL is provided
      if (validatedParameters.url && toolConfig.domains && toolConfig.domains.length > 0) {
        try {
          const url = new URL(validatedParameters.url);
          const domain = url.hostname;
          const isAllowed = toolConfig.domains.some(allowedDomain =>
            domain === allowedDomain || domain.endsWith('.' + allowedDomain)
          );
          if (!isAllowed) {
            console.error(`❌ [${callSid}] Domain ${domain} not allowed for tool ${resolvedToolName}`);
            throw new Error(`Domain ${domain} not allowed for tool ${resolvedToolName}`);
          }
        } catch (urlError) {
          console.error(`❌ [${callSid}] Invalid URL in parameters:`, urlError);
          throw new Error(`Invalid URL provided for tool ${resolvedToolName}`);
        }
      }

      // Get tool instance BEFORE checking timeout (fixes ReferenceError)
      const tool = this.toolRegistry.get(resolvedToolName);

      // ========== TIMEOUT PRIORITY ==========
      // Priority: tool.getTimeout() > toolConfig.maxTime > globalMCPTimeout > hardcoded defaults
      let toolSpecificTimeout = null;

      // 1. Check if tool has a custom timeout method (for step-based tools)
      if (tool && typeof tool.getTimeout === 'function') {
        toolSpecificTimeout = tool.getTimeout();
        if (toolSpecificTimeout !== null && toolSpecificTimeout > 0) {
          timeout = toolSpecificTimeout;
          console.log(`⏱️ [${callSid}] Using tool-specific timeout for ${resolvedToolName}: ${timeout}ms`);
        }
      }

      // 2. Use per-tool configured maxTime if available and no tool-specific timeout was set
      if (toolConfig.maxTime && toolSpecificTimeout === null) {
        timeout = toolConfig.maxTime;
        console.log(`⏱️ [${callSid}] Using per-tool maxTime for ${resolvedToolName}: ${timeout}ms`);
      }

      // 3. Use global MCP timeout as fallback if no other timeout was set
      if (toolSpecificTimeout === null && !toolConfig.maxTime) {
        const globalTimeoutMs = this.configManager.getMCPTimeoutMs();
        if (globalTimeoutMs && globalTimeoutMs > 0) {
          timeout = globalTimeoutMs;
          console.log(`⏱️ [${callSid}] Using global MCP timeout for ${resolvedToolName}: ${timeout}ms`);
        }
      }

      // 4. Increase timeout for browser automation tools - they need more time
      // Only if no tool-specific timeout, no per-tool maxTime, and not using global timeout override
      const browserToolNames = [];
      if (browserToolNames.includes(resolvedToolName) && toolSpecificTimeout === null && !toolConfig.maxTime) {
        timeout = Math.max(timeout, 360000);
        console.log(`⏱️ [${callSid}] Extended timeout for ${resolvedToolName} to ${timeout}ms`);
      }
      // ==========================================
      if (resolvedToolName !== toolName) {
        console.log(`🔧 [${callSid}] [TOOL EXECUTOR] Redirected ${toolName} -> ${resolvedToolName}`);
      }
      console.log(`🔧 [${callSid}] [TOOL EXECUTOR] Executing tool: ${resolvedToolName}`);
      console.log(`🔧 [${callSid}] [TOOL EXECUTOR] Parameters:`, JSON.stringify(validatedParameters, null, 2));
      console.log(`🔧 [${callSid}] [TOOL EXECUTOR] Timeout: ${timeout}ms`);
      console.log(`🔧 [${callSid}] [TOOL EXECUTOR] Call Context:`, { callSid, phoneNumber });

      let timeoutId;
      try {
        // ========== ABORT CONTROLLER FOR TIMEOUT ==========
        // Priority: Create an AbortController so we can signal background operations to stop on timeout
        const controller = new AbortController();
        const callContextWithAbort = { ...callContext, abortSignal: controller.signal };
        // ===============================================

        // Execute with timeout
        // Pass progress callback if provided
        let executionPromise;
        if (progressCallback && typeof tool.execute === 'function') {
          // Check if tool.execute accepts progressCallback as third parameter
          if (tool.execute.length >= 3) {
            // Tool accepts progressCallback as third parameter
            executionPromise = tool.execute(validatedParameters, callContextWithAbort, progressCallback);
          } else {
            // Tool only accepts parameters and callContext, include progressCallback in callContext
            executionPromise = tool.execute(validatedParameters, { ...callContextWithAbort, progressCallback });
          }
        } else {
          // No progress callback, execute normally
          executionPromise = tool.execute(validatedParameters, callContextWithAbort);
        }

        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            // SIGNAL ABORTION: Background operations using the signal will stop
            controller.abort();
            reject(new Error(`Tool execution timeout: ${resolvedToolName} (exceeded ${timeout}ms)`));
          }, timeout);
        });

        // Race with call-level abort (when call disconnects)
        const abortError = () => {
          const e = new Error('Aborted');
          e.name = 'AbortError';
          return e;
        };
        const callAbortPromise = callContext.callAbortSignal
          ? new Promise((_, reject) => {
              if (callContext.callAbortSignal.aborted) {
                reject(abortError());
                return;
              }
              callContext.callAbortSignal.addEventListener('abort', () => reject(abortError()));
            })
          : null;

        const racePromises = [executionPromise, timeoutPromise];
        if (callAbortPromise) racePromises.push(callAbortPromise);
        const result = await Promise.race(racePromises);
        clearTimeout(timeoutId);

        const executionTime = Date.now() - startTime;
        const executionTimeSeconds = executionTime / 1000;
        span.setAttribute('tool.execution_time_ms', executionTime);
        span.setAttribute('tool.success', true);
        span.setStatus({ code: SpanStatusCode.OK });

        // Record tool metrics
        recordToolMetrics({
          toolName: resolvedToolName,
          duration: executionTimeSeconds,
          success: true
        });

        console.log(`✅ [${callSid}] [TOOL EXECUTOR] Tool ${resolvedToolName} completed successfully`);
        console.log(`✅ [${callSid}] [TOOL EXECUTOR] Execution time: ${executionTime}ms`);
        console.log(`✅ [${callSid}] [TOOL EXECUTOR] Result preview:`, JSON.stringify(result, null, 2).substring(0, 300));

        // Update usage statistics in database (async, don't wait)
        this.updateToolUsage(resolvedToolName).catch(err => {
          console.warn(`⚠️ [${callSid}] Failed to update tool usage stats:`, err.message);
        });

        span.end();
        const successReturn = {
          success: true,
          result: result,
          executionTime: executionTime
        };
        if (resolvedToolName !== toolName) {
          successReturn.resolvedToolName = resolvedToolName;
        }
        return successReturn;
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        const executionTime = Date.now() - startTime;
        const executionTimeSeconds = executionTime / 1000;
        span.setAttribute('tool.execution_time_ms', executionTime);
        span.setAttribute('tool.success', false);
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

        // Record tool metrics with error
        recordToolMetrics({
          toolName: resolvedToolName,
          duration: executionTimeSeconds,
          error: { type: error.name || 'unknown', message: error.message },
          success: false
        });

        console.error(`❌ [${callSid}] [TOOL EXECUTOR] Tool ${resolvedToolName} failed`);
        console.error(`❌ [${callSid}] [TOOL EXECUTOR] Execution time before failure: ${executionTime}ms`);
        console.error(`❌ [${callSid}] [TOOL EXECUTOR] Error:`, error.message || error);

        span.end();
        const isTimeout = error.message && error.message.includes('timeout');
        const failureReturn = {
          success: false,
          error: error.message || 'Tool execution failed',
          executionTime: executionTime,
          canRetry: isTimeout // Explicitly tell LLM it can retry on timeout
        };
        if (resolvedToolName !== toolName) {
          failureReturn.resolvedToolName = resolvedToolName;
        }
        return failureReturn;
      }
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.end();
      throw error;
    }
  }

  /**
   * Update tool usage statistics in database
   * @param {string} toolName - Tool name
   */
  async updateToolUsage(toolName) {
    try {
      await ToolConfig.findOneAndUpdate(
        { toolName },
        {
          $inc: { usageCount: 1 },
          lastUsed: new Date()
        },
        { upsert: false } // Don't create if doesn't exist
      );
    } catch (error) {
      // Silently fail - usage tracking is not critical
      console.warn(`Failed to update usage for tool ${toolName}:`, error.message);
    }
  }
}

export default ToolExecutor;

