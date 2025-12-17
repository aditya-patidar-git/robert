import fs from 'fs';
import path from 'path';

/**
 * Take a screenshot of the current page
 * @param {Page} page - Playwright page object
 * @param {string} filename - Screenshot filename
 * @param {string} screenshotsDir - Directory to save screenshots
 * @returns {Promise<string|null>} Path to screenshot or null on error
 */
export async function takeScreenshot(page, filename, screenshotsDir) {
  try {
    // Ensure directory exists
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(screenshotsDir, `${timestamp}_${filename}`);
    await page.screenshot({ 
      path: screenshotPath, 
      fullPage: true 
    });
    console.log(`📸 Screenshot saved: ${filename}`);
    return screenshotPath;
  } catch (error) {
    console.error('Screenshot error:', error);
    return null;
  }
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
    console.log(`📍 Postcode extracted: "${postcodePrefix}"`);
    return postcodePrefix;
  }
  
  // Step 2: Try to match known city names (all 7 training centres)
  // Priority order: check city names to avoid partial word matches
  const cityNames = ['Edgware', 'Hoddesdon', 'Alperton', 'Croydon', 'Dagenham', 'Eltham', 'Wimbledon'];
  
  for (const city of cityNames) {
    // Use word boundary to avoid matching partial words (e.g., "Barnet" containing "Barn")
    const cityRegex = new RegExp(`\\b${city}\\b`, 'i');
    if (cityRegex.test(locationText)) {
      console.log(`📍 City name extracted: "${city}"`);
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
      console.log(`📍 Fallback word extracted: "${word}"`);
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

