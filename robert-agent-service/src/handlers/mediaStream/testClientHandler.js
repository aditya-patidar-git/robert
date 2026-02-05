/**
 * Test Client Connection Handler
 * Handles WebSocket connections from test clients for acceptance testing.
 * Single responsibility: test client connection management.
 *
 * @module handlers/mediaStream/testClientHandler
 */

import testClientRegistry from '../../services/testClientRegistry.js';

/**
 * Handle test client WebSocket connection.
 * Validates callSid, registers client with registry, sends confirmation.
 * @param {import('ws').WebSocket} ws - Test client WebSocket
 * @param {Object} req - HTTP request object (from upgrade)
 */
export function handleTestClientConnection(ws, req) {
  try {
    const url = new URL(req.url || '', `http://${req.headers?.host || 'localhost'}`);
    const callSid = url.searchParams.get('callSid');

    if (!callSid) {
      console.error('[TestClient] Missing callSid parameter');
      ws.close(1008, 'Missing callSid parameter');
      return;
    }

    console.log(`[TestClient] Test client connected for call ${callSid}`);

    testClientRegistry.register(callSid, ws);

    const confirmMessage = JSON.stringify({
      event: 'connected',
      callSid,
      message: 'Test client registered successfully'
    });
    if (ws.readyState === 1) {
      ws.send(confirmMessage);
    }

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`[TestClient] Received message from test client for call ${callSid}:`, message.event);
      } catch (err) {
        console.error(`[TestClient] Error parsing test client message:`, err.message);
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`[TestClient] Test client disconnected for call ${callSid}: ${code} ${reason?.toString() || ''}`);
      testClientRegistry.unregister(callSid, ws);
    });

    ws.on('error', (err) => {
      console.error(`[TestClient] WebSocket error for call ${callSid}:`, err.message);
      testClientRegistry.unregister(callSid, ws);
    });
  } catch (err) {
    console.error('[TestClient] Error handling test client connection:', err);
    if (ws.readyState === 0 || ws.readyState === 1) {
      ws.close(1011, 'Internal server error');
    }
  }
}
