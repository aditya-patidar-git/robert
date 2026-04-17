import { takeScreenshot, extractLocationIdentifier } from './utils.js';
import { filterSlotsByDateIntent, summarizeDateIntent } from './availabilityDateIntent.js';

/** Postcode prefix to centre name for location matching (matches utils.js centres) */
const POSTCODE_TO_CENTRE = {
  RM9: 'Dagenham',
  EN11: 'Hoddesdon',
  HA0: 'Alperton',
  CR0: 'Croydon',
  HA8: 'Edgware',
  SE3: 'Eltham',
  KT3: 'Wimbledon'
};

function normaliseToCentreName(identifier) {
  if (!identifier) return null;
  const key = String(identifier).toUpperCase();
  if (POSTCODE_TO_CENTRE[key]) return POSTCODE_TO_CENTRE[key];
  return identifier;
}

/**
 * Course type to availability URL mapping
 */
const AVAILABILITY_URLS = {
  'ITM': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=C9170432CA66685F',
  'Introduction to Motorcycling': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=C9170432CA66685F',
  'CBT': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=8ABD7DD7AAF3C2C5',
  'Compulsory Basic Training': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=8ABD7DD7AAF3C2C5',
  'CBT Executive': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=06EF66470DC0CDC4',
  'CBT Executive 1-2-1': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=06EF66470DC0CDC4',
  'Private Lesson': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=CFB644AFFB83F5C6',
  'Gear Conversion': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=C07F8089718288E3',
  'TfL 1-2-1': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=DDAE018B4D15B60A',
  'TfL 1-2-1 Motorcycle Skills': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=DDAE018B4D15B60A',
  'TfL Beyond CBT': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=4A4B4A440C24B86F',
  'TfL - Beyond CBT - Skills for Delivery Riders': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=4A4B4A440C24B86F',
  'Full Licence Assessment': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=6AC7F0C984D9D87A',
  'Full Motorcycle Licence Assessment': 'https://www.bookcbtnow.com/incontact/public/gateway.aspx?func_id=79A2A98E7C95DA57&obc_id=6AC7F0C984D9D87A'
};

/**
 * Check availability for a specific course type
 * @param {Page} page - Playwright page object
 * @param {string} courseType - Course type (e.g., 'ITM', 'CBT', 'Private Lesson')
 * @param {string} screenshotsDir - Directory to save screenshots
 * @param {Object} preferences - Optional preferences for slot matching {preferredDate, preferredTime, location}
 * @param {Function|null} progressCallback - Optional callback({ message }) for path-based voice updates
 * @returns {Promise<{allSlots: Array, selectedSlot: Object, monthYear: string}>}
 */
