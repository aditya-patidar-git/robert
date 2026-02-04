/**
 * Service mocks for unit tests.
 */
import { jest } from '@jest/globals';

export function createMockPromptService(overrides = {}) {
  return {
    getContextualInstructions: jest.fn().mockReturnValue('Mock instructions'),
    determineWorkflowPhase: jest.fn().mockResolvedValue('general_inquiry'),
    getCorePrompt: jest.fn().mockReturnValue('Mock core prompt'),
    ...overrides
  };
}

export function createMockToolExecutionService(overrides = {}) {
  return {
    executeTool: jest.fn().mockResolvedValue({ success: true, result: {} }),
    parseArguments: jest.fn().mockReturnValue({}),
    ...overrides
  };
}

export function createMockKbaService(overrides = {}) {
  return {
    requiresKBA: jest.fn().mockReturnValue(false),
    isKBAVerified: jest.fn().mockReturnValue(true),
    ...overrides
  };
}

export function createMockGdprService(overrides = {}) {
  return {
    exportDSAR: jest.fn().mockResolvedValue({ transcripts: [], metadata: {} }),
    deleteOnRequest: jest.fn().mockResolvedValue({ deleted: true }),
    ...overrides
  };
}
