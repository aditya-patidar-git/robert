import { WebSocket } from "ws";
import { conversations } from "../../../shared/state.js";

/**
 * Connection Manager
 * Handles WebSocket connection setup, validation, and initial message routing
 */
export class ConnectionManager {
  constructor(ws, req) {
    this.ws = ws;
    this.req = req;
    this.MAX_ERROR_COUNT = 5;
    this.errorCount = 0;
    this.startTimeout = null;
    this.setupComplete = false;
    this.isClosed = false;
  }

  /**
   * Validate WebSocket connection
   */
  validateConnection() {
    if (!this.ws) {
      console.error('❌ WebSocket is null or undefined');
      return false;
    }
    
    if (this.ws.readyState !== WebSocket.OPEN && this.ws.readyState !== 0) {
      console.warn(`⚠️ WebSocket not in OPEN state: ${this.ws.readyState}`);
    }
    
    return true;
  }

  /**
   * Setup initial message handler for 'start' event
   * Returns extracted callSid, streamSid, and phoneNumber
   */
  setupInitialMessageHandler(onStart) {
    const messageHandler = async (data) => {
      if (this.isClosed) {
        console.log('🔌 [DEBUG] Message received but connection is closed');
        return;
      }
      
      try {
        const json = JSON.parse(data.toString());
        console.log('🔌 [DEBUG] Received message event:', json.event);
        
        if (json.event === 'start') {
          console.log('🔌 [DEBUG] Start event received, parsing...');
          const callSid = json.start?.callSid;
          const streamSid = json.start?.streamSid;
          let phoneNumber = json.start?.callSidTo || json.start?.from || 'unknown';
          
          // Fix: Check if phoneNumber is already in conversations (from status callback)
          if (phoneNumber === 'unknown' && callSid && conversations[callSid]?.from) {
            phoneNumber = conversations[callSid].from;
            console.log(`📞 [${callSid}] Updated phoneNumber from conversations: ${phoneNumber}`);
          }
          
          // Fix: If still unknown, try to get from CallRecord in database
          if (phoneNumber === 'unknown' && callSid) {
            try {
              const CallRecord = (await import('../../../../database/models/CallRecord.js')).default;
              const callRecord = await CallRecord.findOne({ callSid }).lean();
              if (callRecord?.from) {
                phoneNumber = callRecord.from;
                console.log(`📞 [${callSid}] Updated phoneNumber from CallRecord: ${phoneNumber}`);
                // Update conversations for future reference
                if (!conversations[callSid]) {
                  conversations[callSid] = { transcript: [], prematureResponses: {} };
                }
                conversations[callSid].from = phoneNumber;
              }
            } catch (err) {
              console.warn(`⚠️ [${callSid}] Could not fetch phoneNumber from CallRecord:`, err.message);
            }
          }
          
          console.log('🔌 [DEBUG] Parsed start event:', { callSid, streamSid, phoneNumber });
          
          if (!callSid) {
            console.error('❌ No callSid in start event');
            console.error('❌ [DEBUG] Full start event:', JSON.stringify(json, null, 2));
            return { error: 'no_callsid' };
          }
          
          console.log(`📞 Start event - callSid: ${callSid}, phoneNumber: ${phoneNumber}`);
          
          // Remove message handler and call onStart callback
          this.ws.removeListener('message', messageHandler);
          return await onStart({ callSid, streamSid, phoneNumber });
        } else {
          console.log('🔌 [DEBUG] Non-start event received:', json.event);
        }
      } catch (err) {
        this.errorCount++;
        console.error('❌ Error parsing message:', err);
        console.error('❌ [DEBUG] Raw message data:', data.toString().substring(0, 200));
        if (this.errorCount >= this.MAX_ERROR_COUNT) {
          return { error: 'max_errors' };
        }
      }
    };
    
    this.ws.on('message', messageHandler);
    return messageHandler;
  }

  /**
   * Setup error and close handlers
   */
  setupErrorHandlers(onError, onClose) {
    this.ws.on('error', (err) => {
      console.error('❌ Twilio WebSocket error:', err.message);
      this.errorCount++;
      if (this.errorCount >= this.MAX_ERROR_COUNT) {
        onError('twilio_error_early');
      }
    });
    
    this.ws.on('close', (code, reason) => {
      if (!this.isClosed) {
        onClose('twilio_close_early', code, reason);
      }
    });
  }

  /**
   * Setup start timeout
   */
  setupStartTimeout(onTimeout) {
    this.startTimeout = setTimeout(() => {
      if (!this.setupComplete) {
        console.error('❌ Timeout waiting for start event');
        onTimeout();
      }
    }, 10000);
  }

  /**
   * Mark setup as complete
   */
  markSetupComplete() {
    this.setupComplete = true;
    if (this.startTimeout) {
      clearTimeout(this.startTimeout);
      this.startTimeout = null;
    }
  }

  /**
   * Cleanup connection
   */
  cleanup() {
    this.isClosed = true;
    if (this.startTimeout) {
      clearTimeout(this.startTimeout);
      this.startTimeout = null;
    }
  }

  /**
   * Get error count
   */
  getErrorCount() {
    return this.errorCount;
  }

  /**
   * Increment error count
   */
  incrementErrorCount() {
    this.errorCount++;
    return this.errorCount;
  }
}