export async function checkAvailabilityAndNoteDetails(page, courseType, screenshotsDir, preferences = {}, progressCallback = null) {
  try {
    // Get availability URL for course type
    const availabilityUrl = AVAILABILITY_URLS[courseType];

    if (!availabilityUrl) {
      throw new Error(`No availability URL found for course type: ${courseType}`);
    }

    console.log(`📅 [AVAILABILITY] Checking availability for ${courseType}...`);
    console.log(`📅 Navigating to availability page: ${availabilityUrl}`);

    await page.goto(availabilityUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    });
    progressCallback?.({ message: 'Loading the availability page.' });

    // Wait for the availability table to be visible
    await page.waitForSelector('#availabilityTable', { timeout: 20000 });

    // Find the availability table by ID
    const availabilityTable = page.locator('#availabilityTable');
    await availabilityTable.waitFor({ state: 'visible', timeout: 20000 });

    // Wait for table to be populated with data rows
    await page.waitForSelector('#availabilityTable tbody tr.availabilityDataRow', { timeout: 20000 });
    progressCallback?.({ message: 'Fetching available slots.' });

    // Get the LAST month cell (latest month)
    const lastMonthCell = availabilityTable.locator('td.availabilityMonthCell').last();
    const latestMonthYear = (await lastMonthCell.textContent()).trim();

    console.log(`📅 Latest month found: ${latestMonthYear}`);

    // Get all data rows
    const allDataRows = availabilityTable.locator('tbody tr.availabilityDataRow');
    const rowCount = await allDataRows.count();

    console.log(`📊 Total data rows found: ${rowCount}`);

    if (rowCount === 0) {
      throw new Error('No availability entries found');
    }

    const preferredDateNorm = preferences._preferredDateScanYMD
      ? preferences._preferredDateScanYMD
      : (preferences.preferredDate ? normalizeDateToYYYYMMDD(preferences.preferredDate) : null);
    const preferredEndOfDay = preferredDateNorm ? (() => {
      const d = new Date(preferredDateNorm + 'T23:59:59.999Z');
      return isNaN(d.getTime()) ? null : d.getTime();
    })() : null;

    const dateIntent = preferences._availabilityDateIntent || { type: 'none' };
    const hasPreferences = !!(
      preferences.preferredDate ||
      preferences.preferredTime ||
      preferences.location ||
      preferences.instructor ||
      (dateIntent && dateIntent.type !== 'none')
    );
    // Full table scan in one page.evaluate — avoids missing instructors/slots that appear after an arbitrary row cap.
    let rowsToScan = allDataRows;
    let rowCountToUse = rowCount;
    let rowIndexOffset = 0;
    let scanStartIndex = 0;

    if (preferredDateNorm) {
      scanStartIndex = 0;
      rowCountToUse = rowCount;
      console.log(`📅 [AVAILABILITY] Preferred date ${preferredDateNorm} provided - scanning entire table for matches`);
    } else {
      scanStartIndex = 0;
      rowCountToUse = rowCount;
      console.log(`📅 [AVAILABILITY] Scanning full availability table (${rowCountToUse} row(s))`);
    }


    // PERFORMANCE FIX: Bulk extract all slot data in a single page.evaluate() call
    // Instead of 6+ async locator calls per row (150+ round-trips for 25 rows),
    // we extract everything in one synchronous DOM traversal.
    let allSlots = await page.evaluate(({ startIdx, count }) => {
      const rows = document.querySelectorAll('#availabilityTable tbody tr.availabilityDataRow');
      const slots = [];
      const endIdx = Math.min(startIdx + count, rows.length);

      for (let i = startIdx; i < endIdx; i++) {
        const row = rows[i];
        const startDateAttr = row.getAttribute('data-start_date');

        const cells = row.querySelectorAll('td');
        const date = cells[0]?.textContent?.trim() || '';
        const time = cells[3]?.textContent?.trim() || '';

        if (date && time) {
          slots.push({
            date,
            course: cells[1]?.textContent?.trim() || '',
            location: cells[2]?.textContent?.trim() || '',
            time,
            price: cells[4]?.textContent?.trim() || '',
            instructor: (cells[6]?.textContent?.trim() || '').replace(/^Instructor:\s*/i, ''),
            startDate: startDateAttr,
            rowIndex: i
          });
        }
      }
      return slots;
    }, {
      startIdx: scanStartIndex,
      count: rowCountToUse
    }).catch(evalError => {
      console.warn(`⚠️ [AVAILABILITY] Bulk extraction failed, falling back to sequential:`, evalError.message);
      return null; // Will trigger fallback below
    });

    // Fallback: if bulk extraction failed, use sequential approach
    if (allSlots === null) {
      const fallbackSlots = [];
      for (let i = 0; i < rowCountToUse; i++) {
        const dataRow = rowsToScan.nth(scanStartIndex + i);
        await dataRow.waitFor({ state: 'visible' }).catch(() => null);
        let startDateAttr = null;
        try { startDateAttr = await dataRow.getAttribute('data-start_date'); } catch (e) { /* ignore */ }
        try {
          const slot = {
            date: (await dataRow.locator('td').nth(0).textContent()).trim(),
            course: (await dataRow.locator('td').nth(1).textContent()).trim(),
            location: (await dataRow.locator('td').nth(2).textContent()).trim(),
            time: (await dataRow.locator('td').nth(3).textContent()).trim(),
            price: (await dataRow.locator('td').nth(4).textContent()).trim(),
            instructor: (await dataRow.locator('td').nth(6).textContent()).trim().replace(/^Instructor:\s*/i, ''),
            startDate: startDateAttr,
            monthYear: latestMonthYear,
            rowIndex: (rowIndexOffset >= 0 || scanStartIndex > 0) ? (scanStartIndex + i) : undefined
          };
          if (slot.date && slot.time) fallbackSlots.push(slot);
        } catch (rowError) {
          console.warn(`⚠️ [AVAILABILITY] Error extracting slot ${i}:`, rowError.message);
        }
      }
      allSlots = fallbackSlots;
    }

    console.log(`📋 [AVAILABILITY] Extracted ${allSlots.length} available slots for ${courseType}`);

    if (allSlots.length === 0) {
      throw new Error('No valid availability slots found');
    }

    // Sort slots chronologically by actual date (earliest first)
    // This ensures we show the most recent/earliest available slots first
    allSlots.sort((a, b) => {
      // Try to parse dates from startDate (ISO format) or date field
      let dateA = null;
      let dateB = null;

      if (a.startDate) {
        dateA = new Date(a.startDate);
      } else if (a.date) {
        // Try to parse date string like "Tue 16th" by combining with current context
        dateA = parseDateFromSlotString(a.date, latestMonthYear);
      }

      if (b.startDate) {
        dateB = new Date(b.startDate);
      } else if (b.date) {
        dateB = parseDateFromSlotString(b.date, latestMonthYear);
      }

      if (dateA && dateB) {
        return dateA.getTime() - dateB.getTime(); // Earliest first
      }
      // If dates can't be parsed, keep original order
      return 0;
    });

    // Extract month from each slot's actual date instead of using a single month
    // This ensures each slot has the correct month/year
    allSlots.forEach(slot => {
      if (slot.startDate) {
        const slotDate = new Date(slot.startDate);
        if (!isNaN(slotDate.getTime())) {
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
          slot.monthYear = `${monthNames[slotDate.getMonth()]} ${slotDate.getFullYear()}`;
        }
      } else if (slot.date) {
        // Fallback: try to extract month from date string
        const parsedDate = parseDateFromSlotString(slot.date, latestMonthYear);
        if (parsedDate && !isNaN(parsedDate.getTime())) {
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
          slot.monthYear = `${monthNames[parsedDate.getMonth()]} ${parsedDate.getFullYear()}`;
        } else {
          // Keep the latest month as fallback
          slot.monthYear = latestMonthYear;
        }
      } else {
        slot.monthYear = latestMonthYear;
      }
    });

    const { filtered: candidateSlots, noMatch: dateFilterNoMatch } = filterSlotsByDateIntent(allSlots, dateIntent);
    const noSlotsInDateFilter = dateIntent.type !== 'none' && dateFilterNoMatch;
    const dateFilterSummary = summarizeDateIntent(dateIntent);
    const instructorLocationMetaWindow = computeInstructorAvailabilityMeta(candidateSlots, preferences);
    const strictLocationOrInstructor =
      !!(String(preferences.instructor || '').trim() || String(preferences.location || '').trim());
    const instructorLocationMetaLoadedTable =
      noSlotsInDateFilter && strictLocationOrInstructor
        ? computeInstructorAvailabilityMeta(allSlots, preferences)
        : null;
    const instructorLocationMeta = instructorLocationMetaLoadedTable
      ? {
          ...instructorLocationMetaLoadedTable,
          noSlotsInRequestedDateWindow: true,
          dateWindowSummary: dateFilterSummary || null
        }
      : {
          ...instructorLocationMetaWindow,
          noSlotsInRequestedDateWindow: noSlotsInDateFilter && dateIntent.type !== 'none',
          dateWindowSummary:
            noSlotsInDateFilter && dateIntent.type !== 'none' ? dateFilterSummary || null : null
        };

    // Log the date range of extracted slots for debugging
    if (allSlots.length > 0) {
      const firstSlot = allSlots[0];
      const lastSlot = allSlots[allSlots.length - 1];
      console.log(`📅 [AVAILABILITY] Slot date range: ${firstSlot.date} (${firstSlot.monthYear}) to ${lastSlot.date} (${lastSlot.monthYear})`);
    }

    const buildPrefsForScoring = (prefs, intent) => {
      const p = { ...prefs };
      if (intent.type === 'range' && intent.startISO === intent.endISO) {
        p.preferredDate = intent.startISO;
      } else if (intent.type === 'weekday') {
        delete p.preferredDate;
      }
      return p;
    };

    // Select the best matching slot based on preferences
    // Only auto-select if preferences are provided
    progressCallback?.({ message: 'Finding a slot for you.' });
    let selectedSlot = null;

    if (hasPreferences && !noSlotsInDateFilter && candidateSlots.length > 0) {
      const prefsForScoring = buildPrefsForScoring(preferences, dateIntent);
      selectedSlot = selectBestMatchingSlot(candidateSlots, prefsForScoring);
      if (selectedSlot) {
        console.log(`✅ [AVAILABILITY] Selected slot based on preferences:`, selectedSlot);
        console.log(`   Date: ${selectedSlot.date}, Time: ${selectedSlot.time}, Location: ${selectedSlot.location}`);
      } else {
        console.log(`⚠️ [AVAILABILITY] No matching slot found for preferences, returning all slots`);
      }
    } else if (hasPreferences && noSlotsInDateFilter) {
      console.log(`⚠️ [AVAILABILITY] No slots in resolved date window (${dateFilterSummary || 'date filter'})`);
    } else {
      // No preferences provided - don't auto-select
      console.log(`📋 [AVAILABILITY] No preferences provided - returning all slots for user selection`);
    }

    const returnMonthYear = allSlots.length > 0 && allSlots[0].monthYear
      ? allSlots[0].monthYear
      : latestMonthYear;

    // ─────────────────────────────────────────────────────────────────────
    // Build slotsToAnnounce: the 3-slot spoken shortlist.
    //
    // Five cases depending on what preferences were provided and whether the
    // selected slot actually matched the preferred location:
    //
    //   EC-5  : noSlotsInDateFilter      → 3 closest-date slots (all centres)
    //   Base  : no preferences / no slot → earliest date's slots (diverse)
    //   Case 1: date only, no location   → same-date all-centre diverse, fill proximity
    //   Case 2: date+location, matched   → same-centre same-date, then proximity fill
    //   Case 3: date+location, fallback  → same-date all-centre diverse, then preferred-centre proximity
    // ─────────────────────────────────────────────────────────────────────
    let announceIncludesNonPreferredInstructor = false;
    let slotsToAnnounce;
    {
      // When caller specified a date preference, show up to 5 slots for better coverage;
      // otherwise default to 3 to keep the spoken list concise.
      const shortlistCap = (dateIntent.type !== 'none' || preferredDateNorm) ? 5 : 3;

      // ── Shared helpers ──────────────────────────────────────────────────
      const _slotKey = (s) => `${s.date}|${s.time}|${String(s.location || '').slice(0, 160)}`;
      const _centre  = (loc) => normaliseToCentreName(extractLocationIdentifier(loc || ''));

      // Dedup ordered list, capped at `cap`.
      const _dedup = (ordered, cap = shortlistCap) => {
        const seen = new Set();
        const out  = [];
        for (const s of ordered) {
          const k = _slotKey(s);
          if (!seen.has(k)) { seen.add(k); out.push(s); }
          if (out.length >= cap) break;
        }
        return out;
      };

      // Pick up to `cap` slots, preferring one per centre first (diversity), then extras.
      const _diversePick = (slots, cap = shortlistCap) => {
        const seen = new Set();
        const seenCentres = new Set();
        const first = [];
        const rest  = [];
        for (const s of slots) {
          const k = _slotKey(s);
          if (seen.has(k)) continue;
          seen.add(k);
          const c = _centre(s.location) || 'unknown';
          if (!seenCentres.has(c)) { seenCentres.add(c); first.push(s); }
          else rest.push(s);
        }
        return [...first, ...rest].slice(0, cap);
      };

      // Sort a copy of `slots` by |date - refMs|, ascending.
      const _byProximity = (slots, refMs) => {
        if (refMs == null) return [...slots];
        return [...slots].sort((a, b) => {
          const aMs = a.startDate ? new Date(a.startDate).getTime() : Infinity;
          const bMs = b.startDate ? new Date(b.startDate).getTime() : Infinity;
          return Math.abs(aMs - refMs) - Math.abs(bMs - refMs);
        });
      };

      // All slots whose ISO date (YYYY-MM-DD) matches `isoDate`.
      const _onDate = (pool, isoDate) =>
        pool.filter(s => s.startDate && s.startDate.startsWith(isoDate));

      // ── Reference timestamps ────────────────────────────────────────────
      const prefDateMs  = preferredDateNorm
        ? new Date(preferredDateNorm + 'T00:00:00Z').getTime()
        : null;
      const selectedIso = selectedSlot?.startDate?.split('T')[0] ?? null;
      const selDateMs   = selectedSlot?.startDate
        ? new Date(selectedSlot.startDate).getTime()
        : prefDateMs;

      // ── Determine which case applies ────────────────────────────────────
      const locationPreferenceGiven =
        !!(preferences.location && String(preferences.location).trim());

      const locationMatchedForSelectedSlot =
        locationPreferenceGiven &&
        selectedSlot != null &&
        !!(_centre(selectedSlot.location) &&
           _centre(preferences.location) &&
           _centre(selectedSlot.location).toLowerCase() ===
             _centre(preferences.location).toLowerCase());

      const ec5RefMs =
        prefDateMs ??
        (noSlotsInDateFilter &&
        dateIntent.type === 'range' &&
        dateIntent.startISO &&
        dateIntent.endISO
          ? Math.round(
              (new Date(`${dateIntent.startISO}T12:00:00.000Z`).getTime() +
                new Date(`${dateIntent.endISO}T12:00:00.000Z`).getTime()) /
                2
            )
          : null);

      if (noSlotsInDateFilter) {
        // EC-5: Date given but zero slots in that window — show 3 closest to reference (single-day norm or range midpoint).
        console.log(`📋 [SLOTS] EC-5: no slots in date window — showing closest alternatives (refMs=${ec5RefMs})`);
        slotsToAnnounce =
          ec5RefMs != null ? _dedup(_byProximity(allSlots, ec5RefMs)) : _dedup(allSlots);

      } else if (!hasPreferences || !selectedSlot) {
        // Base: no preferences — show earliest date's slots (centre-diverse), then fill.
        const firstIso     = allSlots[0]?.startDate?.split('T')[0] ?? null;
        const sameDaySlots = firstIso ? _onDate(allSlots, firstIso) : [];
        const otherSlots   = firstIso ? allSlots.filter(s => !s.startDate?.startsWith(firstIso)) : allSlots;
        console.log(`📋 [SLOTS] Base: no preferences — earliest-date diverse pick (date=${firstIso})`);
        slotsToAnnounce = _dedup([..._diversePick(sameDaySlots), ...otherSlots]);

      } else if (!locationPreferenceGiven) {
        // Case 1: Date only (no location) — all centres on preferred date (diverse), fill by proximity.
        const sameDateAll = selectedIso ? _onDate(allSlots, selectedIso) : [];
        const otherSlots  = _byProximity(
          allSlots.filter(s => !s.startDate?.startsWith(selectedIso ?? '\0')),
          selDateMs
        );
        console.log(`📋 [SLOTS] Case 1: date-only (${selectedIso}) — all-centre diverse + proximity fill`);
        slotsToAnnounce = _dedup([..._diversePick(sameDateAll), ...otherSlots]);

      } else if (locationMatchedForSelectedSlot) {
        // Case 2: Date + location matched — same-centre same-date first, then proximity.
        const centreSel  = _centre(selectedSlot.location);
        const selKey     = _slotKey(selectedSlot);
        const sameCentreAll = allSlots.filter(s => {
          const c = _centre(s.location);
          return c && centreSel && c.toLowerCase() === centreSel.toLowerCase();
        });
        const sameDateSC = sameCentreAll.filter(
          s => s.startDate?.startsWith(selectedIso ?? '\0') && _slotKey(s) !== selKey
        );
        const otherSC    = _byProximity(
          sameCentreAll.filter(s => !s.startDate?.startsWith(selectedIso ?? '\0')),
          selDateMs
        );
        console.log(`📋 [SLOTS] Case 2: date+location matched (centre=${centreSel}, date=${selectedIso}) — same-centre fill`);
        slotsToAnnounce = _dedup([selectedSlot, ...sameDateSC, ...otherSC]);

      } else {
        // Case 3: Date + location, preferred location unavailable on that date —
        // diverse same-date slots (all centres), fill with preferred-centre proximity.
        const prefCentre   = _centre(preferences.location);
        const sameDateAll  = selectedIso ? _onDate(allSlots, selectedIso) : [];
        const prefLocSlots = allSlots.filter(s => {
          const c = _centre(s.location);
          return c && prefCentre && c.toLowerCase() === prefCentre.toLowerCase();
        });
        const prefLocFill  = _byProximity(
          prefLocSlots.filter(s => !s.startDate?.startsWith(selectedIso ?? '\0')),
          selDateMs
        );
        console.log(`📋 [SLOTS] Case 3: date+location fallback (prefCentre=${prefCentre}, date=${selectedIso}) — all-centre same-date + pref-centre proximity fill`);
        slotsToAnnounce = _dedup([..._diversePick(sameDateAll), ...prefLocFill]);
      }

      // ── Soft instructor sort ────────────────────────────────────────────
      // If instructor preference given, float matching-instructor slots to top
      // without excluding non-matching ones (instructor availability is sparse).
      if (preferences.instructor && slotsToAnnounce.length > 1) {
        const prefInst = normalizeInstructor(preferences.instructor);
        slotsToAnnounce.sort((a, b) => {
          const aMatch = normalizeInstructor(a.instructor) === prefInst ? 0 : 1;
          const bMatch = normalizeInstructor(b.instructor) === prefInst ? 0 : 1;
          return aMatch - bMatch;
        });
      }

      // When caller asked for a specific centre + instructor but the instructor only appears elsewhere,
      // ensure at least one "other centre" match appears in the shortlist so the model does not imply wrong attribution.
      if (instructorLocationMeta.instructorAwayFromPreferredCentre && instructorLocationMeta.instructorSlotsOtherCentres[0]) {
        const away = instructorLocationMeta.instructorSlotsOtherCentres[0];
        const seenK = new Set(slotsToAnnounce.map(_slotKey));
        if (!seenK.has(_slotKey(away))) {
          slotsToAnnounce = _dedup([away, ...slotsToAnnounce], 3);
          console.log('📋 [SLOTS] Prepended instructor match at alternate centre for voice clarity');
        }
      }

      // Instructor + no location preference: spoken shortlist prefers that instructor (up to 3, centre-diverse),
      // then fills with other instructors only if fewer than 3 matches (tool message clarifies).
      const instPrefAnnounce = String(preferences.instructor || '').trim();
      const applyInstructorFirstShortlist =
        instPrefAnnounce &&
        !locationPreferenceGiven &&
        instructorLocationMeta.anyInstructorMatch &&
        !instructorLocationMeta.instructorAwayFromPreferredCentre &&
        !instructorLocationMeta.suggestInstructorSpellingConfirmation &&
        !noSlotsInDateFilter &&
        hasPreferences &&
        selectedSlot &&
        candidateSlots.length > 0;

      if (applyInstructorFirstShortlist) {
        const built = buildInstructorPriorityShortlist(candidateSlots, preferences.instructor, selDateMs, 3);
        if (built.slots.length > 0) {
          slotsToAnnounce = built.slots;
          announceIncludesNonPreferredInstructor = built.includesOtherInstructors;
          console.log(
            `📋 [SLOTS] Instructor-first shortlist (no location pref): ${built.slots.length} slot(s), includesOtherInstructors=${built.includesOtherInstructors}`
          );
        }
      }

      // ── Final safety fallback ───────────────────────────────────────────
      if (slotsToAnnounce.length === 0 && candidateSlots.length > 0) {
        slotsToAnnounce = _dedup(selectedSlot ? [selectedSlot, ...candidateSlots] : candidateSlots);
      }
    }

    return {
      allSlots,
      selectedSlot: selectedSlot ?? null,
      monthYear: returnMonthYear,
      slotsToAnnounce,
      announceIncludesNonPreferredInstructor,
      noSlotsInDateFilter,
      dateFilterSummary: dateFilterSummary || null,
      instructorLocationMeta
    };

  } catch (error) {
    console.error(`❌ [AVAILABILITY] Error checking availability for ${courseType}:`, error);
    throw new Error(`Failed to check availability for ${courseType}: ${error.message}`);
  }
}

