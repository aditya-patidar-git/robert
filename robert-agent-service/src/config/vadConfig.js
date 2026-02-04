/**
 * VAD (Voice Activity Detection) config normalization.
 * Returns threshold (ms), startPadding (ms), endPadding (ms) with validated defaults.
 */
export function getVADConfig(config = {}) {
  return {
    threshold: config.vadThreshold ?? 500,
    startPadding: config.startPadding ?? 250,
    endPadding: config.endPadding ?? 500
  };
}
