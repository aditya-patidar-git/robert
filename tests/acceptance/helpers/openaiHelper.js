/**
 * OpenAI Helper
 * Reusable OpenAI operations and mocking for tests
 * Single responsibility: OpenAI API operations only
 */

import nock from 'nock';
import testConfig from '../config/testConfig.js';

class OpenAIHelper {
  constructor() {
    this.baseURL = 'https://api.openai.com';
    this.nockScope = null;
    this.mockEnabled = false;
  }

  /**
   * Enable mocking for error simulation
   */
  enableMocking() {
    this.mockEnabled = true;
    this.nockScope = nock(this.baseURL);
  }

  /**
   * Disable mocking
   */
  disableMocking() {
    if (this.nockScope) {
      nock.cleanAll();
      this.nockScope = null;
    }
    this.mockEnabled = false;
  }

  /**
   * Mock OpenAI API to return 5xx error
   */
  mock5xxError(endpoint = '/v1/chat/completions', statusCode = 500) {
    if (!this.mockEnabled) {
      this.enableMocking();
    }

    this.nockScope
      .post(endpoint)
      .reply(statusCode, {
        error: {
          message: 'Internal server error',
          type: 'server_error',
          code: 'internal_error'
        }
      });
  }

  /**
   * Mock OpenAI API to return 503 (Service Unavailable)
   */
  mock503Error(endpoint = '/v1/chat/completions') {
    return this.mock5xxError(endpoint, 503);
  }

  /**
   * Mock OpenAI API to return 429 (Rate Limit)
   */
  mockRateLimitError(endpoint = '/v1/chat/completions') {
    if (!this.mockEnabled) {
      this.enableMocking();
    }

    this.nockScope
      .post(endpoint)
      .reply(429, {
        error: {
          message: 'Rate limit exceeded',
          type: 'rate_limit_error',
          code: 'rate_limit_exceeded'
        }
      });
  }

  /**
   * Mock successful OpenAI API response
   */
  mockSuccessResponse(endpoint = '/v1/chat/completions', response = {}) {
    if (!this.mockEnabled) {
      this.enableMocking();
    }

    const defaultResponse = {
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-4',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: 'Test response'
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15
      },
      ...response
    };

    this.nockScope
      .post(endpoint)
      .reply(200, defaultResponse);
  }

  /**
   * Mock Realtime API error
   * Note: Realtime API uses WebSocket (wss://api.openai.com/v1/realtime)
   * This mocks HTTP endpoints that may be called during initialization or error handling
   */
  mockRealtimeError(statusCode = 500) {
    if (!this.mockEnabled) {
      this.enableMocking();
    }

    // Mock HTTP endpoints that might be called:
    // - File Search API (used by tools)
    // - Vector Store API (used by file_search)
    // Note: WebSocket errors cannot be mocked with nock, require integration testing
    
    // Mock file search endpoint
    this.nockScope
      .post('/v1/vector_stores/.*/search')
      .reply(statusCode, {
        error: {
          message: 'Realtime API error - service unavailable',
          type: 'server_error',
          code: 'internal_error'
        }
      });
    
    // Mock vector store retrieval
    this.nockScope
      .get('/v1/vector_stores/.*')
      .reply(statusCode, {
        error: {
          message: 'Realtime API error - service unavailable',
          type: 'server_error'
        }
      });
  }

  /**
   * Mock WebSocket connection failure simulation
   * Note: Actual WebSocket mocking requires different approach (ws-mock or similar)
   * This method documents the limitation and provides guidance
   */
  mockRealtimeWebSocketError() {
    console.warn('[OpenAIHelper] WebSocket error simulation not fully supported with nock.');
    console.warn('[OpenAIHelper] For full WebSocket error testing, consider:');
    console.warn('  1. Using ws-mock library for WebSocket mocking');
    console.warn('  2. Integration testing with actual WebSocket connections');
    console.warn('  3. Mocking HTTP endpoints used during error recovery');
    
    // Mock HTTP endpoints that might be called during error recovery
    this.mockRealtimeError(500);
  }

  /**
   * Check if mocking is active
   */
  isMockingEnabled() {
    return this.mockEnabled;
  }

  /**
   * Get nock scope for advanced mocking
   */
  getNockScope() {
    return this.nockScope;
  }
}

export const openaiHelper = new OpenAIHelper();
export default openaiHelper;

