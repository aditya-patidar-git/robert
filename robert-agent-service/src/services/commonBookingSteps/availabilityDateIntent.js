/**
 * Resolve natural-language date preferences for availability into concrete ranges or weekday filters.
 * Uses Europe/London for "next week", "mid month", and weekday refinements.
 */

import { parseISO, getDay, startOfWeek, addWeeks, addDays } from 'date-fns';
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import * as chrono from 'chrono-node';

const LONDON = 'Europe/London';

/** @typedef {{ type: 'none' }} NoneIntent */
/** @typedef {{ type: 'range', startISO: string, endISO: string, label?: string }} RangeIntent */
/** @typedef {{ type: 'weekday', weekday: number, anchorStartISO?: string|null, anchorEndISO?: string|null, label?: string }} WeekdayIntent */

/**
 * YYYY-MM-DD in London for an instant
 * @param {Date} date
 * @returns {string}
 */
export function formatDateInLondon(date) {
  return formatInTimeZone(date, LONDON, 'yyyy-MM-dd');
}

/**
 * JS weekday 0=Sun..6=Sat for a calendar YYYY-MM-DD interpreted as London date at noon.
 * @param {string} ymd
 * @returns {number|null}
 */
export function getJsWeekdayLondon(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  try {
    const localNoon = fromZonedTime(`${ymd} 12:00:00`, LONDON);
    return getDay(toZonedTime(localNoon, LONDON));
  } catch {
    return null;
  }
}

/**
 * Extract YYYY-MM-DD from a slot object (startDate preferred).
 * @param {object} slot
 * @returns {string|null}
 */
export function slotStartDateYMD(slot) {
  if (!slot) return null;
  if (slot.startDate && typeof slot.startDate === 'string') {
    const p = slot.startDate.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
  }
  return null;
}

/**
 * Compute anchor min/max from slots for refinements ("Friday instead").
 * @param {{ slotsToAnnounce?: object[], selectedSlot?: object|null, allSlots?: object[] }} param0
 * @returns {{ anchorDateMin: string|null, anchorDateMax: string|null }}
 */
export function computeAnchorRangeFromSlots({ slotsToAnnounce, selectedSlot, allSlots }) {
  const dates = [];
  const push = (slot) => {
    const y = slotStartDateYMD(slot);
    if (y) dates.push(y);
  };
  push(selectedSlot);
  (slotsToAnnounce || []).forEach(push);
  if (dates.length === 0 && Array.isArray(allSlots)) {
    allSlots.slice(0, 50).forEach(push);
  }
  if (dates.length === 0) {
    return { anchorDateMin: null, anchorDateMax: null };
  }
  dates.sort();
  return { anchorDateMin: dates[0], anchorDateMax: dates[dates.length - 1] };
}

/**
 * Monday–Sunday of the calendar week **after** the week that contains `now` (London).
 * @param {Date} now
 * @returns {{ startISO: string, endISO: string }}
 */
export function nextCalendarWeekAfterCurrentLondon(now) {
  const z = toZonedTime(now, LONDON);
  const mondayThis = startOfWeek(z, { weekStartsOn: 1 });
  const mondayNext = addWeeks(mondayThis, 1);
  const sundayNext = addDays(mondayNext, 6);
  return {
    startISO: formatInTimeZone(mondayNext, LONDON, 'yyyy-MM-dd'),
    endISO: formatInTimeZone(sundayNext, LONDON, 'yyyy-MM-dd')
  };
}

/**
 * Mid-month: days 10–20 inclusive of current month (London). If entire range is in the past, use next month.
 * @param {Date} now
 * @returns {{ startISO: string, endISO: string }}
 */
