/**
 * Mock OpenAI API for unit tests.
 * Deterministic, no API costs, works offline.
 */

export function createMockOpenAI(overrides = {}) {
  return {
    transcribe: jest.fn().mockResolvedValue('Mock transcript'),
    fileSearch: jest.fn().mockResolvedValue([
      {
        metadata: { title: 'DVSA Policy', date: 'Jan 2025' },
        content: 'Mock content'
      }
    ]),
    webSearch: jest.fn().mockResolvedValue({ results: [] }),
    createResponse: jest.fn().mockResolvedValue({ id: 'resp_123' }),
    cancel: jest.fn().mockResolvedValue(undefined),
    getCurrentWorkflowPhase: jest.fn().mockReturnValue('general_inquiry'),
    updateToolsForPhase: jest.fn().mockReturnValue(true),
    send: jest.fn(),
    ...overrides
  };
}

export default createMockOpenAI;
