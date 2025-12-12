import { takeScreenshot } from '../utils.js';

/**
 * Extract client details from the CRM contact details page
 * @param {FrameLocator} iframe - Frame locator for the contact details iframe
 * @param {Page} page - Playwright page object
 * @param {string} screenshotsDir - Directory to save screenshots
 * @returns {Promise<{fullName: string, postcode: string, telephoneNumber: string, email: string} | null>}
 */
export async function extractClientDetails(iframe, page, screenshotsDir) {
  try {
    console.log('🔍 [EXTRACT] Extracting client details from CRM page...');
    
    // ========== DEBUGGING: Check iframe state ==========
    console.log('🔍 [DEBUG] Starting comprehensive iframe analysis...');
    
    // 1. Check all iframes on the page
    try {
      const allIframes = await page.locator('iframe').all();
      console.log(`🔍 [DEBUG] Found ${allIframes.length} iframe(s) on the page`);
      for (let i = 0; i < allIframes.length; i++) {
        try {
          const iframeId = await allIframes[i].getAttribute('id');
          const iframeSrc = await allIframes[i].getAttribute('src');
          const iframeName = await allIframes[i].getAttribute('name');
          console.log(`🔍 [DEBUG] Iframe ${i + 1}: id="${iframeId}", name="${iframeName}", src="${iframeSrc?.substring(0, 100)}..."`);
        } catch (e) {
          console.log(`🔍 [DEBUG] Iframe ${i + 1}: Could not get attributes - ${e.message}`);
        }
      }
    } catch (e) {
      console.log(`⚠️ [DEBUG] Could not list iframes: ${e.message}`);
    }
    
    // 2. Check if #contactEdit_iframe exists (where client details load)
    try {
      const contactEditExists = await page.locator('#contactEdit_iframe').count();
      console.log(`🔍 [DEBUG] #contactEdit_iframe exists: ${contactEditExists > 0}`);
      
      if (contactEditExists > 0) {
        const iframeSrc = await page.locator('#contactEdit_iframe').getAttribute('src');
        console.log(`🔍 [DEBUG] #contactEdit_iframe src: ${iframeSrc?.substring(0, 100)}...`);
      }
    } catch (e) {
      console.log(`⚠️ [DEBUG] Could not check #contactEdit_iframe: ${e.message}`);
    }
    
    // Also check contactLookup_iframe for comparison
    try {
      const contactLookupExists = await page.locator('#contactLookup_iframe').count();
      console.log(`🔍 [DEBUG] #contactLookup_iframe exists: ${contactLookupExists > 0}`);
    } catch (e) {
      console.log(`⚠️ [DEBUG] Could not check #contactLookup_iframe: ${e.message}`);
    }
    
    // 3. Try to get actual frame content to see what's in it (check contactEdit_iframe)
    try {
      const frameElement = await page.$('#contactEdit_iframe');
      if (frameElement) {
        const actualFrame = await frameElement.contentFrame();
        if (actualFrame) {
          // Get page title or URL from iframe
          const iframeUrl = actualFrame.url();
          console.log(`🔍 [DEBUG] contactEdit_iframe URL: ${iframeUrl}`);
          
          // Get body text preview
          try {
            const bodyText = await actualFrame.locator('body').textContent();
            const preview = bodyText ? bodyText.substring(0, 300).replace(/\s+/g, ' ') : 'No text content';
            console.log(`🔍 [DEBUG] Iframe body text preview: ${preview}...`);
          } catch (e) {
            console.log(`⚠️ [DEBUG] Could not get iframe body text: ${e.message}`);
          }
          
          // Check for key elements in iframe
          const fullSummaryTable = await actualFrame.locator('#fullSummaryTable').count();
          const jqxFormSummary = await actualFrame.locator('.jqx_formSummary').count();
          const firstNameLabels = await actualFrame.locator('text=First Names').count();
          const surnameLabels = await actualFrame.locator('text=Surname').count();
          const emailLabels = await actualFrame.locator('text=Contact e-mail').count();
          
          console.log(`🔍 [DEBUG] Elements in iframe:`);
          console.log(`   - #fullSummaryTable: ${fullSummaryTable}`);
          console.log(`   - .jqx_formSummary: ${jqxFormSummary}`);
          console.log(`   - text="First Names": ${firstNameLabels}`);
          console.log(`   - text="Surname": ${surnameLabels}`);
          console.log(`   - text="Contact e-mail": ${emailLabels}`);
          
          // Try to find any jqx_formSummaryTextLeft elements
          const allFormLabels = await actualFrame.locator('.jqx_formSummaryTextLeft').count();
          console.log(`   - .jqx_formSummaryTextLeft (total): ${allFormLabels}`);
          
          if (allFormLabels > 0) {
            // Get first few label texts
            const labelTexts = [];
            for (let i = 0; i < Math.min(5, allFormLabels); i++) {
              try {
                const text = await actualFrame.locator('.jqx_formSummaryTextLeft').nth(i).textContent();
                labelTexts.push(text?.trim() || '');
              } catch (e) {
                labelTexts.push('(error)');
              }
            }
            console.log(`   - First 5 label texts: ${labelTexts.join(', ')}`);
          }
        } else {
          console.log('⚠️ [DEBUG] Could not get contentFrame from #contactEdit_iframe');
        }
      } else {
        console.log('⚠️ [DEBUG] #contactEdit_iframe element not found');
      }
    } catch (e) {
      console.log(`⚠️ [DEBUG] Error accessing iframe content: ${e.message}`);
    }
    
    // 4. Check using FrameLocator (the way we're actually using it)
    console.log('🔍 [DEBUG] Checking elements using FrameLocator...');
    try {
      const frameLocatorFirstName = await iframe.locator('.jqx_formSummaryTextLeft:has-text("First Names")').count();
      const frameLocatorSurname = await iframe.locator('.jqx_formSummaryTextLeft:has-text("Surname")').count();
      const frameLocatorEmail = await iframe.locator('.jqx_formSummaryTextLeft:has-text("Contact e-mail")').count();
      const frameLocatorFullSummary = await iframe.locator('#fullSummaryTable').count();
      const frameLocatorAnyLabel = await iframe.locator('.jqx_formSummaryTextLeft').count();
      
      console.log(`🔍 [DEBUG] FrameLocator results:`);
      console.log(`   - .jqx_formSummaryTextLeft:has-text("First Names"): ${frameLocatorFirstName}`);
      console.log(`   - .jqx_formSummaryTextLeft:has-text("Surname"): ${frameLocatorSurname}`);
      console.log(`   - .jqx_formSummaryTextLeft:has-text("Contact e-mail"): ${frameLocatorEmail}`);
      console.log(`   - #fullSummaryTable: ${frameLocatorFullSummary}`);
      console.log(`   - .jqx_formSummaryTextLeft (any): ${frameLocatorAnyLabel}`);
      
      if (frameLocatorAnyLabel > 0) {
        // Get all label texts
        const allLabels = [];
        for (let i = 0; i < Math.min(10, frameLocatorAnyLabel); i++) {
          try {
            const text = await iframe.locator('.jqx_formSummaryTextLeft').nth(i).textContent();
            allLabels.push(text?.trim() || '');
          } catch (e) {
            allLabels.push('(error)');
          }
        }
        console.log(`   - All label texts found: ${allLabels.join(' | ')}`);
      }
    } catch (e) {
      console.log(`⚠️ [DEBUG] Error checking FrameLocator: ${e.message}`);
    }
    
    // 5. Check page URL
    const pageUrl = page.url();
    console.log(`🔍 [DEBUG] Main page URL: ${pageUrl}`);
    
    console.log('🔍 [DEBUG] Iframe analysis complete');
    // ========== END DEBUGGING ==========
    
    // Wait for client details page to be fully loaded
    await page.waitForTimeout(2000);
    
    // Verify we're on the client details page
    const firstNameLabel = await iframe.locator('.jqx_formSummaryTextLeft:has-text("First Names")').count() > 0;
    const surnameLabel = await iframe.locator('.jqx_formSummaryTextLeft:has-text("Surname")').count() > 0;
    const contactEmailLabel = await iframe.locator('.jqx_formSummaryTextLeft:has-text("Contact e-mail")').count() > 0;
    
    console.log(`🔍 [DEBUG] Element detection results: First Names=${firstNameLabel}, Surname=${surnameLabel}, Email=${contactEmailLabel}`);
    
    if (!firstNameLabel && !surnameLabel && !contactEmailLabel) {
      console.log('⚠️ [EXTRACT] Client details page not detected, waiting...');
      await page.waitForTimeout(3000);
      
      // Re-check after waiting
      const firstNameLabel2 = await iframe.locator('.jqx_formSummaryTextLeft:has-text("First Names")').count() > 0;
      const surnameLabel2 = await iframe.locator('.jqx_formSummaryTextLeft:has-text("Surname")').count() > 0;
      const contactEmailLabel2 = await iframe.locator('.jqx_formSummaryTextLeft:has-text("Contact e-mail")').count() > 0;
      console.log(`🔍 [DEBUG] After wait - First Names=${firstNameLabel2}, Surname=${surnameLabel2}, Email=${contactEmailLabel2}`);
    }
    
    await takeScreenshot(page, 'client-details-page.png', screenshotsDir);
    
    // Extract First Names
    let firstNames = '';
    try {
      const firstNameRow = iframe.locator('tr:has(.jqx_formSummaryTextLeft:has-text("First Names"))');
      if (await firstNameRow.count() > 0) {
        const firstNameContainer = firstNameRow.locator('.jqx_formSummaryControlText .jqxInlineContainer');
        if (await firstNameContainer.count() > 0) {
          firstNames = (await firstNameContainer.textContent() || '').trim();
          console.log(`📝 [EXTRACT] Extracted First Names: ${firstNames}`);
        }
      }
    } catch (e) {
      console.log('⚠️ [EXTRACT] Could not extract First Names:', e.message);
    }
    
    // Extract Surname
    let surname = '';
    try {
      const surnameRow = iframe.locator('tr:has(.jqx_formSummaryTextLeft:has-text("Surname"))');
      if (await surnameRow.count() > 0) {
        const surnameContainer = surnameRow.locator('.jqx_formSummaryControlText .jqxInlineContainer');
        if (await surnameContainer.count() > 0) {
          surname = (await surnameContainer.textContent() || '').trim();
          console.log(`📝 [EXTRACT] Extracted Surname: ${surname}`);
        }
      }
    } catch (e) {
      console.log('⚠️ [EXTRACT] Could not extract Surname:', e.message);
    }
    
    // Construct full name
    const fullName = `${firstNames} ${surname}`.trim();
    
    // Extract Contact mobile number
    let telephoneNumber = '';
    try {
      const mobileRow = iframe.locator('tr:has(.jqx_formSummaryTextLeft:has-text("Contact mobile number"))');
      if (await mobileRow.count() > 0) {
        // Try anchor tag first (tel: link), then fallback to direct text
        const mobileContainer = mobileRow.locator('.jqx_formSummaryControlText .jqxInlineContainer');
        if (await mobileContainer.count() > 0) {
          const mobileAnchor = mobileContainer.locator('a[href^="tel:"]');
          if (await mobileAnchor.count() > 0) {
            telephoneNumber = (await mobileAnchor.textContent() || '').trim();
          } else {
            // Fallback to direct text (remove any Copy button text)
            const mobileText = await mobileContainer.textContent() || '';
            telephoneNumber = mobileText.split('\n')[0].trim();
          }
          console.log(`📝 [EXTRACT] Extracted Telephone Number: ${telephoneNumber}`);
        }
      }
    } catch (e) {
      console.log('⚠️ [EXTRACT] Could not extract Telephone Number:', e.message);
    }
    
    // Extract Contact e-mail
    let email = '';
    try {
      const emailRow = iframe.locator('tr:has(.jqx_formSummaryTextLeft:has-text("Contact e-mail"))');
      if (await emailRow.count() > 0) {
        const emailContainer = emailRow.locator('.jqx_formSummaryControlText .jqxInlineContainer');
        if (await emailContainer.count() > 0) {
          // Email is direct text, may have Copy button - extract just the email part
          const emailText = await emailContainer.textContent() || '';
          email = emailText.split('\n')[0].trim(); // Get first line (before Copy button text)
          console.log(`📝 [EXTRACT] Extracted Email: ${email}`);
        }
      }
    } catch (e) {
      console.log('⚠️ [EXTRACT] Could not extract Email:', e.message);
    }
    
    // Extract Postcode from address grid section
    let postcode = '';
    try {
      // Look for address grid section
      const addressGrid = iframe.locator('#addressGrid, .jqx_quickGrid');
      if (await addressGrid.count() > 0) {
        const addressSpan = addressGrid.locator('span').first();
        if (await addressSpan.count() > 0) {
          const addressText = await addressSpan.textContent() || '';
          // Extract UK postcode pattern (e.g., "HA8 6AG" or "NW2 7DS")
          const postcodeMatch = addressText.match(/\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/gi);
          if (postcodeMatch && postcodeMatch.length > 0) {
            // Get the last match (postcode is usually at the end of address)
            postcode = postcodeMatch[postcodeMatch.length - 1].trim();
            console.log(`📝 [EXTRACT] Extracted Postcode: ${postcode}`);
          }
        }
      }
    } catch (e) {
      console.log('⚠️ [EXTRACT] Could not extract Postcode:', e.message);
    }
    
    if (fullName || postcode || telephoneNumber || email) {
      const clientDetails = {
        fullName: fullName || 'Not found',
        postcode: postcode || 'Not found',
        telephoneNumber: telephoneNumber || 'Not found',
        email: email || 'Not found'
      };
      
      console.log('✅ [EXTRACT] Client details extracted successfully');
      return clientDetails;
    }
    
    console.log('⚠️ [EXTRACT] No client details found');
    return null;
  } catch (error) {
    console.error('❌ [EXTRACT] Error extracting client details:', error);
    return null;
  }
}

