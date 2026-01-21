/**
 * Browser State Verification
 * Verifies browser state before and after step execution
 * Preserves all Playwright timing and state checks
 */

/**
 * Verify browser state before step execution
 * @param {Object} page - Playwright page object
 * @param {string} stepName - Step name
 * @param {Object} sessionState - Session state
 */
export async function verifyBrowserStateBefore(page, stepName, sessionState) {
  // Basic checks - can be enhanced with step-specific verification
  if (!page || page.isClosed()) {
    throw new Error('Page is closed or not available');
  }

  // Wait for page to be ready
  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
  } catch (error) {
    console.warn(`⚠️ [STEP_EXECUTOR] Page load timeout for ${stepName}, continuing anyway`);
  }
}

/**
 * Verify browser state after step execution
 * @param {Object} page - Playwright page object
 * @param {string} stepName - Step name
 * @param {Object} result - Step execution result
 */
export async function verifyBrowserStateAfter(page, stepName, result) {
  if (!result.success) {
    // Don't verify state if step failed
    return;
  }

  // Basic check - page should still be open
  if (page.isClosed()) {
    throw new Error(`Page was closed after ${stepName} execution`);
  }
}
