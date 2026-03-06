/**
 * Per-call AbortController registry.
 * Used to abort in-flight tool execution when a call disconnects.
 * Media stream creates and registers a controller on connection; cleanup aborts and removes it.
 */

const controllers = new Map();

/**
 * Register an AbortController for a call. Call when the call starts.
 * @param {string} callSid - Call SID
 * @returns {AbortController} The controller (create and pass back if you need to store it)
 */
export function register(callSid) {
  if (!callSid) return null;
  const controller = new AbortController();
  controllers.set(callSid, controller);
  return controller;
}

/**
 * Get the AbortController for a call (if any).
 * @param {string} callSid - Call SID
 * @returns {AbortController|null}
 */
export function get(callSid) {
  if (!callSid) return null;
  return controllers.get(callSid) ?? null;
}

/**
 * Get the AbortSignal for a call (if any). Use this to pass to tool execution.
 * @param {string} callSid - Call SID
 * @returns {AbortSignal|undefined}
 */
export function getSignal(callSid) {
  const c = get(callSid);
  return c ? c.signal : undefined;
}

/**
 * Abort the controller for a call and remove it from the registry.
 * Call this at the start of call cleanup so in-flight tools exit quickly.
 * @param {string} callSid - Call SID
 */
export function abortAndRemove(callSid) {
  if (!callSid) return;
  const controller = controllers.get(callSid);
  if (controller) {
    try {
      controller.abort();
    } catch (_) {
      // ignore if already aborted
    }
    controllers.delete(callSid);
  }
}