export function midMonthRangeLondon(now) {
  const ymd = formatDateInLondon(now);
  const [y, m] = ymd.split('-').map(Number);
  let start = fromZonedTime(`${y}-${String(m).padStart(2, '0')}-10 12:00:00`, LONDON);
  let end = fromZonedTime(`${y}-${String(m).padStart(2, '0')}-20 23:59:59`, LONDON);
  if (end < now) {
    const nm = m === 12 ? 1 : m + 1;
    const ny = m === 12 ? y + 1 : y;
    start = fromZonedTime(`${ny}-${String(nm).padStart(2, '0')}-10 12:00:00`, LONDON);
    end = fromZonedTime(`${ny}-${String(nm).padStart(2, '0')}-20 23:59:59`, LONDON);
  } else if (start < now) {
    const todayStr = formatDateInLondon(now);
    start = fromZonedTime(`${todayStr} 12:00:00`, LONDON);
  }
  return {
    startISO: formatInTimeZone(start, LONDON, 'yyyy-MM-dd'),
    endISO: formatInTimeZone(end, LONDON, 'yyyy-MM-dd')
  };
}

const FULL_NAME_TO_JS = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

/**
 * @param {string} lower trimmed lowercased phrase
 * @returns {number|null} JS getDay index or null
 */
function parseWeekdayToken(lower) {
  const t = lower.trim();
  const m = t.match(
    /\b(sun|mon|tue|wed|thu|fri|sat)(?:day)?\b|\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/
  );
  if (!m) return null;
  const word = (m[2] || m[1]).toLowerCase();
  if (FULL_NAME_TO_JS[word] !== undefined) return FULL_NAME_TO_JS[word];
  const three = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  return three[word.slice(0, 3)] ?? null;
}

/**
 * Next calendar date on or after `now` (London) with given JS weekday.
 * @param {Date} now
 * @param {number} weekdayJs 0 Sun .. 6 Sat
 * @returns {string} YYYY-MM-DD
 */
function nextWeekdayOnOrAfterLondon(now, weekdayJs) {
  const todayStr = formatDateInLondon(now);
  let d = fromZonedTime(`${todayStr} 12:00:00`, LONDON);
  for (let i = 0; i < 14; i++) {
    const cand = addDays(d, i);
    const ymd = formatInTimeZone(cand, LONDON, 'yyyy-MM-dd');
    if (getJsWeekdayLondon(ymd) === weekdayJs) {
      return ymd;
    }
  }
  return todayStr;
}

/**
 * @param {string} anchorMin YYYY-MM-DD
 * @param {string} anchorMax YYYY-MM-DD
 * @param {number} weekdayJs
 * @returns {boolean} true if any day in [min,max] matches weekday
 */
function weekdayOccursInRange(anchorMin, anchorMax, weekdayJs) {
  let cur = parseISO(anchorMin);
  const end = parseISO(anchorMax);
  for (let i = 0; i < 120; i++) {
    const ymd = formatInTimeZone(cur, LONDON, 'yyyy-MM-dd');
    if (ymd > anchorMax) break;
    if (getJsWeekdayLondon(ymd) === weekdayJs) return true;
    cur = addDays(cur, 1);
    if (cur > end) break;
  }
  return false;
}

/**
 * @param {object|null} lastCheck
 * @returns {{ min: string, max: string }|null}
 */
function getAnchorRangeFromLastCheck(lastCheck) {
  if (!lastCheck || typeof lastCheck !== 'object') return null;
  if (lastCheck.anchorDateMin && lastCheck.anchorDateMax) {
    return { min: lastCheck.anchorDateMin, max: lastCheck.anchorDateMax };
  }
  const { anchorDateMin, anchorDateMax } = computeAnchorRangeFromSlots({
    slotsToAnnounce: lastCheck.slotsToAnnounce,
    selectedSlot: lastCheck.selectedSlot,
    allSlots: lastCheck.allSlots
  });
  if (!anchorDateMin || !anchorDateMax) return null;
  return { min: anchorDateMin, max: anchorDateMax };
}

/**
 * @param {string} preferredDate
 * @param {Date} now
 * @param {object|null} lastCheck
 * @returns {NoneIntent|RangeIntent|WeekdayIntent}
 */