/**
 * Select the best matching slot based on caller preferences
 * @param {Array} allSlots - Array of available slots
 * @param {Object} preferences - Caller preferences {preferredDate, preferredTime, location, instructor}
 * @returns {Object} - Best matching slot
 */
export function selectBestMatchingSlot(allSlots, preferences = {}) {
  if (!allSlots || allSlots.length === 0) {
    throw new Error('No slots available to select from');
  }

  const { preferredDate, preferredTime, location, instructor } = preferences;

  // P2 FIX A2: Strict Location Filtering
  // Use extractLocationIdentifier (city name or postcode) so "Dagenham" matches slots with "Dagenham" or "RM9" in address
  let filteredSlots = allSlots;
  if (location) {
    const prefId = extractLocationIdentifier(location);
    const prefCentre = normaliseToCentreName(prefId);
    const locationMatches = allSlots.filter(slot => {
      const slotId = extractLocationIdentifier(slot.location);
      const slotCentre = normaliseToCentreName(slotId);
      return prefCentre && slotCentre && prefCentre.toLowerCase() === slotCentre.toLowerCase();
    });

    if (locationMatches.length > 0) {
      console.log(`📍 [AVAILABILITY] Filtering by location: "${location}" (${locationMatches.length} slots matching)`);
      filteredSlots = locationMatches;
    } else {
      console.log(`📍 [AVAILABILITY] No strict location match for "${location}", using all slots (best effort)`);
    }
  }

  const dateIntent = preferences._availabilityDateIntent;
  const hasActiveDateIntent = dateIntent && dateIntent.type !== 'none';
  const hasInstructorPref = !!(instructor && String(instructor).trim());

  // If no preferences provided, return null to indicate user should choose
  // According to documentation: "Feel free to discuss with the client the availability"
  // Instructor alone counts (must match hasPreferences in checkAvailabilityAndNoteDetails).
  if (!preferredDate && !preferredTime && !location && !hasActiveDateIntent && !hasInstructorPref) {
    console.log('📋 No preferences provided - returning null to indicate user selection needed');
    return null; // Changed from allSlots[0] - don't auto-select
  }

  // When strict location matches exist, score only within that pool (not other centres).
  const slotsToScore = filteredSlots;

  // Score each slot based on how well it matches preferences
  const scoredSlots = slotsToScore.map(slot => {
    let score = 0;
    let matchDetails = [];

    // Match date preference (exact or partial)
    if (preferredDate) {
      const slotDateStr = slot.startDate || slot.date;
      const preferredDateStr = normalizeDate(preferredDate);

      if (slotDateStr && preferredDateStr) {
        // Try exact match first
        if (slotDateStr === preferredDateStr || slotDateStr.includes(preferredDateStr) || preferredDateStr.includes(slotDateStr)) {
          score += 10;
          matchDetails.push('date');
        } else {
          // Check if dates are close (within 7 days)
          const daysDiff = getDaysDifference(slotDateStr, preferredDateStr);
          if (daysDiff !== null && daysDiff <= 7) {
            score += Math.max(0, 10 - daysDiff); // Closer dates get higher score
            matchDetails.push(`date-close-${daysDiff}days`);
          }
        }
      }
    }

    // Match time preference
    if (preferredTime) {
      const slotTime = normalizeTime(slot.time);
      const preferredTimeNorm = normalizeTime(preferredTime);

      if (slotTime && preferredTimeNorm) {
        if (slotTime === preferredTimeNorm) {
          score += 8;
          matchDetails.push('time-exact');
        } else {
          // Check if times are close (within 2 hours)
          const timeDiff = getTimeDifference(slotTime, preferredTimeNorm);
          if (timeDiff !== null && timeDiff <= 120) { // 120 minutes = 2 hours
            score += Math.max(0, 8 - (timeDiff / 15)); // Closer times get higher score
            matchDetails.push(`time-close-${timeDiff}min`);
          }
        }
      }
    }

    // Match location preference (same identifier logic as filter above)
    if (location) {
      const prefId = extractLocationIdentifier(location);
      const slotId = extractLocationIdentifier(slot.location);
      const prefCentre = normaliseToCentreName(prefId);
      const slotCentre = normaliseToCentreName(slotId);

      if (prefCentre && slotCentre && prefCentre.toLowerCase() === slotCentre.toLowerCase()) {
        score += 6;
        matchDetails.push('location');
      }
    }

    // Match instructor preference
    if (instructor) {
      const slotInstructor = normalizeInstructor(slot.instructor);
      const preferredInstructor = normalizeInstructor(instructor);

      if (slotInstructor && preferredInstructor) {
        if (slotInstructor === preferredInstructor || slotInstructor.includes(preferredInstructor) || preferredInstructor.includes(slotInstructor)) {
          score += 6;
          matchDetails.push('instructor');
        }
      }
    }

    return {
      slot,
      score,
      matchDetails
    };
  });

  // Sort by score (highest first), then by date/time (earliest first)
  scoredSlots.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // If scores are equal, prefer earlier dates/times
    const aDate = a.slot.startDate || a.slot.date;
    const bDate = b.slot.startDate || b.slot.date;
    if (aDate && bDate) {
      return new Date(aDate) - new Date(bDate);
    }
    return 0;
  });

  const bestMatch = scoredSlots[0];

  if (bestMatch.score > 0) {
    console.log(`✅ Found matching slot with score ${bestMatch.score} (matches: ${bestMatch.matchDetails.join(', ')})`);
  } else {
    console.log(`⚠️ No matching slot found based on preferences, using first available slot`);
  }

  return bestMatch.slot;
}

