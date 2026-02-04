/**
 * Unit tests for URL validation (Req 16: SSRF/DOM injection defence).
 */

import { describe, it, expect } from '@jest/globals';
import urlValidation from '../../../robert-agent-service/src/utils/urlValidation.js';

describe('UrlValidation', () => {
  it('rejects javascript: protocol', () => {
    const r = urlValidation.validateUrl('javascript:alert(1)');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/Blocked protocol|javascript/);
  });

  it('rejects file: protocol', () => {
    const r = urlValidation.validateUrl('file:///etc/passwd');
    expect(r.valid).toBe(false);
  });

  it('rejects private IP localhost', () => {
    const r = urlValidation.validateUrl('http://127.0.0.1/admin');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/Blocked IP|127/);
  });

  it('rejects domain not in allowed list', () => {
    const r = urlValidation.validateUrl('https://evil.com/path');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/allowed|Domain/);
  });
});
