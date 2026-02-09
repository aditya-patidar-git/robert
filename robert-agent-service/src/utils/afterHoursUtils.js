/**
 * After-hours policy helper.
 * Determines if current time falls inside the configured after-hours window (e.g. 18:00–09:00).
 * Uses Intl for timezone-aware current time.
 */

/**
 * Parse "HH:MM" or "H:MM" to minutes since midnight.
 * @param {string} timeStr - e.g. "18:00", "09:00"
 * @returns {number} Minutes since midnight (0–1439)
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.trim().split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return Math.max(0, Math.min(1439, hours * 60 + minutes));
}

/**
 * Get current local time in the given timezone as minutes since midnight.
 * @param {string} timezone - IANA timezone (e.g. "Europe/London")
 * @returns {number} Minutes since midnight (0–1439)
 */
function getCurrentMinutesInTimezone(timezone) {
  const tz = timezone || 'Europe/London';
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(new Date());
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  return hour * 60 + minute;
}

/**
 * Returns true if the current time (in the policy's timezone) is within the after-hours window.
 * Window: startTime to endTime. If startTime > endTime (e.g. 18:00 to 09:00), treats as overnight:
 * after-hours when current >= startTime OR current < endTime.
 * @param {Object} policy - afterHoursPolicy from TelephonyConfig
 * @param {boolean} [policy.enabled]
 * @param {string} [policy.startTime] - e.g. "18:00"
 * @param {string} [policy.endTime] - e.g. "09:00"
 * @param {string} [policy.timezone] - e.g. "Europe/London"
 * @returns {boolean}
 */
export function isAfterHours(policy) {
  if (!policy || policy.enabled !== true) return false;
  const startMinutes = parseTimeToMinutes(policy.startTime || '18:00');
  const endMinutes = parseTimeToMinutes(policy.endTime || '09:00');
  const current = getCurrentMinutesInTimezone(policy.timezone || 'Europe/London');

  if (startMinutes > endMinutes) {
    return current >= startMinutes || current < endMinutes;
  }
  return current >= startMinutes && current < endMinutes;
}
