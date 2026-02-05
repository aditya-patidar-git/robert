/**
 * Test Client Registry Service
 * Manages WebSocket connections for test clients that need to receive Media Streams events.
 * Single responsibility: test client connection management per callSid.
 *
 * @module services/testClientRegistry
 */

import { WebSocket } from 'ws';

/**
 * Registry of test client WebSocket connections per callSid.
 * Enables event forwarding from Twilio Media Streams to test clients for acceptance testing.
 */
class TestClientRegistry {
  constructor() {
    /** @type {Map<string, Set<WebSocket>>} callSid -> Set of test client WebSockets */
    this.testClients = new Map();
    /** @type {Set<string>} Track logged fallbacks to avoid excessive logging */
    this.fallbackLogged = new Set();
    /** @type {Set<string>} Track logged media forwards to avoid excessive logging */
    this.mediaForwardLogged = new Set();
  }

  /**
   * Register a test client for a call.
   * @param {string} callSid - Call SID
   * @param {WebSocket} ws - Test client WebSocket
   */
  register(callSid, ws) {
    if (!this.testClients.has(callSid)) {
      this.testClients.set(callSid, new Set());
    }
    this.testClients.get(callSid).add(ws);

    const unbind = () => this.unregister(callSid, ws);
    ws.once('close', unbind);
    ws.once('error', unbind);

    const count = this.testClients.get(callSid).size;
    console.log(`[TestClientRegistry] Registered test client for call ${callSid} (total: ${count})`);
  }

  /**
   * Unregister a test client.
   * @param {string} callSid - Call SID
   * @param {WebSocket} ws - Test client WebSocket
   */
  unregister(callSid, ws) {
    const clients = this.testClients.get(callSid);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) {
        this.testClients.delete(callSid);
      }
      const remaining = clients.size;
      console.log(`[TestClientRegistry] Unregistered test client for call ${callSid} (remaining: ${remaining})`);
    }
  }

  /**
   * Forward an event to all registered test clients for a call.
   * Non-blocking; failed sends do not throw.
   * 
   * Handles callSid mismatch scenario: When test creates outbound call (Call A) but
   * Twilio creates inbound call (Call B), test client registers under Call A but agent
   * receives Call B. Fallback: if exactly one test client is registered, forward to it.
   * 
   * @param {string} callSid - Call SID
   * @param {Object} event - Event object (e.g. from Twilio Media Streams)
   */
  forwardEvent(callSid, event) {
    let clients = this.testClients.get(callSid);
    let usedFallback = false;
    
    // Track fallback usage per callSid to avoid excessive logging
    if (!this.fallbackLogged) {
      this.fallbackLogged = new Set();
    }
    
    // If no clients found for this callSid, check for fallback scenario
    if (!clients || clients.size === 0) {
      const availableCallSids = Array.from(this.testClients.keys());
      
      if (availableCallSids.length > 0) {
        // Count total registered test clients across all callSids
        let totalClients = 0;
        let fallbackCallSid = null;
        for (const sid of availableCallSids) {
          const sidClients = this.testClients.get(sid);
          if (sidClients && sidClients.size > 0) {
            totalClients += sidClients.size;
            if (!fallbackCallSid) {
              fallbackCallSid = sid;
            }
          }
        }
        
        // Fallback: If exactly one test client is registered (single test scenario),
        // forward to it regardless of callSid mismatch (handles outbound->inbound callSid difference)
        if (totalClients === 1 && fallbackCallSid) {
          clients = this.testClients.get(fallbackCallSid);
          usedFallback = true;
          
          // Only log fallback once per callSid to reduce noise
          const fallbackKey = `${callSid}->${fallbackCallSid}`;
          if (!this.fallbackLogged.has(fallbackKey)) {
            console.warn(`[TestClientRegistry] callSid mismatch detected: requested ${callSid}, using fallback ${fallbackCallSid}`);
            console.warn(`[TestClientRegistry] This handles outbound->inbound callSid difference (Call A -> Call B)`);
            this.fallbackLogged.add(fallbackKey);
          }
        } else {
          // Multiple clients or no clients - only log for non-media events to reduce noise
          if (event.event !== 'media') {
            console.warn(`[TestClientRegistry] No clients registered for callSid ${callSid} (event: ${event.event || 'unknown'})`);
          }
          return;
        }
      } else {
        // No clients registered at all - only log for important events
        if (['start', 'stop', 'connected'].includes(event.event)) {
          console.warn(`[TestClientRegistry] No test clients registered for callSid ${callSid} (event: ${event.event})`);
        }
        return;
      }
    }

    // When using fallback for start events, rewrite callSid in payload to match test client's registered callSid
    // This ensures test client receives start event with the callSid it expects (outbound callSid)
    let eventToSend = event;
    const targetCallSid = usedFallback ? Array.from(this.testClients.keys()).find(sid => {
      const c = this.testClients.get(sid);
      return c && c.size > 0;
    }) : callSid;

    if (usedFallback && event.event === 'start' && event.start) {
      // Create a modified copy of the event with callSid rewritten to match test client's expectation
      eventToSend = {
        ...event,
        start: {
          ...event.start,
          callSid: targetCallSid
        }
      };
      console.log(`[TestClientRegistry] Rewrote callSid in start event: ${event.start.callSid} -> ${targetCallSid}`);
    }

    const eventJson = JSON.stringify(eventToSend);
    let forwardedCount = 0;

    clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(eventJson);
          forwardedCount++;
        } catch (err) {
          console.error(`[TestClientRegistry] Error forwarding event to test client:`, err.message);
          this.unregister(targetCallSid, ws);
        }
      } else {
        this.unregister(targetCallSid, ws);
      }
    });

    // Only log forwarding for non-media events, or first media event to reduce noise
    if (forwardedCount > 0) {
      if (event.event !== 'media') {
        const logMessage = usedFallback 
          ? `[TestClientRegistry] Forwarded ${event.event} event to ${forwardedCount} test client(s) (fallback: ${targetCallSid} for requested ${callSid})`
          : `[TestClientRegistry] Forwarded ${event.event} event to ${forwardedCount} test client(s) for call ${callSid}`;
        console.log(logMessage);
      } else {
        // For media events, track first forward per callSid
        if (!this.mediaForwardLogged) {
          this.mediaForwardLogged = new Set();
        }
        if (!this.mediaForwardLogged.has(callSid)) {
          console.log(`📡 [TestClientRegistry] Forwarding outbound audio to test client(s) for call ${callSid}`);
          this.mediaForwardLogged.add(callSid);
        }
      }
    }
  }

  /**
   * Get the number of registered test clients for a call.
   * @param {string} callSid - Call SID
   * @returns {number}
   */
  getClientCount(callSid) {
    return this.testClients.get(callSid)?.size ?? 0;
  }

  /**
   * Clean up all test clients for a call (e.g. when call ends).
   * @param {string} callSid - Call SID
   */
  cleanup(callSid) {
    const clients = this.testClients.get(callSid);
    if (clients) {
      clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Call ended');
        }
      });
      this.testClients.delete(callSid);
      console.log(`[TestClientRegistry] Cleaned up all test clients for call ${callSid}`);
    }
  }
}

export const testClientRegistry = new TestClientRegistry();
export default testClientRegistry;
