/**
 * Unit tests for ErrorRecoveryService (Req 18: voicemail fallback on unrecoverable error).
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import errorRecoveryService from '../../../robert-agent-service/src/services/errorRecoveryService.js';

describe('ErrorRecoveryService', () => {
  const config = { errorHandling: { retryEnabled: false } };

  beforeEach(() => {
    errorRecoveryService.clearRetryCount('test-call', 'openai');
  });

  it('handleToolError returns shouldFallbackToVoicemail for OpenAI 5xx', () => {
    const err = new Error('Internal Server Error');
    err.status = 503;
    const result = errorRecoveryService.handleToolError('test-call', 'openai', err, config);
    expect(result.shouldFallbackToVoicemail).toBe(true);
  });

  it('handleToolError returns shouldFallbackToVoicemail for Twilio stream drop', () => {
    const err = new Error('WebSocket connection closed');
    const result = errorRecoveryService.handleToolError('test-call', 'openai', err, config);
    expect(result.shouldFallbackToVoicemail).toBe(true);
  });
});
