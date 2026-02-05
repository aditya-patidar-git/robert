/**
 * Name search helper for client search fallback (doc: first 3 + space + last 3; or middle 3)
 */

/**
 * Build name search string(s) per CRM doc: first 3 letters of first name + space + first 3 of last name;
 * if no match, try first 3 of first + space + first 3 of middle name.
 * @param {string} fullName - Full name (e.g. "Robert John Smith")
 * @returns {{ primary: string, fallback: string|null }}
 */
export function buildNameSearchStrings(fullName) {
  if (!fullName || typeof fullName !== 'string') {
    return { primary: '', fallback: null };
  }
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { primary: '', fallback: null };
  const first = parts[0].slice(0, 3);
  if (parts.length === 1) return { primary: first, fallback: null };
  const last = parts[parts.length - 1].slice(0, 3);
  const primary = `${first} ${last}`;
  const fallback = parts.length >= 3 ? `${first} ${parts[1].slice(0, 3)}` : null;
  return { primary, fallback };
}

export const NAME_SEARCH_RETRY_PROMPT = 'Could you please tell me your full name?';