/**
 * Normalize date string to YYYY-MM-DD for comparison and selectors
 * @param {string} dateStr - Date string in various formats
 * @returns {string|null} - YYYY-MM-DD or null
 */
function normalizeDateToYYYYMMDD(dateStr) {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  } catch (e) { /* ignore */ }
  return null;
}

/**
 * Normalize date string for comparison
 * @param {string} dateStr - Date string in various formats
 * @returns {string} - Normalized date string (YYYY-MM-DD format if possible)
 */
function normalizeDate(dateStr) {
  const ymd = normalizeDateToYYYYMMDD(dateStr);
  if (ymd) return ymd;
  return dateStr ? dateStr.toLowerCase().trim() : null;
}

/**
 * Normalize time string for comparison
 * @param {string} timeStr - Time string (e.g., "09:00", "9:00 AM", "17:00")
 * @returns {string} - Normalized time string (HH:MM format)
 */
function normalizeTime(timeStr) {
  if (!timeStr) return null;

  // Remove common time suffixes and whitespace
  let normalized = timeStr.toLowerCase().trim();
  normalized = normalized.replace(/\s*(am|pm)\s*/gi, '');

  // Try to parse as time
  try {
    // Handle formats like "9:00", "09:00", "17:00"
    const parts = normalized.split(':');
    if (parts.length === 2) {
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      if (!isNaN(hours) && !isNaN(minutes)) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }
    }
  } catch (e) {
    // Continue with original string
  }

  return normalized;
}

