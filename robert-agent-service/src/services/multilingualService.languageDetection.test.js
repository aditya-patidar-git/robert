/**
 * Regression: English "No, ..." must not be classified as Spanish/Italian via pattern `no`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import multilingualService from './multilingualService.js';
import { getToolsForContext } from './toolFilterService.js';

describe('multilingualService.detectLanguage', () => {
  it('does not treat English "No specific instructor" as Spanish', () => {
    assert.strictEqual(
      multilingualService.detectLanguage('No specific instructor.'),
      'en'
    );
  });

  it('still detects Spanish from clear cues', () => {
    assert.strictEqual(
      multilingualService.detectLanguage('Gracias, hablo español.'),
      'es'
    );
  });
});

describe('toolFilterService booking_options', () => {
  it('excludes file_search and web_search from booking_options phase', () => {
    const tools = getToolsForContext('booking_options', {});
    assert.ok(!tools.includes('file_search'), 'file_search should be withheld');
    assert.ok(!tools.includes('web_search'), 'web_search should be withheld');
    assert.ok(tools.includes('booking_step_fill_contact_details'));
    assert.ok(tools.includes('complaint_submission'));
  });
});
