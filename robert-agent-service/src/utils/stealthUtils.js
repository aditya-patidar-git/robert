/**
 * Stealth utilities for Playwright browser automation
 * Reduces automation detection and improves reCAPTCHA scores
 */

/**
 * Returns a realistic, up-to-date Chrome user agent string
 * @returns {string} Realistic Chrome user agent
 */
export function getRealisticUserAgent() {
  // Use a recent Chrome user agent on Windows 10
  // Updated to Chrome 120+ for 2024
  return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
}

/**
 * Returns array of Chrome launch arguments to reduce automation detection
 * @returns {string[]} Array of Chrome launch arguments
 */
export function getStealthBrowserArgs() {
  return [
    '--disable-blink-features=AutomationControlled', // Removes automation flag
    '--disable-dev-shm-usage', // Prevents shared memory issues
    '--no-first-run', // Skips first-run dialogs
    '--no-default-browser-check', // Skips default browser check
    '--disable-infobars', // Removes automation info bars
    '--disable-features=IsolateOrigins,site-per-process', // Reduces fingerprinting
    '--disable-setuid-sandbox', // Already present, keeping for compatibility
    '--no-sandbox' // Already present, keeping for compatibility
  ];
}

/**
 * Returns JavaScript code to inject into pages for stealth
 * Removes automation indicators and randomizes fingerprints
 * @returns {string} JavaScript code to inject
 */
export function getStealthInitScript() {
  return `
    (function() {
      // Remove navigator.webdriver flag
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
        configurable: true
      });

      // Override navigator.plugins to return realistic plugin list
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const plugins = [
            {
              0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
              description: 'Portable Document Format',
              filename: 'internal-pdf-viewer',
              length: 1,
              name: 'Chrome PDF Plugin'
            },
            {
              0: { type: 'application/pdf', suffixes: 'pdf', description: '' },
              description: '',
              filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
              length: 1,
              name: 'Chrome PDF Viewer'
            },
            {
              0: { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },
              1: { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable' },
              description: '',
              filename: 'internal-nacl-plugin',
              length: 2,
              name: 'Native Client'
            }
          ];
          plugins.item = function(index) { return this[index] || null; };
          plugins.namedItem = function(name) {
            return this[name] || null;
          };
          return plugins;
        },
        configurable: true
      });

      // Override navigator.languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-GB', 'en', 'en-US'],
        configurable: true
      });

      // Add chrome object with realistic properties
      if (!window.chrome) {
        window.chrome = {};
      }
      window.chrome.runtime = {
        onConnect: undefined,
        onMessage: undefined
      };

      // Randomize Canvas fingerprinting
      const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function(x, y, width, height) {
        const imageData = originalGetImageData.apply(this, [x, y, width, height]);
        // Add minimal random noise (1-2 pixels) to prevent fingerprinting
        const noise = Math.random() * 0.0001; // Very small noise
        for (let i = 0; i < imageData.data.length; i += 4) {
          if (Math.random() < 0.01) { // Only modify 1% of pixels
            imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + (Math.random() - 0.5) * 2));
          }
        }
        return imageData;
      };

      // Randomize WebGL fingerprinting
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
          return 'Intel Inc.';
        }
        if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
          return 'Intel Iris OpenGL Engine';
        }
        return getParameter.call(this, parameter);
      };

      // Override Notification.permission
      Object.defineProperty(Notification, 'permission', {
        get: () => 'default',
        configurable: true
      });

      // Mask automation-related properties
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_JSON;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Object;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Proxy;

      // Override permissions.query to return realistic values
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = function(parameters) {
        return parameters.name === 'notifications' 
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery.apply(this, arguments);
      };

      // Override plugins.length to return realistic value
      Object.defineProperty(navigator, 'pluginLength', {
        get: () => 3,
        configurable: true
      });

      // Add realistic hardwareConcurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8,
        configurable: true
      });

      // Add realistic deviceMemory (if available)
      if ('deviceMemory' in navigator) {
        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => 8,
          configurable: true
        });
      }

      // Override Connection API to return realistic values
      if ('connection' in navigator) {
        Object.defineProperty(navigator, 'connection', {
          get: () => ({
            effectiveType: '4g',
            rtt: 50,
            downlink: 10,
            saveData: false
          }),
          configurable: true
        });
      }

      // Override Battery API
      if ('getBattery' in navigator) {
        const originalGetBattery = navigator.getBattery;
        navigator.getBattery = function() {
          return Promise.resolve({
            charging: true,
            chargingTime: 0,
            dischargingTime: Infinity,
            level: 0.8 + Math.random() * 0.2
          });
        };
      }

      // Add realistic screen properties
      Object.defineProperty(screen, 'availWidth', {
        get: () => 1280,
        configurable: true
      });
      Object.defineProperty(screen, 'availHeight', {
        get: () => 720,
        configurable: true
      });

      // Add realistic touch support
      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => 0,
        configurable: true
      });

      // Override window.chrome to be more realistic
      if (!window.chrome) {
        window.chrome = {};
      }
      window.chrome.loadTimes = function() {
        return {
          commitLoadTime: Date.now() / 1000 - Math.random() * 2,
          connectionInfo: 'http/1.1',
          finishDocumentLoadTime: Date.now() / 1000 - Math.random(),
          finishLoadTime: Date.now() / 1000 - Math.random() * 0.5,
          firstPaintAfterLoadTime: 0,
          firstPaintTime: Date.now() / 1000 - Math.random() * 1.5,
          navigationType: 'Other',
          npnNegotiatedProtocol: 'unknown',
          requestTime: Date.now() / 1000 - Math.random() * 3,
          startLoadTime: Date.now() / 1000 - Math.random() * 2.5,
          wasAlternateProtocolAvailable: false,
          wasFetchedViaSpdy: false,
          wasNpnNegotiated: false
        };
      };

      // Override navigator.getGamepads
      if (navigator.getGamepads) {
        const originalGetGamepads = navigator.getGamepads;
        navigator.getGamepads = function() {
          return [null, null, null, null];
        };
      }

      // Override navigator.mediaDevices to return realistic values
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices;
        navigator.mediaDevices.enumerateDevices = function() {
          return Promise.resolve([
            {
              deviceId: 'default',
              kind: 'audioinput',
              label: 'Default - Microphone',
              groupId: 'group1'
            },
            {
              deviceId: 'default',
              kind: 'audiooutput',
              label: 'Default - Speaker',
              groupId: 'group1'
            }
          ]);
        };
      }

      // Override Date to prevent timing attacks (keep it realistic)
      const originalDate = Date;
      const originalNow = Date.now;
      Date.now = function() {
        return originalNow.apply(originalDate);
      };

      // Add realistic vendor
      Object.defineProperty(navigator, 'vendor', {
        get: () => 'Google Inc.',
        configurable: true
      });

      // Override navigator.doNotTrack
      Object.defineProperty(navigator, 'doNotTrack', {
        get: () => null,
        configurable: true
      });

      // Add realistic platform
      Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32',
        configurable: true
      });
    })();
  `;
}

