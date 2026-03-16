import fs from 'fs';
import path from 'path';

/** Default timeout (ms) for CRM selector waits. Use for waitForSelector/timeout so it can be tuned in one place. */
export const CRM_SELECTOR_TIMEOUT_MS = 10000;

/** Timeout for slow CRM iframe loads (e.g. contact lookup). */
export const CRM_IFRAME_TIMEOUT_MS = 15000;

/** Post-wait stability delay (ms). Tune here if CRM needs a longer buffer; use 100 to minimize step length. */
export const CRM_STABILITY_DELAY_MS = 100;

/** Extra delay (ms) after search results grid is visible so content is fully rendered before we read rows. */
export const CRM_RESULTS_STABILITY_MS = 350;

/**
 * Wait for a selector or locator to be ready, then optionally apply a short stability delay.
 * Use this instead of fixed waitForTimeout after waitForSelector/locator.waitFor to shorten step duration.
 * @param {import('playwright').Page} page - Playwright page (used for waitForSelector and for delay).
 * @param {string|import('playwright').Locator} selectorOrLocator - CSS selector string or Locator.
 * @param {{ state?: 'visible'|'attached', timeout?: number, delayMs?: number }} [options] - state (default 'visible'), timeout (default CRM_SELECTOR_TIMEOUT_MS), delayMs (default CRM_STABILITY_DELAY_MS).
 * @returns {Promise<void>}
 */
export async function waitForThenOptionalDelay(page, selectorOrLocator, options = {}) {
  const { state = 'visible', timeout = CRM_SELECTOR_TIMEOUT_MS, delayMs = CRM_STABILITY_DELAY_MS } = options;
  if (typeof selectorOrLocator === 'string') {
    await page.waitForSelector(selectorOrLocator, { state, timeout });
  } else {
    await selectorOrLocator.waitFor({ state, timeout });
  }
  if (delayMs > 0) {
    await page.waitForTimeout(delayMs);
  }
}

/**
 * Take a screenshot of the current page
 * REMOVED: Screenshots have been disabled to prevent blocking operations and call disconnections
 * @param {Page} page - Playwright page object (unused)
 * @param {string} filename - Screenshot filename (unused)
 * @param {string} screenshotsDir - Directory to save screenshots (unused)
 * @returns {Promise<null>} Always returns null (no-op)
 */
export async function takeScreenshot(page, filename, screenshotsDir) {
  // No-op: Screenshots disabled to prevent blocking operations
    return null;
}

/**
 * Extract location identifier from location text
 * Handles all 7 training centres:
 * - Alperton (HA0 4LR)
 * - Croydon (CR0 4WT)
 * - Edgware (HA8 6AG)
 * - Eltham (SE3 8NB)
 * - Wimbledon (KT3 4PH)
 * - Dagenham (RM9 6XW)
 * - Hoddesdon (EN11 0EH)
 * @param {string} locationText - Location text to parse
 * @returns {string|null} Location identifier or null if not found
 */
export function extractLocationIdentifier(locationText) {
  if (!locationText) return null;
  
  // Step 1: Try to extract UK postcode prefix (format: HA8 6AG, EN11 0EH, etc.)
  // Improved regex to handle all postcode formats: 1-2 letters, 1-2 digits/letters, space, digit, 2 letters
  // Examples: HA0 4LR, CR0 4WT, HA8 6AG, SE3 8NB, KT3 4PH, RM9 6XW, EN11 0EH
  const postcodeRegex = /\b([A-Z]{1,2}[0-9R][0-9A-Z]?)\s+[0-9][A-Z]{2}\b/i;
  const postcodeMatch = locationText.match(postcodeRegex);
  if (postcodeMatch && postcodeMatch[1]) {
    const postcodePrefix = postcodeMatch[1];
    return postcodePrefix;
  }
  
  // Step 2: Try to match known city names (all 7 training centres)
  // Priority order: check city names to avoid partial word matches
  const cityNames = ['Edgware', 'Hoddesdon', 'Alperton', 'Croydon', 'Dagenham', 'Eltham', 'Wimbledon'];
  
  for (const city of cityNames) {
    // Use word boundary to avoid matching partial words (e.g., "Barnet" containing "Barn")
    const cityRegex = new RegExp(`\\b${city}\\b`, 'i');
    if (cityRegex.test(locationText)) {
      return city;
    }
  }
  
  // Step 3: Fallback - extract first significant word after comma
  // Skip common words and words with special characters
  const skipWords = ['universal', 'motorcycle', 'training', 'london', 'the', 'hive', 'barnet', 'fc', 'barn', 'nw', 'north', 'west', 'south', 'east', 'greater'];
  
  // Split by commas and spaces, but handle parentheses properly
  // First, remove parentheses and their contents to avoid "(Barnet FC)" splitting issues
  const cleanedText = locationText.replace(/\([^)]*\)/g, '').trim();
  const words = cleanedText.split(/[,\s]+/)
    .map(w => w.trim())
    .filter(w => w.length > 0)
    .filter(w => {
      // Filter out words that start with special characters
      const firstChar = w[0];
      return /[A-Za-z]/.test(firstChar);
    });
  
  for (const word of words) {
    const wordLower = word.toLowerCase();
    // Return first meaningful word that's not in skip list and is capitalized (likely a city name)
    if (!skipWords.includes(wordLower) && word[0] === word[0].toUpperCase() && word.length > 2) {
      return word;
    }
  }
  
  // Last resort: return first non-empty word (if it exists)
  if (words.length > 0) {
    console.log(`📍 Last resort word extracted: "${words[0]}"`);
    return words[0];
  }
  
  console.log(`⚠️ No location identifier could be extracted from: "${locationText}"`);
  return null;
}

