/**
 * Transcripts & Complaints Page Utilities
 * Shared utility functions for consent status and content availability
 */

/**
 * Check if transcript/recording is available based on consent status
 * Content is available unless consent is explicitly denied (false)
 * null/undefined means opt-in (default behavior per GDPR)
 * @param {Object} record - Call record with recordingConsent field
 * @returns {boolean} - true if content is available
 */
export const isContentAvailable = (record) => {
  return record?.recordingConsent?.given !== false;
};

/**
 * Get consent status display info for UI components
 * @param {Object} record - Call record with recordingConsent field
 * @returns {Object} - { label, color, variant } for Chip component
 */
export const getConsentStatusDisplay = (record) => {
  const available = isContentAvailable(record);
  return {
    label: available ? 'Available' : 'No Consent',
    color: available ? 'success' : 'default',
    variant: available ? 'filled' : 'outlined'
  };
};

/**
 * Format consent status for export/display
 * @param {Object} record - Call record with recordingConsent field
 * @returns {string} - Human readable consent status
 */
export const formatConsentStatus = (record) => {
  if (record?.recordingConsent?.given === true) {
    return 'Consent Given';
  } else if (record?.recordingConsent?.given === false) {
    return 'Consent Denied';
  }
  return 'Not Requested (Default Opt-in)';
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
  const consentDenied = record?.recordingConsent?.given === false;
  const hasDuration = hasSufficientDuration(record);

  // Check consent first
  if (consentDenied) {
    return {
      label: 'No Consent',
      color: 'default',
      canPlay: false,
      tooltip: 'Recording consent was not given for this call'
    };
  }

  // Check duration - 0-second calls never have recordings
  if (!hasDuration) {
    return {
      label: 'No Audio',
      color: 'default',
      canPlay: false,
      tooltip: 'Call duration too short - no audio was captured'
    };
  }

  // Has recording URL - available for playback
  if (hasUrl || status === 'available') {
    return {
      label: 'Available',
      color: 'success',
      canPlay: true,
      tooltip: 'Recording is available for playback'
    };
  }

  // Check status for calls with sufficient duration
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

/**
 * Minimum duration (in seconds) for a call to potentially have a recording
 * Calls shorter than this are typically failed/missed connections
 */
export const MIN_RECORDING_DURATION = 1;

/**
 * Check if a call has sufficient duration to have a recording
 * @param {Object} record - Call record with duration field
 * @returns {boolean} - true if duration is sufficient for recording
 */
export const hasSufficientDuration = (record) => {
  const duration = record?.duration;
  // Duration must be a positive number greater than minimum
  return typeof duration === 'number' && duration >= MIN_RECORDING_DURATION;
};

/**
 * Check if recording can potentially be played
 * @param {Object} record - Call record
 * @returns {boolean} - true if recording might be playable
 */
export const canAttemptPlayback = (record) => {
  // Can't play if consent denied
  if (record?.recordingConsent?.given === false) {
    return false;
  }
  
  // Can't play if duration is 0 or too short (no audio captured)
  if (!hasSufficientDuration(record)) {
    return false;
  }
  
  // Can play if we have URL or status is not definitively unavailable
  if (record?.recordingUrl) {
    return true;
  }
  
  // Don't attempt if we know it's not found
  if (record?.recordingStatus === 'not_found') {
    return false;
  }
  
  // For unknown/processing/error status, allow attempt (will trigger fetch)
  return true;
};