/**
 * Parse date from slot string like "Tue 16th" by combining with month/year context
 * @param {string} dateStr - Date string like "Tue 16th"
 * @param {string} monthYearContext - Month/year context like "December 2025"
 * @returns {Date|null} - Parsed date or null
 */
function parseDateFromSlotString(dateStr, monthYearContext) {
  if (!dateStr) return null;

  try {
    // Extract day number from strings like "Tue 16th" or "16th"
    const dayMatch = dateStr.match(/(\d+)/);
    if (!dayMatch) return null;

    const day = parseInt(dayMatch[1]);

    // Parse month/year from context like "December 2025"
    let year = new Date().getFullYear();
    let month = new Date().getMonth();

    if (monthYearContext) {
      const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'];
      const contextLower = monthYearContext.toLowerCase();

      // Find month name in context
      for (let i = 0; i < monthNames.length; i++) {
        if (contextLower.includes(monthNames[i])) {
          month = i;
          break;
        }
      }

      // Extract year from context
      const yearMatch = monthYearContext.match(/(\d{4})/);
      if (yearMatch) {
        year = parseInt(yearMatch[1]);
      }
    }

    // Create date
    const date = new Date(year, month, day);

    // Validate the date is correct (handles month overflow)
    if (date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
      return date;
    }

    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Normalize location string for comparison
 * @param {string} locationStr - Location string
 * @returns {string} - Normalized location string
 */
function normalizeLocation(locationStr) {
  if (!locationStr) return null;

  // Convert to lowercase and remove common variations
  let normalized = locationStr.toLowerCase().trim();

  // Remove common suffixes like "HA0 4LR", postcodes, etc.
  normalized = normalized.replace(/\s*\([^)]*\)\s*/g, ''); // Remove text in parentheses
  normalized = normalized.replace(/\s*[A-Z]{1,2}\d{1,2}\s*\d[A-Z]{2}\s*/gi, ''); // Remove UK postcodes

  return normalized.trim();
}

/** Common STT / spelling variants → canonical first-name token for matching */
const INSTRUCTOR_NAME_CANONICAL = {
  shawn: 'sean',
  sean: 'sean'
};

/**
 * Normalize instructor name for comparison
 * @param {string} instructor - Instructor name
 * @returns {string|null} - Normalized instructor name
 */
function normalizeInstructor(instructor) {
  if (!instructor) return null;
  const first = instructor.toLowerCase().trim().split(' ')[0];
  return INSTRUCTOR_NAME_CANONICAL[first] || first;
}

const INSTRUCTOR_META_CAP = 5;

function slotMatchesInstructorPref(slot, preferredInstructor) {
  if (!preferredInstructor || !String(preferredInstructor).trim()) return false;
  const slotInstructor = normalizeInstructor(slot.instructor);
  const preferred = normalizeInstructor(preferredInstructor);
  if (!slotInstructor || !preferred) return false;
  return (
    slotInstructor === preferred ||
    slotInstructor.includes(preferred) ||
    preferred.includes(slotInstructor)
  );
}

/**
 * Up to `cap` slots for voice: matching instructor first (centre-diverse), then proximity fill from the rest.
 * @returns {{ slots: object[], includesOtherInstructors: boolean }}
 */
export function buildInstructorPriorityShortlist(candidateSlots, preferredInstructor, selDateMs, cap = 3) {
  if (!Array.isArray(candidateSlots) || candidateSlots.length === 0) {
    return { slots: [], includesOtherInstructors: false };
  }
  if (!String(preferredInstructor || '').trim()) {
    return { slots: [], includesOtherInstructors: false };
  }
  const matchingPool = candidateSlots.filter(s => slotMatchesInstructorPref(s, preferredInstructor));
  if (matchingPool.length === 0) {
    return { slots: [], includesOtherInstructors: false };
  }

  const _slotKey = (s) => `${s.date}|${s.time}|${String(s.location || '').slice(0, 160)}`;
  const _centre = (loc) => normaliseToCentreName(extractLocationIdentifier(loc || ''));

  const _dedup = (ordered, c = cap) => {
    const seen = new Set();
    const out = [];
    for (const s of ordered) {
      const k = _slotKey(s);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(s);
      }
      if (out.length >= c) break;
    }
    return out;
  };

  const _diversePick = (slots, c = cap) => {
    const seen = new Set();
    const seenCentres = new Set();
    const first = [];
    const rest = [];
    for (const s of slots) {
      const k = _slotKey(s);
      if (seen.has(k)) continue;
      seen.add(k);
      const centre = _centre(s.location) || 'unknown';
      if (!seenCentres.has(centre)) {
        seenCentres.add(centre);
        first.push(s);
      } else {
        rest.push(s);
      }
    }
    return [...first, ...rest].slice(0, c);
  };

  const _byProximity = (slots, refMs) => {
    if (refMs == null) return [...slots];
    return [...slots].sort((a, b) => {
      const aMs = a.startDate ? new Date(a.startDate).getTime() : Infinity;
      const bMs = b.startDate ? new Date(b.startDate).getTime() : Infinity;
      return Math.abs(aMs - refMs) - Math.abs(bMs - refMs);
    });
  };

  let primary = _dedup(_diversePick(matchingPool, cap), cap);
  if (primary.length < cap) {
    const others = candidateSlots.filter(s => !slotMatchesInstructorPref(s, preferredInstructor));
    primary = _dedup([...primary, ..._byProximity(others, selDateMs)], cap);
  }
  const includesOtherInstructors = primary.some(s => !slotMatchesInstructorPref(s, preferredInstructor));
  return { slots: primary, includesOtherInstructors };
}