/**
 * Generates a Bezier curve path for natural mouse movement
 * @param {number} startX - Starting X coordinate
 * @param {number} startY - Starting Y coordinate
 * @param {number} endX - Ending X coordinate
 * @param {number} endY - Ending Y coordinate
 * @param {number} steps - Number of steps in the curve
 * @returns {Array<{x: number, y: number}>} Array of coordinates
 */
export function generateBezierPath(startX, startY, endX, endY, steps = 20) {
  // Control points for natural curve
  const cp1X = startX + (endX - startX) * 0.25 + (Math.random() - 0.5) * 50;
  const cp1Y = startY + (endY - startY) * 0.25 + (Math.random() - 0.5) * 50;
  const cp2X = startX + (endX - startX) * 0.75 + (Math.random() - 0.5) * 50;
  const cp2Y = startY + (endY - startY) * 0.75 + (Math.random() - 0.5) * 50;

  const path = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.pow(1 - t, 3) * startX +
              3 * Math.pow(1 - t, 2) * t * cp1X +
              3 * (1 - t) * Math.pow(t, 2) * cp2X +
              Math.pow(t, 3) * endX;
    const y = Math.pow(1 - t, 3) * startY +
              3 * Math.pow(1 - t, 2) * t * cp1Y +
              3 * (1 - t) * Math.pow(t, 2) * cp2Y +
              Math.pow(t, 3) * endY;
    path.push({ x: Math.round(x), y: Math.round(y) });
  }
  return path;
}

/**
 * Waits for reCAPTCHA to execute and generate a token
 * This gives reCAPTCHA time to analyze user behavior and calculate score
 * @param {Page} page - Playwright page object
 * @param {number} maxWaitTime - Maximum time to wait in milliseconds (default: 5000)
 * @returns {Promise<Object>} Object with ready status and token info
 */
