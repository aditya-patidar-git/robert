/**
 * Registry of active SIP call WebSocket connections.
 * Shared so sessionManagementService can close stale SIP WebSockets without importing handlers (avoids circular dependency).
 */

const sipCallWebSockets = new Map();

export function getSipCallWebSocket(callId) {
  return sipCallWebSockets.get(callId) || null;
}

export function setSipCallWebSocket(callId, ws) {
  sipCallWebSockets.set(callId, ws);
}

export function deleteSipCallWebSocket(callId) {
  sipCallWebSockets.delete(callId);
}

/**
 * Close WebSocket connection for a call and remove from registry.
 * Idempotent: no-op if callId not in registry.
 * @param {string} callId - The call ID
 */
export function closeSipCallWebSocket(callId) {
  const ws = sipCallWebSockets.get(callId);
  if (ws) {
    console.log(`🔌 [SIP] Closing WebSocket for call ${callId}`);
    try {
      ws.close(1000, 'Call ended');
    } catch (err) {
      console.warn(`⚠️ [SIP] Error closing WebSocket for ${callId}:`, err?.message);
    }
    sipCallWebSockets.delete(callId);
  }
}
