// Main outbound controller - re-exports all handlers for backward compatibility
export { makeCall, aiIntro, getAllCalls } from './callHandlers.js';
export { mediaStream, handleMediaStreamConnection } from './mediaStreamHandlers.js';
export { recordingStatus, proxyRecording } from './recordingHandlers.js';
export { callStatus, handleResponse } from './statusHandlers.js';

// Re-export shared state for external access if needed
export { conversations, realtimeClients } from './sharedState.js';