export async function waitForRecaptchaReady(page, maxWaitTime = 5000) {
  try {
    console.log('⏳ Waiting for reCAPTCHA to execute and calculate score...');
    
    // Wait for grecaptcha to be available
    const recaptchaReady = await page.evaluate(async (maxWait) => {
      return new Promise((resolve) => {
        const startTime = Date.now();
        
        const checkRecaptcha = () => {
          if (window.grecaptcha && window.grecaptcha.ready) {
            window.grecaptcha.ready(() => {
              // Check if reCAPTCHA has executed
              const hasRecaptcha = !!(
                document.querySelector('iframe[src*="recaptcha"]') ||
                document.querySelector('.g-recaptcha') ||
                document.querySelector('[data-sitekey]')
              );
              
              // Try to find site key
              const siteKeyElement = document.querySelector('[data-sitekey]') || 
                                   document.querySelector('.g-recaptcha');
              const siteKey = siteKeyElement?.getAttribute('data-sitekey') || null;
              
              resolve({
                ready: true,
                hasRecaptcha: hasRecaptcha,
                siteKey: siteKey,
                timestamp: Date.now()
              });
            });
          } else if (Date.now() - startTime < maxWait) {
            setTimeout(checkRecaptcha, 100);
          } else {
            resolve({
              ready: false,
              hasRecaptcha: false,
              siteKey: null,
              timestamp: Date.now()
            });
          }
        };
        
        checkRecaptcha();
      });
    }, maxWaitTime);
    
    if (recaptchaReady.ready) {
      console.log('✅ reCAPTCHA is ready');
      if (recaptchaReady.hasRecaptcha) {
        console.log('✅ reCAPTCHA elements detected on page');
      }
    } else {
      console.log('⚠️ reCAPTCHA may not be fully ready, but continuing...');
    }
    
    return recaptchaReady;
  } catch (error) {
    console.log(`⚠️ Error checking reCAPTCHA status: ${error.message}`);
    return { ready: false, hasRecaptcha: false, siteKey: null, timestamp: Date.now() };
  }
}

/**
 * Simulates human-like behavior before form submission
 * This includes mouse movements, scrolling, and delays to let reCAPTCHA observe behavior
 * @param {Page} page - Playwright page object
 * @param {Locator} formLocator - Locator for the form element
 * @param {Locator} submitButtonLocator - Locator for the submit button
 */
export async function simulateHumanBehaviorBeforeSubmit(page, formLocator, submitButtonLocator) {
  console.log('🤖 Simulating human-like behavior for reCAPTCHA...');
  
  const viewport = page.viewportSize() || { width: 1280, height: 720 };
  
  // Get form and button bounding boxes
  const formBox = await formLocator.boundingBox().catch(() => null);
  const buttonBox = await submitButtonLocator.boundingBox().catch(() => null);
  
  // 1. Small random scroll to simulate reading
  await page.evaluate(() => {
    window.scrollBy(0, (Math.random() - 0.5) * 100);
  });
  await page.waitForTimeout(500 + Math.random() * 500); // Reduced from 800-2000ms
  
  // 2. Move mouse around the form area (simulate reading/checking)
  if (formBox) {
    const formCenterX = formBox.x + formBox.width / 2;
    const formCenterY = formBox.y + formBox.height / 2;
    
    // Move to form area with natural curve
    const currentPos = { x: viewport.width / 2, y: viewport.height / 2 };
    const formPath = generateBezierPath(
      currentPos.x, currentPos.y,
      formCenterX, formCenterY,
      15
    );
    
    for (const point of formPath) {
      await page.mouse.move(point.x, point.y);
      await page.waitForTimeout(30 + Math.random() * 50);
    }
    
    // Small micro-movements (human jitter)
    for (let i = 0; i < 3; i++) {
      await page.mouse.move(
        formCenterX + (Math.random() * 20 - 10),
        formCenterY + (Math.random() * 20 - 10)
      );
      await page.waitForTimeout(150 + Math.random() * 200);
    }
  }
  
  // 3. Additional wait to let reCAPTCHA observe behavior
  await page.waitForTimeout(1000 + Math.random() * 1000); // Reduced from 2000-4000ms
  
  // 4. Move to submit button with natural curve
  if (buttonBox && formBox) {
    const formCenterX = formBox.x + formBox.width / 2;
    const formCenterY = formBox.y + formBox.height / 2;
    const buttonCenterX = buttonBox.x + buttonBox.width / 2;
    const buttonCenterY = buttonBox.y + buttonBox.height / 2;
    
    const buttonPath = generateBezierPath(
      formCenterX, formCenterY,
      buttonCenterX, buttonCenterY,
      12
    );
    
    for (const point of buttonPath) {
      await page.mouse.move(point.x, point.y);
      await page.waitForTimeout(40 + Math.random() * 60);
    }
    
    // Hover over button with slight movements (human hesitation)
    await page.waitForTimeout(300 + Math.random() * 400);
    await page.mouse.move(
      buttonCenterX + (Math.random() * 5 - 2.5),
      buttonCenterY + (Math.random() * 5 - 2.5)
    );
    await page.waitForTimeout(200 + Math.random() * 300);
  }
  
  console.log('✅ Human-like behavior simulation complete');
}