function slotCentreMatchesPreference(slotLoc, prefLocation) {
  const pref = normaliseToCentreName(extractLocationIdentifier(prefLocation || ''));
  const c = normaliseToCentreName(extractLocationIdentifier(slotLoc || ''));
  return !!(pref && c && pref.toLowerCase() === c.toLowerCase());
}

/**
 * Cross-check instructor vs location over the date-filtered slot pool (for voice messaging and tests).
 * @param {object[]} candidateSlots
 * @param {{ instructor?: string, location?: string }} preferences
 */
export function computeInstructorAvailabilityMeta(candidateSlots, preferences = {}) {
  const instructorPreferenceGiven = !!(preferences.instructor && String(preferences.instructor).trim());
  const locationPreferenceGiven = !!(preferences.location && String(preferences.location).trim());
  const prefCentre = locationPreferenceGiven
    ? normaliseToCentreName(extractLocationIdentifier(preferences.location))
    : null;

  const matchesAtPreferred = [];
  const instructorOtherCentres = [];
  const preferredCentreOtherInstructors = [];

  let anyInstructorMatch = false;

  for (const slot of candidateSlots || []) {
    if (instructorPreferenceGiven && slotMatchesInstructorPref(slot, preferences.instructor)) {
      anyInstructorMatch = true;
      if (locationPreferenceGiven && prefCentre) {
        if (slotCentreMatchesPreference(slot.location, preferences.location)) {
          matchesAtPreferred.push(slot);
        } else {
          instructorOtherCentres.push(slot);
        }
      }
    }
    if (
      instructorPreferenceGiven &&
      locationPreferenceGiven &&
      prefCentre &&
      slotCentreMatchesPreference(slot.location, preferences.location) &&
      !slotMatchesInstructorPref(slot, preferences.instructor)
    ) {
      preferredCentreOtherInstructors.push(slot);
    }
  }

  const dedupKey = (s) => `${s.date}|${s.time}|${String(s.location || '').slice(0, 160)}`;
  const takeDedup = (arr, cap) => {
    const seen = new Set();
    const out = [];
    for (const s of arr) {
      const k = dedupKey(s);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(s);
      if (out.length >= cap) break;
    }
    return out;
  };

  const instructorMatchAtPreferredLocation = matchesAtPreferred.length > 0;
  const instructorSlotsOtherCentres = takeDedup(instructorOtherCentres, INSTRUCTOR_META_CAP);
  const preferredCentreSlotsOtherInstructors = takeDedup(preferredCentreOtherInstructors, INSTRUCTOR_META_CAP);

  const instructorAwayFromPreferredCentre =
    instructorPreferenceGiven &&
    locationPreferenceGiven &&
    !instructorMatchAtPreferredLocation &&
    instructorSlotsOtherCentres.length > 0;

  const instructorRequestedButNoSlotMatch = instructorPreferenceGiven && !anyInstructorMatch;
  /** True when the table has rows but none match the requested instructor—often STT/spelling (e.g. Sean vs Shaun). */
  const suggestInstructorSpellingConfirmation =
    instructorRequestedButNoSlotMatch &&
    Array.isArray(candidateSlots) &&
    candidateSlots.length > 0;

  return {
    instructorPreferenceGiven,
    locationPreferenceGiven,
    preferredCentreLabel: prefCentre,
    instructorMatchAtPreferredLocation,
    instructorSlotsOtherCentres,
    preferredCentreSlotsOtherInstructors,
    instructorAwayFromPreferredCentre,
    instructorRequestedButNoSlotMatch,
    suggestInstructorSpellingConfirmation,
    anyInstructorMatch,
    _spellingInstructorRaw: suggestInstructorSpellingConfirmation ? String(preferences.instructor || '').trim() : undefined
  };
}

