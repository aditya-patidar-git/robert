/**
 * Pure helpers for which tool rows to show on the System MCP tab.
 * Kept separate from MCPToolsConfig.jsx so React Fast Refresh works (no mixed component + util exports).
 */

/** Booking/cancellation step tools — hidden from System MCP tools list */
export function isBookingOrCancellationStepToolName(name) {
  if (!name || typeof name !== 'string') return false;
  return name.startsWith('booking_step_') || name.startsWith('cancellation_step_');
}

/** Workflow-only tools (not shown as standalone MCP utilities on System tab) */
const MCP_SYSTEM_HIDDEN_WORKFLOW_TOOL_NAMES = new Set([
  'recording_consent_response',
  'start_workflow',
  'client_verification'
]);

export function isHiddenFromMcpSystemToolsList(name) {
  if (!name || typeof name !== 'string') return false;
  if (isBookingOrCancellationStepToolName(name)) return true;
  return MCP_SYSTEM_HIDDEN_WORKFLOW_TOOL_NAMES.has(name);
}
