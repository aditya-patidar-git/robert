/**
 * Escape special regex characters in a string for safe use in MongoDB $regex.
 * Prevents ReDoS and incorrect matches when user input is used in regex patterns.
 *
 * @param {string} value - Value to sanitize
 * @returns {string} Escaped string safe for use in $regex
 */
export function escapeRegex(value) {
  if (typeof value !== 'string') {
    return String(value ?? '');
  }
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
