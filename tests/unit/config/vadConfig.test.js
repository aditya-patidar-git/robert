import { describe, it, expect } from '@jest/globals';
import { getVADConfig } from '../../../robert-agent-service/src/config/vadConfig.js';

describe('VAD Configuration', () => {
  it('uses correct threshold range (500-700ms)', () => {
    const config = getVADConfig({ vadThreshold: 600 });
    expect(config.threshold).toBeGreaterThanOrEqual(500);
    expect(config.threshold).toBeLessThanOrEqual(700);
  });

  it('default threshold is 500', () => {
    const config = getVADConfig({});
    expect(config.threshold).toBe(500);
  });

  it('has correct padding values', () => {
    const config = getVADConfig({ startPadding: 250, endPadding: 400 });
    expect(config.startPadding).toBe(250);
    expect(config.endPadding).toBeGreaterThanOrEqual(300);
    expect(config.endPadding).toBeLessThanOrEqual(500);
  });

  it('default startPadding is 250', () => {
    const config = getVADConfig({});
    expect(config.startPadding).toBe(250);
  });

  it('default endPadding is 500', () => {
    const config = getVADConfig({});
    expect(config.endPadding).toBe(500);
  });

  it('accepts endPadding in valid range 300-500', () => {
    const config = getVADConfig({ endPadding: 400 });
    expect(config.endPadding).toBe(400);
  });
});
