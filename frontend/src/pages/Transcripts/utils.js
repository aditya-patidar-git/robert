/**
 * Transcripts & Complaints Page Utilities
 * Shared utility functions for consent status and content availability
 */

/**
 * Recording/transcript may only be shown when the caller explicitly agreed to recording consent.
 * @param {Object} record - Call record with recordingConsent field
 * @returns {boolean}
 */
export const hasRecordingConsent = (record) => {
  return record?.recordingConsent?.given === true;
};

/**
 * Content (transcript + recording in UI) requires explicit agreement.
 * @param {Object} record
 * @returns {boolean}
 */
export const isContentAvailable = (record) => {
  return hasRecordingConsent(record);
};

/**
 * Get consent status display for the transcript list (Agreed / Declined / Not recorded).
 * @param {Object} record - Call record with recordingConsent field
 * @returns {Object} - { label, color, variant } for Chip component
 */
export const getConsentStatusDisplay = (record) => {
  const given = record?.recordingConsent?.given;
  if (given === true) {
    return { label: 'Agreed', color: 'success', variant: 'filled' };
  }
  if (given === false) {
    return { label: 'Declined', color: 'default', variant: 'outlined' };
  }
  return { label: 'Not recorded', color: 'warning', variant: 'outlined' };
};

/**
 * Format consent status for export/display
 * @param {Object} record - Call record with recordingConsent field
 * @returns {string} - Human readable consent status
 */
export const formatConsentStatus = (record) => {
  if (record?.recordingConsent?.given === true) {
    return 'Agreed';
  } else if (record?.recordingConsent?.given === false) {
    return 'Declined';
  }
  return 'Not recorded';
};

/**
 * Check if recording consent was explicitly requested
 * @param {Object} record - Call record with recordingConsent field
 * @returns {boolean} - true if consent was requested
 */
export const wasConsentRequested = (record) => {
  return record?.recordingConsent?.requested === true;
};

/**
 * Get confidence score color based on value
 * @param {number} score - Confidence score (0-1)
 * @returns {string} - MUI color name
 */
export const getConfidenceColor = (score) => {
  if (score >= 0.8) return 'success';
  if (score >= 0.6) return 'warning';
  return 'error';
};

/**
 * Format confidence score as percentage
 * @param {number} score - Confidence score (0-1)
 * @returns {string} - Formatted percentage string
 */
export const formatConfidenceScore = (score) => {
  if (score === undefined || score === null) return 'N/A';
  return `${Math.round(score * 100)}%`;
};

/**
 * Recording status constants
 */
export const RECORDING_STATUS = {
  UNKNOWN: 'unknown',
  AVAILABLE: 'available',
  NOT_FOUND: 'not_found',
  PROCESSING: 'processing',
  ERROR: 'error'
};

/**
 * Get recording status display info for UI
 * @param {Object} record - Call record with recordingStatus field
 * @returns {Object} - { label, color, icon, canPlay, tooltip }
 */
export const getRecordingStatusDisplay = (record) => {
  const status = record?.recordingStatus || 'unknown';
  const hasUrl = !!record?.recordingUrl;
  const consentOk = hasRecordingConsent(record);
  const hasDuration = hasSufficientDuration(record);

  if (!consentOk) {
    return {
      label: 'No access',
      color: 'default',
      canPlay: false,
      tooltip:
        record?.recordingConsent?.given === false
          ? 'Caller declined recording consent — playback is not available'
          : 'Recording consent was not recorded as agreed — playback is not available'
    };
  }

  if (!hasDuration) {
    return {
      label: 'No Audio',
      color: 'default',
      canPlay: false,
      tooltip: 'Call duration too short - no audio was captured'
    };
  }

  if (hasUrl || status === 'available') {
    return {
      label: 'Available',
      color: 'success',
      canPlay: true,
      tooltip: 'Recording is available for playback'
    };
  }

  switch (status) {
    case 'not_found':
      return {
        label: 'Not Recorded',
        color: 'default',
        canPlay: false,
        tooltip: 'No recording exists for this call'
      };
    case 'processing':
      return {
        label: 'Processing',
        color: 'warning',
        canPlay: false,
        tooltip: 'Recording is still being processed by Twilio'
      };
    case 'error':
      return {
        label: 'Error',
        color: 'error',
        canPlay: false,
        tooltip: 'Failed to fetch recording from Twilio'
      };
    default:
      return {
        label: 'Check',
        color: 'info',
        canPlay: true,
        tooltip: 'Click to check if recording is available'
      };
  }
};

export const MIN_RECORDING_DURATION = 1;

export const hasSufficientDuration = (record) => {
  const duration = record?.duration;
  return typeof duration === 'number' && duration >= MIN_RECORDING_DURATION;
};

export const canAttemptPlayback = (record) => {
  if (!hasRecordingConsent(record)) {
    return false;
  }
  if (!hasSufficientDuration(record)) {
    return false;
  }
  if (record?.recordingUrl) {
    return true;
  }
  if (record?.recordingStatus === 'not_found') {
    return false;
  }
  return true;
};
