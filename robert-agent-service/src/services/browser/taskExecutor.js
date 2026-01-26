import { loginToCRM } from '../commonBookingSteps/index.js';
import * as taskHandlers from './tasks/index.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import configManager from '../../agent/configManager.js';

const tracer = trace.getTracer('robert-agent-service', '1.0.0');

// Map CRM browser tasks to config task names
const TASK_CONFIG_MAP = {
  'cancel_booking': 'cancel',
  'create_booking': 'createBooking',
  // check_availability and reschedule_booking don't need config checks (always allowed)
};

/**
 * Task executor
 * Orchestrates task execution with locking, dry-run, and error handling
 */
export class TaskExecutor {
  constructor(browserManager, updateExecutionPhase, activeExecutions, executionLockTimeout, executionHeartbeatInterval, crmCredentials, screenshotsDir) {
    this.browserManager = browserManager;
    this.updateExecutionPhase = updateExecutionPhase;
    this.activeExecutions = activeExecutions;
    this.executionLockTimeout = executionLockTimeout;
    this.executionHeartbeatInterval = executionHeartbeatInterval;
    this.crmCredentials = crmCredentials;
    this.screenshotsDir = screenshotsDir;
  }

  async executeTask(task, args, callContext = {}, progressCallback = null) {
    const callSid = callContext.callSid || 'unknown';
    const executionKey = `${callSid}_${task}`;
    
    // Create span for browser task execution
    const span = tracer.startSpan('browser.executeTask', {
      attributes: {
        'browser.task': task,
        'call.sid': callSid,
        'browser.course_type': args.courseType || 'unknown'
      }
    });

    // Check if task is enabled in CRM tasks config
    const configTaskName = TASK_CONFIG_MAP[task];
    if (configTaskName && !configManager.isCRMTaskEnabled(configTaskName)) {
      console.log(`🚫 [${callSid}] Task "${task}" is disabled in CRM tasks configuration`);
      span.setAttribute('browser.task_disabled', true);
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'Task disabled in configuration' });
      span.end();
      return {
        success: false,
        error: `Task "${task}" is currently disabled in the system configuration. Please contact an administrator to enable it.`,
        dryRun: false
      };
    }

    // Helper function to call progress callback if provided
    const reportProgress = (milestone, message, progress = null) => {
      if (progressCallback && typeof progressCallback === 'function') {
        try {
          progressCallback({ milestone, message, progress, timestamp: Date.now() });
        } catch (err) {
          console.warn(`⚠️ [${callSid}] Error in progress callback:`, err.message);
        }
      }
      // Add event to span
      span.addEvent(milestone, { message, progress });
    };

    // Check if there's already an active execution for this call and task
    if (this.activeExecutions.has(executionKey)) {
      const activeExecution = this.activeExecutions.get(executionKey);
      const now = Date.now();
      const elapsedTime = now - activeExecution.startTime;
      const timeSinceHeartbeat = activeExecution.lastHeartbeat ? (now - activeExecution.lastHeartbeat) : elapsedTime;
      
      // If execution is stuck (exceeded timeout or no heartbeat), force clear it to allow retry
      if (elapsedTime > this.executionLockTimeout || timeSinceHeartbeat > this.executionHeartbeatInterval * 2) {
        console.warn(`⚠️ [${callSid}] Execution lock was stuck for ${Math.round(elapsedTime / 1000)}s (timeout: ${this.executionLockTimeout / 1000}s), force clearing to allow retry`);
        this.activeExecutions.delete(executionKey);
      } else {
        // SMART OVERRIDE: Handle cases where first call is waiting and second call has the needed information
        let shouldOverride = false;
        let overrideReason = '';
        
        // Case 1: Second call with agreedSlot while first call is in Step 1 (availability check)
        if (task === 'create_booking' && args.agreedSlot && activeExecution.phase === 'step1_availability') {
          shouldOverride = true;
          overrideReason = 'Second call with agreedSlot detected while first call is in Step 1 (prevents duplicate availability check)';
        }
        // Case 2: First call is waiting for preferences (bikeType, etc.) and second call has them
        else if (task === 'create_booking' && (activeExecution.phase === 'step7_booking_options' || activeExecution.phase === 'waiting_for_preferences')) {
          // Check if second call has preferences that first call might be missing
          if (args.bikeType || args.preferredDate || args.preferredTime || args.location || args.instructor) {
            shouldOverride = true;
            overrideReason = `Second call with preferences (bikeType, etc.) detected while first call is waiting for preferences (phase: ${activeExecution.phase})`;
          }
        }
        // Case 3: Second call has agreedSlot and first call is in early stages (before Step 6)
        else if (task === 'create_booking' && args.agreedSlot && 
                 (activeExecution.phase === 'step2_login' || 
                  activeExecution.phase === 'step3_workflow_type' || 
                  activeExecution.phase === 'step4_5_find_client' ||
                  activeExecution.phase === 'step4_select_session')) {
          shouldOverride = true;
          overrideReason = `Second call with agreedSlot detected while first call is in ${activeExecution.phase} (allows retry with complete information)`;
        }
        
        if (shouldOverride) {
          console.log(`🔄 [${callSid}] Smart override: ${overrideReason}`);
          
          // Signal cancellation to the first call
          if (activeExecution.cancelToken) {
            activeExecution.cancelToken.cancelled = true;
            activeExecution.cancelToken.reason = overrideReason;
          }
          
          // Clear the first execution lock
          this.activeExecutions.delete(executionKey);
          
          // Log the cancellation
          console.log(`✅ [${callSid}] First call cancelled. Proceeding with second call that has complete information.`);
        } else {
          console.log(`⚠️ [${callSid}] Task "${task}" is already running (started ${Math.round(elapsedTime / 1000)}s ago, last heartbeat: ${Math.round(timeSinceHeartbeat / 1000)}s ago, phase: ${activeExecution.phase || 'unknown'}). Rejecting concurrent execution.`);
          return {
            success: false,
            error: `Task "${task}" is already in progress for this call. Please wait for it to complete.`,
            dryRun: false
          };
        }
      }
    }
    
    // Create cancellation token for this execution
    const cancelToken = {
      cancelled: false,
      reason: null
    };
    
    // Mark execution as active with heartbeat tracking and phase
    this.activeExecutions.set(executionKey, {
      task,
      startTime: Date.now(),
      lastHeartbeat: Date.now(),
      phase: 'initializing', // Will be updated as workflow progresses
      cancelToken: cancelToken
    });
    
    // Check if this is an availability check (public page, no auth needed)
    // All availability checks use public URLs, so they don't need authentication
    const isAvailabilityCheck = (task === 'check_availability');
    
    let context;
    let shouldCloseContext = false; // Track if we need to close this context (not the pooled one)
    let page = null;
    const auditId = `audit_${Date.now()}_${callSid}`;
    
    try {
      // Get context - wrap in try-catch to handle errors early
      if (isAvailabilityCheck) {
        // For availability checks, use a browser context without authentication (public page)
        console.log('🌐 [Availability Check] Using browser without authentication for public availability page');
        context = await this.browserManager.getPublicContext();
        shouldCloseContext = true; // Mark this context for cleanup since it's not the pooled one
      } else {
        // For other tasks (create_booking, reschedule, cancel, update_customer), use authenticated context
        context = await this.browserManager.getContext(reportProgress);
      }
      
      // CRITICAL: For authenticated tasks, reuse authenticated page OR create new page from context
      // Both will have session cookies because cookies are stored in the browser context
      if (!isAvailabilityCheck) {
        const authenticatedPage = this.browserManager.getAuthenticatedPage();
        if (authenticatedPage && !authenticatedPage.isClosed()) {
          console.log('✅ Reusing authenticated page (cookies persist in context)');
          page = authenticatedPage;
          
          // Navigate if needed - cookies in context will persist
          const currentUrl = page.url();
          if (!currentUrl.includes('takeabyte.co.uk/InContact')) {
            await page.goto('https://takeabyte.co.uk/InContact', { 
              waitUntil: 'domcontentloaded',
              timeout: 30000 
            });
            await page.waitForTimeout(2000);
            
            // Check if redirected to login (session expired indicator)
            const newUrl = page.url();
            if (newUrl.includes('/Account/Login')) {
              console.warn('⚠️ Session expired - redirected to login, will re-login');
              await page.close();
              this.browserManager.clearAuthenticatedPage();
              this.browserManager.clearBrowserContext();
              // Re-get context (will trigger re-login)
              context = await this.browserManager.getContext();
              page = await context.newPage();
              await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'domcontentloaded' });
            }
          }
        } else {
          // Create new page from context
          console.log('📄 Creating new page from authenticated context (cookies inherited from context)');
          page = await context.newPage();
          
          // Navigate to CRM - cookies from context will be used
          await page.goto('https://takeabyte.co.uk/InContact', { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
          });
          await page.waitForTimeout(2000);
          
          // Check if redirected to login (session expired indicator)
          const currentUrl = page.url();
          if (currentUrl.includes('/Account/Login')) {
            console.warn('⚠️ Session expired - new page redirected to login, will re-login');
            await page.close();
            this.browserManager.clearBrowserContext();
            this.browserManager.clearAuthenticatedPage();
            // Re-get context (will trigger re-login)
            context = await this.browserManager.getContext();
            page = await context.newPage();
            await page.goto('https://takeabyte.co.uk/InContact', { waitUntil: 'domcontentloaded' });
          } else {
            // Session is valid - store as authenticated page for future reuse
            if (!this.browserManager.getAuthenticatedPage()) {
              this.browserManager.setAuthenticatedPage(page);
            }
          }
        }
      } else {
        // For availability checks, just create page - service will navigate to availability URL
        console.log('📄 Creating new page for availability check (will navigate to availability URL)');
        page = await context.newPage();
        // Don't navigate here - let the ITM service navigate to availability URL
      }
      
      // 🔍 VISIBILITY: Log tool invocation
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🔧 [CRM BROWSER TOOL] Invoked at ${new Date().toISOString()}`);
      console.log(`📞 Call SID: ${callContext.callSid || 'unknown'}`);
      console.log(`📋 Task: ${task}`);
      console.log(`📋 Course Type: ${args.courseType || 'not specified'}`);
      console.log(`📋 Customer: ${args.customerEmail || 'not specified'}`);
      console.log(`${'='.repeat(80)}\n`);
      
      console.log(`🤖 Browser agent executing task: ${task}`);
      
      // Send heartbeat to keep lock alive during long-running tasks
      const heartbeatInterval = setInterval(() => {
        const execution = this.activeExecutions.get(executionKey);
        if (execution) {
          execution.lastHeartbeat = Date.now();
        }
      }, this.executionHeartbeatInterval);
      
      try {
        // Check if dry-run is enforced by config
        const isDryRunEnforced = configManager.isDryRunEnforced();
        
        // Check if confirmation is required from config (for this task type)
        const configRequiresConfirmation = configTaskName ? configManager.requiresConfirmation(configTaskName) : true;
        
        if (isDryRunEnforced) {
          // Perform dry-run first
          const dryRunResult = await this.executeDryRun(page, task, args, auditId);
          
          if (!dryRunResult.success) {
            span.setAttribute('browser.dry_run_failed', true);
            span.setStatus({ code: SpanStatusCode.ERROR, message: dryRunResult.error });
            span.end();
            return {
              success: false,
              error: dryRunResult.error,
              dryRun: true
            };
          }

          // Use config setting to determine if confirmation is required
          // Override task handler's requiresConfirmation with config value
          const shouldRequireConfirmation = configRequiresConfirmation && (dryRunResult.requiresConfirmation !== false);
          
          if (shouldRequireConfirmation) {
            span.setAttribute('browser.requires_confirmation', true);
            span.setAttribute('browser.dry_run', true);
            span.setStatus({ code: SpanStatusCode.OK });
            span.end();
            return {
              success: true,
              result: dryRunResult.result,
              dryRun: true,
              requiresConfirmation: true,
              auditId
            };
          }
        }

        // Execute actual task
        span.addEvent('browser.execute_actual_task');
        const result = await this.executeActualTask(page, task, args, auditId);
        
        span.setAttribute('browser.task_success', result.success);
        span.setAttribute('browser.dry_run', false);
        span.setStatus({ code: result.success ? SpanStatusCode.OK : SpanStatusCode.ERROR });
        
        span.end();
        return {
          success: result.success,
          result: result.result,
          dryRun: false,
          requiresConfirmation: false,
          auditId,
          screenshots: result.screenshots
        };
      } finally {
        // Always clear heartbeat interval
        clearInterval(heartbeatInterval);
      }
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.end();
      console.error(`❌ [${callSid}] Browser agent error:`, error);
      return {
        success: false,
        error: error.message,
        dryRun: true
      };
    } finally {
      // ALWAYS clean up pages and execution lock, even on error
      try {
        if (page && !page.isClosed()) {
          // CRITICAL: Do NOT close the authenticated page - we need to keep it open for session persistence
          const authenticatedPage = this.browserManager.getAuthenticatedPage();
          if (page === authenticatedPage) {
            console.log(`✅ [${callSid}] Keeping authenticated page open for session persistence`);
          } else if (process.env.KEEP_BROWSER_OPEN !== 'true') {
            // Only close non-authenticated pages if not in debug mode
            await page.close();
          } else {
            console.log(`🔍 [${callSid}] Keeping page open for debugging (KEEP_BROWSER_OPEN=true)`);
          }
        }
      } catch (error) {
        console.warn(`⚠️ [${callSid}] Error closing page:`, error.message);
      }
      
      // Close the context if it was created for availability check (not the pooled one)
      if (shouldCloseContext && context) {
        try {
          await context.close();
          console.log(`🧹 [${callSid}] Closed public availability context`);
        } catch (error) {
          console.warn(`⚠️ [${callSid}] Error closing public availability context:`, error.message);
        }
      }
      
      // ALWAYS remove from active executions, even on error - this allows retries
      const execution = this.activeExecutions.get(executionKey);
      if (execution) {
        const elapsed = Date.now() - execution.startTime;
        if (elapsed > this.executionLockTimeout) {
          console.warn(`⚠️ [${callSid}] Execution lock exceeded timeout (${this.executionLockTimeout / 1000}s), force releasing`);
        }
        this.activeExecutions.delete(executionKey);
        console.log(`🧹 [${callSid}] Cleaned up execution lock and pages for task: ${task} (duration: ${Math.round(elapsed / 1000)}s)`);
      } else {
        console.warn(`⚠️ [${callSid}] Execution lock not found for key: ${executionKey}`);
      }
    }
  }

  async executeDryRun(page, task, args, auditId) {
    try {
      // For check_availability with ITM, skip login - it uses public availability page
      const courseType = args.courseType || '';
      const isITMAvailability = (task === 'check_availability' && 
                                (courseType === 'ITM' || courseType === 'Introduction to Motorcycling'));
      
      if (!isITMAvailability && task !== 'check_availability') {
        await loginToCRM(page, this.crmCredentials, this.screenshotsDir);
      }
      
      switch (task) {
        case 'reschedule_booking':
          return await taskHandlers.dryRunRescheduleBooking(page, args, auditId, this.screenshotsDir);
        case 'cancel_booking':
          return await taskHandlers.dryRunCancelBooking(page, args, auditId, this.screenshotsDir);
        case 'update_customer':
          return await taskHandlers.dryRunUpdateCustomer(page, args, auditId, this.screenshotsDir);
        case 'check_availability':
          return await taskHandlers.dryRunCheckAvailability(page, args, auditId, this.screenshotsDir);
        default:
          throw new Error(`Unknown task: ${task}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async executeActualTask(page, task, args, auditId) {
    try {
      switch (task) {
        case 'reschedule_booking':
          return await taskHandlers.rescheduleBooking(page, args, auditId, this.screenshotsDir);
        case 'cancel_booking':
          return await taskHandlers.cancelBooking(page, args, auditId, this.screenshotsDir);
        case 'update_customer':
          return await taskHandlers.updateCustomer(page, args, auditId, this.screenshotsDir);
        case 'check_availability':
          return await taskHandlers.checkAvailability(page, args, auditId, this.screenshotsDir);
        default:
          throw new Error(`Unknown task: ${task}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

