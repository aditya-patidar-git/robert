// Main AI controller - re-exports all handlers for backward compatibility
export { getConfig, updateConfig } from './configHandlers.js';
export { getModels, getRecommendedFallbackChain, getModelParameters, getModelCapabilities } from './modelHandlers.js';
export { testPrompt } from './testingHandlers.js';