/**
 * Clean email address by removing "Copy" button text and extracting only the email pattern
 * Handles various formats:
 * - "robert@gmail.comCopy" (Copy appended directly)
 * - "robert@gmail.com\nCopy" (Copy on new line)
 * - "robert@gmail.com" (already clean)
 * @param {string} emailText - Raw email text that may contain "Copy" button text
 * @returns {string|null} Cleaned email address or null if invalid
 */
export function cleanEmail(emailText) {
  if (!emailText || typeof emailText !== 'string') {
    return null;
  }

  let cleaned = emailText.trim();

  // Method 1: Split on newline and take first part (Copy button is usually on new line)
  const emailLines = cleaned.split('\n');
  cleaned = emailLines[0].trim();

  // Method 2: Use regex to extract email pattern if split didn't work or if email is malformed
  if (!cleaned || !cleaned.includes('@')) {
    const emailMatch = cleaned.match(/[\w\.-]+@[\w\.-]+\.\w+/);
    if (emailMatch) {
      cleaned = emailMatch[0];
    } else {
      // Try on original text if cleaned version doesn't have email pattern
      const originalMatch = emailText.match(/[\w\.-]+@[\w\.-]+\.\w+/);
      if (originalMatch) {
        cleaned = originalMatch[0];
      } else {
        return null; // No valid email pattern found
      }
    }
  }

  // Method 3: Remove "Copy" text if it's appended directly (e.g., "robert@gmail.comCopy")
  if (cleaned && cleaned.toLowerCase().endsWith('copy')) {
    cleaned = cleaned.slice(0, -4).trim();
  }

  // Final validation: ensure it's a valid email format
  if (!cleaned || !cleaned.includes('@')) {
    return null;
  }

  return cleaned;
}

/**
 * Extract price from booking object
 * @param {Object} booking - Booking object with price field
 * @returns {number|null} Extracted price or null if not found
 */
export function extractPriceFromBooking(booking) {
  // Try to extract price from booking object or use default
  if (booking.price) {
    const match = String(booking.price).match(/[\d,]+\.?\d*/);
    if (match) {
      return parseFloat(match[0].replace(/,/g, ''));
    }
  }
  return null;
}

/**
 * Save audit log to file
 * @param {string} auditId - Audit ID
 * @param {string} action - Action performed
 * @param {Object} result - Result object
 * @param {string} auditDir - Directory to save audit logs
 * @param {string} screenshotsDir - Directory containing screenshots (unused, kept for API compatibility)
 * @returns {Promise<void>}
 */
export async function saveAuditLog(auditId, action, result, auditDir, screenshotsDir) {
  try {
    // Ensure audit directory exists
    if (!fs.existsSync(auditDir)) {
      fs.mkdirSync(auditDir, { recursive: true });
    }

    const auditLog = {
      auditId,
      timestamp: new Date().toISOString(),
      action,
      result
    };
    
    const logPath = path.join(auditDir, `${auditId}.json`);
    fs.writeFileSync(logPath, JSON.stringify(auditLog, null, 2));
    
    console.log(`📝 Audit log saved: ${auditId}`);
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

/**
 * Ensure directories exist
 * @param {string|string[]} directories - Single directory path or array of directory paths
 * @returns {void}
 */
export function ensureDirectories(directories) {
  const dirs = Array.isArray(directories) ? directories : [directories];
  
  for (const dir of dirs) {
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

