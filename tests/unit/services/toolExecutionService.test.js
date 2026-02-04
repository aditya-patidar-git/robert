/**
 * Unit tests for ToolExecutionService (Category A: CRM tasking).
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import toolExecutionService from '../../../robert-agent-service/src/services/toolExecutionService.js';

describe('ToolExecutionService', () => {
  describe('parseArguments', () => {
    it('returns empty object for null or empty string', () => {
      expect(toolExecutionService.parseArguments(null)).toEqual({});
      expect(toolExecutionService.parseArguments('')).toEqual({});
      expect(toolExecutionService.parseArguments('   ')).toEqual({});
    });

    it('returns object as-is when given object', () => {
      const args = { task: 'reschedule', date: '2025-02-10' };
      expect(toolExecutionService.parseArguments(args)).toEqual(args);
    });

    it('parses valid JSON string', () => {
      const args = toolExecutionService.parseArguments('{"task":"reschedule","date":"2025-02-10"}');
      expect(args).toEqual({ task: 'reschedule', date: '2025-02-10' });
    });

    it('throws on invalid JSON string', () => {
      expect(() => toolExecutionService.parseArguments('{ invalid }')).toThrow(/Failed to parse tool arguments/);
    });
  });

  describe('checkDuplicateCall', () => {
    it('returns false for first call', () => {
      const isDup = toolExecutionService.checkDuplicateCall('call-1', 'file_search', { query: 'test' });
      expect(isDup).toBe(false);
    });

    it('returns true for duplicate call with same params', () => {
      const callId = 'call-dup-' + Date.now();
      toolExecutionService.checkDuplicateCall(callId, 'file_search', { query: 'test' });
      const isDup = toolExecutionService.checkDuplicateCall(callId, 'file_search', { query: 'test' });
      expect(isDup).toBe(true);
    });

    it('returns false for same tool with different params', () => {
      const callId = 'call-diff-' + Date.now();
      toolExecutionService.checkDuplicateCall(callId, 'file_search', { query: 'query1' });
      const isDup = toolExecutionService.checkDuplicateCall(callId, 'file_search', { query: 'query2' });
      expect(isDup).toBe(false);
    });
  });
});