export function resolveAvailabilityDateIntent({ preferredDate, now = new Date(), lastCheck = null }) {
  if (!preferredDate || typeof preferredDate !== 'string') {
    return { type: 'none' };
  }
  const raw = preferredDate.trim();
  if (!raw) return { type: 'none' };

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { type: 'range', startISO: raw, endISO: raw, label: raw };
  }

  const lower = raw.toLowerCase();

  if (lower === 'next week' || /^next\s+week\.?$/.test(lower)) {
    const { startISO, endISO } = nextCalendarWeekAfterCurrentLondon(now);
    return { type: 'range', startISO, endISO, label: 'next week' };
  }

  if (
    /\bmid(dle)?\s+(of\s+)?(this\s+)?month\b/i.test(raw) ||
    /\bmid\s*[- ]?\s*month\b/i.test(lower) ||
    lower === 'mid month' ||
    lower === 'middle of the month'
  ) {
    const { startISO, endISO } = midMonthRangeLondon(now);
    return { type: 'range', startISO, endISO, label: 'mid month' };
  }

  const weekdayOnly = parseWeekdayToken(lower);
  const looksLikeWeekdayOnly =
    weekdayOnly !== null &&
    !/\d{4}/.test(raw) &&
    (lower.split(/\s+/).length <= 6 || /^((on|this|next)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(lower));

  if (looksLikeWeekdayOnly) {
    const anchors = getAnchorRangeFromLastCheck(lastCheck);
    if (anchors && weekdayOccursInRange(anchors.min, anchors.max, weekdayOnly)) {
      return {
        type: 'weekday',
        weekday: weekdayOnly,
        anchorStartISO: anchors.min,
        anchorEndISO: anchors.max,
        label: 'weekday in anchor'
      };
    }
    const single = nextWeekdayOnOrAfterLondon(now, weekdayOnly);
    return { type: 'range', startISO: single, endISO: single, label: 'weekday' };
  }

  const parsed = chrono.parse(raw, now, { forwardDate: true });
  if (parsed.length > 0) {
    const start = parsed[0].start?.date();
    if (start && !isNaN(start.getTime())) {
      const end = parsed[0].end?.date() || start;
      const s = formatDateInLondon(start);
      const e = formatDateInLondon(end);
      if (s && e) {
        const [a, b] = s <= e ? [s, e] : [e, s];
        return { type: 'range', startISO: a, endISO: b, label: raw };
      }
    }
  }

  return { type: 'none' };
}

/**
 * Filter slots by resolved date intent. Returns { filtered, noMatch: boolean }.
 * @param {object[]} allSlots
 * @param {NoneIntent|RangeIntent|WeekdayIntent} intent
 */
export function filterSlotsByDateIntent(allSlots, intent) {
  if (!Array.isArray(allSlots) || allSlots.length === 0) {
    return { filtered: [], noMatch: true };
  }
  if (!intent || intent.type === 'none') {
    return { filtered: allSlots, noMatch: false };
  }

  if (intent.type === 'range') {
    const { startISO, endISO } = intent;
    const filtered = allSlots.filter((s) => {
      const y = slotStartDateYMD(s);
      if (!y) return false;
      return y >= startISO && y <= endISO;
    });
    return { filtered, noMatch: filtered.length === 0 };
  }

  if (intent.type === 'weekday') {
    const { weekday, anchorStartISO, anchorEndISO } = intent;
    const filtered = allSlots.filter((s) => {
      const y = slotStartDateYMD(s);
      if (!y) return false;
      if (anchorStartISO && anchorEndISO) {
        if (y < anchorStartISO || y > anchorEndISO) return false;
      }
      return getJsWeekdayLondon(y) === weekday;
    });
    return { filtered, noMatch: filtered.length === 0 };
  }

  return { filtered: allSlots, noMatch: false };
}

const WD_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Short human-readable summary for tool messages and logs.
 * @param {NoneIntent|RangeIntent|WeekdayIntent|null|undefined} intent
 * @returns {string}
 */
export function summarizeDateIntent(intent) {
  if (!intent || intent.type === 'none') return '';
  if (intent.type === 'range') {
    if (intent.startISO === intent.endISO) {
      return intent.label ? `${intent.label} (${intent.startISO})` : intent.startISO;
    }
    const label = intent.label || 'date range';
    return `${label} (${intent.startISO} to ${intent.endISO})`;
  }
  if (intent.type === 'weekday') {
    const name = WD_NAMES[intent.weekday] || 'weekday';
    if (intent.anchorStartISO && intent.anchorEndISO) {
      return `${name} in prior window (${intent.anchorStartISO} to ${intent.anchorEndISO})`;
    }
    return name;
  }
  return '';
}
