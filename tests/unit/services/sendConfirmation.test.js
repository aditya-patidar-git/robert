/**
 * Unit tests for sendConfirmation step (Req 19: CRM confirmation sent after success).
 */

import { describe, it, expect, jest, beforeAll } from '@jest/globals';

const sendBookingConfirmationEmailMock = jest.fn().mockResolvedValue(undefined);

beforeAll(async () => {
  await jest.unstable_mockModule('../../../robert-agent-service/src/services/commonBookingSteps/index.js', () => ({
    sendBookingConfirmationEmail: sendBookingConfirmationEmailMock
  }));
});

describe('sendConfirmation step', () => {
  it('returns confirmationSent true after successful send', async () => {
    const { executeSendConfirmation } = await import('../../../robert-agent-service/src/services/browser/stepExecutor/stepExecutors/sendConfirmation.js');
    const result = await executeSendConfirmation(
      {},
      { courseType: 'CBT' },
      { courseType: 'CBT' },
      '/tmp'
    );
    expect(result.success).toBe(true);
    expect(result.confirmationSent).toBe(true);
    expect(sendBookingConfirmationEmailMock).toHaveBeenCalled();
  });
});