/**
 * Get difference in days between two date strings
 * @param {string} dateStr1 - First date string
 * @param {string} dateStr2 - Second date string
 * @returns {number|null} - Days difference, or null if cannot calculate
 */
function getDaysDifference(dateStr1, dateStr2) {
  try {
    const date1 = new Date(dateStr1);
    const date2 = new Date(dateStr2);

    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) {
      return null;
    }

    const diffMs = Math.abs(date1 - date2);
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  } catch (e) {
    return null;
  }
}

/**
 * Get difference in minutes between two time strings
 * @param {string} timeStr1 - First time string (HH:MM format)
 * @param {string} timeStr2 - Second time string (HH:MM format)
 * @returns {number|null} - Minutes difference, or null if cannot calculate
 */
function getTimeDifference(timeStr1, timeStr2) {
  try {
    const [h1, m1] = timeStr1.split(':').map(Number);
    const [h2, m2] = timeStr2.split(':').map(Number);

    if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) {
      return null;
    }

    const minutes1 = h1 * 60 + m1;
    const minutes2 = h2 * 60 + m2;

    return Math.abs(minutes1 - minutes2);
  } catch (e) {
    return null;
  }
}

/**
 * Get availability URL for a course type
 * @param {string} courseType - Course type
 * @returns {string|null} Availability URL or null if not found
 */
export function getAvailabilityUrl(courseType) {
  return AVAILABILITY_URLS[courseType] || null;
}

