// Main audio config controller - re-exports all handlers for backward compatibility
export { getAudioConfig, updateAudioConfig, testAudioConfig } from './configHandlers.js';
export { getAudioMetrics, getHistoricalAudioMetrics, getRecentCallsWithQuality } from './metricsHandlers.js';
export { getModelParameterRanges, getNumberProfile, saveNumberProfile, deleteNumberProfile } from './profileHandlers.js';

