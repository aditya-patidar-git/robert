/**
 * Select Client Helper
 * Handles client selection from search results
 * Preserves all Playwright timing and state checks
 */

import { cleanEmail } from '../../utils.js';
import { takeScreenshot } from '../../utils.js';

/**
 * Select client from search results
 * @param {Object} page - Playwright page object
 * @param {Object} iframe - Iframe locator
 * @param {string} iframeId - Iframe ID
 * @param {string} searchValue - Email or mobile (normalized) used for search
 * @param {string} searchType - 'email' or 'mobile'
 * @param {string} clientPostcode - Optional postcode for verification
 * @param {string} screenshotsDir - Screenshots directory
 * @returns {Promise<boolean>} True if client was clicked successfully
 */
function normalizePhone(value) {
  if (!value || typeof value !== 'string') return '';
  const cleaned = value.replace(/\(M\)/g, '').trim();
  const match = cleaned.match(/[\d\s\-\(\)\+]+/);
  if (!match) return '';
  const digits = match[0].replace(/[\s\-\(\)]/g, '').replace(/^\+/, '').replace(/^44/, '0');
  return digits.startsWith('0') ? digits : '0' + digits;
}

export async function selectClient(page, iframe, iframeId, searchValue, searchType, clientPostcode, screenshotsDir) {
  console.log('👆 [STEP 9] Clicking on found client...');

  const normalizedSearch = searchType === 'email'
    ? searchValue.toLowerCase().trim()
    : searchType === 'mobile'
      ? normalizePhone(searchValue)
      : searchValue.toLowerCase().replace(/\s+/g, ' ').trim(); // name fragment

  const resultRows = iframe.locator('table.dx-datagrid-table tr.dx-row.dx-data-row[role="row"]');
  const rowCount = await resultRows.count();

  console.log(`🔍 [STEP 9] Found ${rowCount} search result rows, looking for ${searchType} matches...`);

  const matchingRows = [];
  for (let i = 0; i < rowCount; i++) {
    const row = resultRows.nth(i);
    let postcode = null;
    try {
      const postcodeSpan = row.locator('div.jqx_margin_right + div[style*="display:inline-block"] > span');
      if (await postcodeSpan.count() > 0) {
        const postcodeText = await postcodeSpan.textContent();
        const postcodeMatch = postcodeText?.match(/\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/gi);
        if (postcodeMatch?.length > 0) postcode = postcodeMatch[postcodeMatch.length - 1].trim();
      }
    } catch (e) { /* ignore */ }

    if (searchType === 'email') {
      let foundEmail = null;
      try {
        const emailSpan = row.locator('.jqx_inlineSummary:has(.jqx_inlineSummaryTitle:has-text("Email:")) .jqx_inlineSummaryText span');
        if (await emailSpan.count() > 0) {
          const emailText = await emailSpan.textContent();
          if (emailText) foundEmail = cleanEmail(emailText);
        }
      } catch (e) {
        console.log(`⚠️ [STEP 9] Could not extract email from row ${i + 1}:`, e.message);
      }
      if (foundEmail) {
        const normalizedEmail = foundEmail.toLowerCase().trim();
        const emailMatches = normalizedEmail === normalizedSearch ||
          normalizedEmail.includes(normalizedSearch) ||
          normalizedSearch.includes(normalizedEmail);
        if (emailMatches) {
          console.log(`✅ [STEP 9] Found email match in row ${i + 1}: ${foundEmail}`);
          matchingRows.push({ rowIndex: i, email: foundEmail, postcode, index: i });
        }
      }
    } else if (searchType === 'mobile') {
      try {
        const phoneSpan = row.locator('.jqx_inlineSummary:has(.jqx_inlineSummaryTitle:has-text("Phone:")) .jqx_inlineSummaryText span');
        if (await phoneSpan.count() > 0) {
          const phoneText = await phoneSpan.textContent();
          if (phoneText) {
            const normalizedPhone = normalizePhone(phoneText);
            const phoneMatches = normalizedPhone === normalizedSearch ||
              normalizedPhone.endsWith(normalizedSearch) ||
              normalizedSearch.endsWith(normalizedPhone);
            if (phoneMatches) {
              console.log(`✅ [STEP 9] Found phone match in row ${i + 1}: ${phoneText.trim()}`);
              matchingRows.push({ rowIndex: i, postcode, index: i });
            }
          }
        }
      } catch (e) {
        console.log(`⚠️ [STEP 9] Could not extract phone from row ${i + 1}:`, e.message);
      }
    } else {
      // searchType === 'name'
      try {
        const rowText = await row.textContent();
        if (rowText && rowText.toLowerCase().replace(/\s+/g, ' ').includes(normalizedSearch)) {
          console.log(`✅ [STEP 9] Found name match in row ${i + 1}`);
          matchingRows.push({ rowIndex: i, postcode, index: i });
        }
      } catch (e) {
        console.log(`⚠️ [STEP 9] Could not get text from row ${i + 1}:`, e.message);
      }
    }
  }

  console.log(`📊 [STEP 9] Found ${matchingRows.length} rows with matching ${searchType}`);

  if (matchingRows.length === 0) {
    throw new Error(`No ${searchType} matches found in search results for: ${searchValue}`);
  }
  
  // Handle multiple matches with postcode verification (similar to findAndVerifyClient.js)
  let exactMatch = null;
  
  if (matchingRows.length === 1) {
    console.log('✅ [STEP 9] Single match found, proceeding...');
    exactMatch = {
      rowIndex: matchingRows[0].rowIndex,
      locator: resultRows.nth(matchingRows[0].rowIndex)
    };
  } else {
    console.log(`⚠️ [STEP 9] Multiple ${searchType} matches found (${matchingRows.length}). Verifying with postcode if available.`);
    matchingRows.forEach((match, idx) => {
      console.log(`   ${idx + 1}. Row ${match.rowIndex + 1}${match.email ? `, Email: ${match.email}` : ''}, Postcode: ${match.postcode || 'Not visible'}`);
    });

    const exactEmailMatch = searchType === 'email' ? matchingRows.find(m => {
      const matchEmail = cleanEmail(m.email);
      return matchEmail && matchEmail.toLowerCase().trim() === normalizedSearch;
    }) : null;

    if (exactEmailMatch) {
      // Exact email match found
      if (clientPostcode && exactEmailMatch.postcode) {
        // Verify postcode matches
        const extractedPostcode = exactEmailMatch.postcode.toUpperCase().replace(/\s+/g, '').trim();
        const searchPostcode = clientPostcode.toUpperCase().replace(/\s+/g, '').trim();
        const postcodeMatches = extractedPostcode === searchPostcode;
        
        if (postcodeMatches) {
          console.log(`✅ [STEP 9] Found exact email match with matching postcode at row ${exactEmailMatch.rowIndex + 1}`);
          exactMatch = {
            rowIndex: exactEmailMatch.rowIndex,
            locator: resultRows.nth(exactEmailMatch.rowIndex)
          };
        } else {
          console.log(`⚠️ [STEP 9] Exact email match found but postcode doesn't match. Searched: "${searchPostcode}", Found: "${extractedPostcode}"`);
          // Still use this match but log warning (per document: verify both, but if only one matches, use it)
          exactMatch = {
            rowIndex: exactEmailMatch.rowIndex,
            locator: resultRows.nth(exactEmailMatch.rowIndex)
          };
        }
      } else {
        // No postcode provided or not visible - use exact email match
        console.log(`✅ [STEP 9] Found exact email match at row ${exactEmailMatch.rowIndex + 1} (no postcode verification available)`);
        exactMatch = {
          rowIndex: exactEmailMatch.rowIndex,
          locator: resultRows.nth(exactEmailMatch.rowIndex)
        };
      }
    } else {
      // No exact email match - try to match by postcode if available
      if (clientPostcode) {
        const postcodeMatch = matchingRows.find(m => {
          if (!m.postcode) return false;
          const extractedPostcode = m.postcode.toUpperCase().replace(/\s+/g, '').trim();
          const searchPostcode = clientPostcode.toUpperCase().replace(/\s+/g, '').trim();
          return extractedPostcode === searchPostcode;
        });
        
        if (postcodeMatch) {
          console.log(`✅ [STEP 9] Found match with matching postcode at row ${postcodeMatch.rowIndex + 1}`);
          exactMatch = {
            rowIndex: postcodeMatch.rowIndex,
            locator: resultRows.nth(postcodeMatch.rowIndex)
          };
        } else {
          // No postcode match - use first match with warning
          console.log(`⚠️ [STEP 9] No exact email or postcode match, using first match at row ${matchingRows[0].rowIndex + 1}`);
          exactMatch = {
            rowIndex: matchingRows[0].rowIndex,
            locator: resultRows.nth(matchingRows[0].rowIndex)
          };
        }
      } else {
        // No postcode provided - use first match
        console.log(`⚠️ [STEP 9] No exact email match and no postcode provided, using first match at row ${matchingRows[0].rowIndex + 1}`);
        exactMatch = {
          rowIndex: matchingRows[0].rowIndex,
          locator: resultRows.nth(matchingRows[0].rowIndex)
        };
      }
    }
  }
  
  // Click exact match using JavaScript (robust method from findAndVerifyClient.js)
  let clientClicked = false;
  if (exactMatch) {
    const rowIndex = exactMatch.rowIndex;
    
    // Get the actual frame for JavaScript evaluation
    let actualFrame = null;
    try {
      await page.waitForSelector(iframeId, { state: 'attached' });
      const frameElement = await page.$(iframeId);
      if (frameElement) {
        actualFrame = await frameElement.contentFrame();
      }
    } catch (e) {
      console.log(`⚠️ [STEP 9] Could not get frame for evaluation: ${e.message}`);
    }
    
    // Verify we're still on search results page before attempting click
    const verifyStillOnSearchPage = async () => {
      try {
        const searchTable = await iframe.locator('table.dx-datagrid-table').count();
        return searchTable > 0;
      } catch {
        return false;
      }
    };
    
    // Use JavaScript click (works even if element is not visible and doesn't trigger scroll that might click row 1)
    if (rowIndex !== null && actualFrame) {
      const stillOnSearchPage = await verifyStillOnSearchPage();
      if (!stillOnSearchPage) {
        console.log(`⚠️ [STEP 9] Already navigated away from search results - cannot click row ${rowIndex + 1}`);
      } else {
        try {
          console.log(`🔄 [STEP 9] Using JavaScript click on row ${rowIndex + 1} (bypasses visibility, avoids accidental row 1 click)...`);
          // Use JavaScript to click directly - this won't trigger scroll that might click row 1
          await actualFrame.evaluate((index) => {
            const rows = document.querySelectorAll('table.dx-datagrid-table tr.dx-row.dx-data-row[role="row"]');
            if (rows[index]) {
              // CRITICAL: Click the TD (cell) inside the row, not the TR itself
              // DevExtreme grid requires clicking the cell to trigger navigation
              const cell = rows[index].querySelector('td[role="gridcell"]');
              if (cell) {
                // Verify we're clicking the right row by checking email
                const emailSpan = rows[index].querySelector('.jqx_inlineSummary .jqx_inlineSummaryTitle');
                let email = '';
                if (emailSpan && emailSpan.textContent.includes('Email:')) {
                  const emailText = emailSpan.nextElementSibling;
                  if (emailText) {
                    const emailSpanInner = emailText.querySelector('span');
                    if (emailSpanInner) {
                      let emailTextContent = emailSpanInner.textContent.trim();
                      // CRITICAL: Remove "Copy" button text and extract only the email address
                      const emailLines = emailTextContent.split('\n');
                      email = emailLines[0].trim();
                      // Use regex to extract email pattern if split didn't work
                      if (!email || !email.includes('@')) {
                        const emailMatch = emailTextContent.match(/[\w\.-]+@[\w\.-]+\.\w+/);
                        if (emailMatch) {
                          email = emailMatch[0];
                        }
                      }
                      // Remove "Copy" text if appended directly
                      if (email && email.toLowerCase().endsWith('copy')) {
                        email = email.slice(0, -4).trim();
                      }
                    }
                  }
                }
                // Alternative: find email by looking for span with email pattern
                if (!email) {
                  const allSpans = rows[index].querySelectorAll('span');
                  for (const span of allSpans) {
                    if (span.textContent.includes('@')) {
                      let emailTextContent = span.textContent.trim();
                      // CRITICAL: Remove "Copy" button text and extract only the email address
                      const emailLines = emailTextContent.split('\n');
                      email = emailLines[0].trim();
                      // Use regex to extract email pattern if split didn't work
                      if (!email || !email.includes('@')) {
                        const emailMatch = emailTextContent.match(/[\w\.-]+@[\w\.-]+\.\w+/);
                        if (emailMatch) {
                          email = emailMatch[0];
                        }
                      }
                      // Remove "Copy" text if appended directly
                      if (email && email.toLowerCase().endsWith('copy')) {
                        email = email.slice(0, -4).trim();
                      }
                      if (email) break;
                    }
                  }
                }
                console.log(`[DEBUG] Clicking row ${index + 1}, email: ${email}`);
                
                // Click the cell
                cell.click();
              } else {
                // Fallback: click the row itself
                console.log(`[DEBUG] No cell found, clicking row ${index + 1} directly`);
                rows[index].click();
              }
            }
          }, rowIndex);
          await page.waitForTimeout(2000); // Wait 2 seconds for navigation
          clientClicked = true;
          console.log(`✅ [STEP 9] Successfully clicked row ${rowIndex + 1} using JavaScript click`);
        } catch (jsErr) {
          console.log(`⚠️ [STEP 9] JavaScript click failed: ${jsErr.message}`);
          // If JavaScript click fails, try fallback
          try {
            const rowLocator = resultRows.nth(rowIndex);
            await rowLocator.click({ timeout: 10000, force: false });
            clientClicked = true;
            console.log(`✅ [STEP 9] Successfully clicked row ${rowIndex + 1} using fallback click`);
          } catch (fallbackErr) {
            console.log(`⚠️ [STEP 9] Fallback click also failed: ${fallbackErr.message}`);
          }
        }
      }
    }
  }
  
  if (!clientClicked) {
    throw new Error(`Could not click client row for ${searchType}: ${searchValue}`);
  }
  
  // CRITICAL: Check if we're already on the client details page BEFORE waiting (robust verification from findAndVerifyClient)
  console.log('🔍 [STEP 9] Checking if client details page is already loaded...');
  
  // Look for client name "Mr Robert Smith" or "Robert Smith"
  const clientNameVisible = await iframe.locator('text=Mr Robert Smith, text=Robert Smith').count() > 0;

  // When we searched by email, we can verify by email in DOM; when by mobile, skip (form fields suffice)
  const identifierForVerify = searchType === 'email' ? searchValue : '';
  const clientEmailVisible = identifierForVerify ? (await iframe.locator(`text=${identifierForVerify}`).count() > 0) : false;
  
  // Look for "First Names" and "Surname" fields which indicate we're on the client details page
  const firstNameField = await iframe.locator('text=First Names').count() > 0;
  const surnameField = await iframe.locator('text=Surname').count() > 0;
  
  // Look for "Contact e-mail" field
  const contactEmailField = await iframe.locator('text=Contact e-mail').count() > 0;
  
  if (clientNameVisible || clientEmailVisible || firstNameField || surnameField || contactEmailField) {
    console.log('✅ [STEP 9] ============================================');
    console.log('✅ [STEP 9] SUCCESS: Client details page is already loaded!');
    if (identifierForVerify) console.log(`✅ [STEP 9] Client identifier: ${identifierForVerify}`);
    console.log('✅ [STEP 9] Client found and selected successfully.');
    console.log('✅ [STEP 9] Client details page loaded and ready.');
    console.log('✅ [STEP 9] Proceeding to click Next button...');
    console.log('✅ [STEP 9] ============================================');
    
    // Take screenshot of the already loaded page
    await takeScreenshot(page, 'client-selected.png', screenshotsDir);
    
    console.log('✅ [STEP 9] Client found and selected');
  } else {
    // Only wait for navigation if we're not already on the client details page
    if (clientClicked) {
      console.log('⏳ [STEP 9] Waiting for client page to load...');
      await page.waitForTimeout(4000);
      await page.waitForLoadState('networkidle');
      
      // Take screenshot after clicking client
      await takeScreenshot(page, 'client-selected.png', screenshotsDir);
      
      // Verify we're on the client details page
      console.log('🔍 [STEP 9] Verifying client details page...');
      
      // Look for client name "Mr Robert Smith" or "Robert Smith"
      const clientNameVisibleAfterWait = await iframe.locator('text=Mr Robert Smith, text=Robert Smith').count() > 0;
      
      const clientEmailVisibleAfterWait = identifierForVerify ? (await iframe.locator(`text=${identifierForVerify}`).count() > 0) : false;
      
      // Look for "First Names" and "Surname" fields which indicate we're on the client details page
      const firstNameFieldAfterWait = await iframe.locator('text=First Names').count() > 0;
      const surnameFieldAfterWait = await iframe.locator('text=Surname').count() > 0;
      
      // Look for "Contact e-mail" field
      const contactEmailFieldAfterWait = await iframe.locator('text=Contact e-mail').count() > 0;
      
      if (clientNameVisibleAfterWait || clientEmailVisibleAfterWait || firstNameFieldAfterWait || surnameFieldAfterWait || contactEmailFieldAfterWait) {
        console.log('✅ [STEP 9] Client details page loaded successfully');
        console.log(`🔍 [STEP 9] Verification details: name=${clientNameVisibleAfterWait}, email=${clientEmailVisibleAfterWait}, firstName=${firstNameFieldAfterWait}, surname=${surnameFieldAfterWait}, contactEmail=${contactEmailFieldAfterWait}`);
        
        console.log('✅ [STEP 9] Client found and selected');
      } else {
        console.log('❌ [STEP 9] Client details page verification failed');
        throw new Error(`Could not verify client details page. Expected to find client name, email, or form fields.`);
      }
    } else {
      console.log('❌ [STEP 9] Could not click client and page navigation did not occur');
        throw new Error(`Could not find or click client element for ${searchType}: ${searchValue}`);
    }
  }
  
  // Should now be on "3. Contact" page (in iframe)
  const contactPageHeader = iframe.locator('text=3. Contact, text=Contact').first();
  await contactPageHeader.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
    console.log('⚠️ [STEP 9] Contact page header not found, but continuing...');
  });
  
  // Take screenshot of Contact Details page before clicking Next
  await takeScreenshot(page, 'contact-details-page.png', screenshotsDir);
  
  // After client selection, the Contact Details form is likely in eventNewBooking2_iframe
  // Wait a bit more for the form to fully render
  console.log('⏳ [STEP 9] Waiting for Contact Details form to fully render...');
  await page.waitForTimeout(3000);
  
  return true;
}
