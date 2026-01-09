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
   */
  mockRealtimeError(statusCode = 500) {
    if (!this.mockEnabled) {
      this.enableMocking();
    }

    // Realtime API uses WebSocket, but we can mock the HTTP endpoints
    this.nockScope
      .post('/v1/realtime/sessions')
      .reply(statusCode, {
        error: {
          message: 'Realtime API error',
          type: 'server_error'
        }
      });
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

