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

      // Enhanced Canvas fingerprinting with improved noise injection
      const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      const originalToBlob = HTMLCanvasElement.prototype.toBlob;
      
      CanvasRenderingContext2D.prototype.getImageData = function(x, y, width, height) {
        const imageData = originalGetImageData.apply(this, [x, y, width, height]);
        // Add subtle random noise to prevent fingerprinting (more sophisticated)
        const noiseLevel = 0.5 + Math.random() * 0.5; // 0.5-1.0
        for (let i = 0; i < imageData.data.length; i += 4) {
          if (Math.random() < 0.015) { // Modify ~1.5% of pixels
            const noise = (Math.random() - 0.5) * noiseLevel;
            imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + noise)); // R
            imageData.data[i + 1] = Math.min(255, Math.max(0, imageData.data[i + 1] + noise)); // G
            imageData.data[i + 2] = Math.min(255, Math.max(0, imageData.data[i + 2] + noise)); // B
            // Alpha channel stays the same
          }
        }
        return imageData;
      };
      
      // Randomize toDataURL and toBlob to prevent canvas fingerprinting
      HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
        const canvas = this;
        const context = canvas.getContext('2d');
        if (context) {
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const tempContext = tempCanvas.getContext('2d');
          tempContext.putImageData(imageData, 0, 0);
          return originalToDataURL.call(tempCanvas, type, quality);
        }
        return originalToDataURL.call(this, type, quality);
      };
      
      HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
        const canvas = this;
        const context = canvas.getContext('2d');
        if (context) {
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const tempContext = tempCanvas.getContext('2d');
          tempContext.putImageData(imageData, 0, 0);
          return originalToBlob.call(tempCanvas, callback, type, quality);
        }
        return originalToBlob.call(this, callback, type, quality);
      };

      // Enhanced WebGL fingerprint randomization
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      const getExtension = WebGLRenderingContext.prototype.getExtension;
      const getSupportedExtensions = WebGLRenderingContext.prototype.getSupportedExtensions;
      
      // Randomize WebGL vendor and renderer (common GPU vendors)
      const gpuVendors = ['Intel Inc.', 'NVIDIA Corporation', 'AMD', 'Google Inc. (Intel)'];
      const gpuRenderers = [
        'Intel Iris OpenGL Engine',
        'Intel HD Graphics',
        'NVIDIA GeForce GTX 1060',
        'AMD Radeon RX 580',
        'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)'
      ];
      const randomVendor = gpuVendors[Math.floor(Math.random() * gpuVendors.length)];
      const randomRenderer = gpuRenderers[Math.floor(Math.random() * gpuRenderers.length)];
      
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
          return randomVendor;
        }
        if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
          return randomRenderer;
        }
        // Randomize other WebGL parameters slightly
        if (parameter === 7936) { // VENDOR
          return randomVendor;
        }
        if (parameter === 7937) { // RENDERER
          return randomRenderer;
        }
        if (parameter === 7938) { // VERSION
          return 'WebGL 1.0 (OpenGL ES 2.0 Chromium)';
        }
        if (parameter === 34047) { // SHADING_LANGUAGE_VERSION
          return 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)';
        }
        return getParameter.call(this, parameter);
      };
      
      // Randomize WebGL2 context if available
      if (typeof WebGL2RenderingContext !== 'undefined') {
        const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445 || parameter === 7936) {
            return randomVendor;
          }
          if (parameter === 37446 || parameter === 7937) {
            return randomRenderer;
          }
          return getParameter2.call(this, parameter);
        };
      }

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

      // Enhanced hardware properties with realistic variations
      const cpuCores = [4, 6, 8, 12, 16][Math.floor(Math.random() * 5)];
      const deviceMemory = [4, 8, 16, 32][Math.floor(Math.random() * 4)];
      
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => cpuCores,
        configurable: true
      });

      // Add realistic deviceMemory with variations
      if ('deviceMemory' in navigator) {
        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => deviceMemory,
          configurable: true
        });
      }
      
      // Add realistic maxTouchPoints
      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => 0, // Desktop, no touch
        configurable: true
      });

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

      // Enhanced Battery API with realistic variations
      if ('getBattery' in navigator) {
        const originalGetBattery = navigator.getBattery;
        navigator.getBattery = function() {
          const isCharging = Math.random() > 0.3; // 70% chance of charging
          const batteryLevel = 0.5 + Math.random() * 0.5; // 50-100%
          return Promise.resolve({
            charging: isCharging,
            chargingTime: isCharging ? Math.floor(Math.random() * 3600) : Infinity,
            dischargingTime: isCharging ? Infinity : Math.floor(Math.random() * 7200) + 3600,
            level: batteryLevel,
            onchargingchange: null,
            onchargingtimechange: null,
            ondischargingtimechange: null,
            onlevelchange: null
          });
        };
      }
      
      // Add realistic AudioContext fingerprint randomization
      if (window.AudioContext || window.webkitAudioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const originalCreateAnalyser = AudioContextClass.prototype.createAnalyser;
        const originalCreateOscillator = AudioContextClass.prototype.createOscillator;
        
        // Add subtle randomization to audio context
        AudioContextClass.prototype.createAnalyser = function() {
          const analyser = originalCreateAnalyser.call(this);
          const originalGetFloatFrequencyData = analyser.getFloatFrequencyData;
          analyser.getFloatFrequencyData = function(array) {
            originalGetFloatFrequencyData.call(this, array);
            // Add minimal noise to prevent fingerprinting
            for (let i = 0; i < array.length; i++) {
              if (Math.random() < 0.01) {
                array[i] += (Math.random() - 0.5) * 0.1;
              }
            }
          };
          return analyser;
        };
      }
      
      // Add realistic font enumeration (prevent font fingerprinting)
      if (document.fonts && document.fonts.check) {
        const originalCheck = document.fonts.check;
        document.fonts.check = function(font, text) {
          // Return realistic font availability
          const commonFonts = ['Arial', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia'];
          if (commonFonts.some(f => font.includes(f))) {
            return true;
          }
          return originalCheck.call(this, font, text);
        };
      }

      // Enhanced screen properties with randomization
      const screenResolutions = [
        { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 },
        { width: 1366, height: 768, availWidth: 1366, availHeight: 728 },
        { width: 1280, height: 720, availWidth: 1280, availHeight: 680 },
        { width: 1600, height: 900, availWidth: 1600, availHeight: 860 },
        { width: 1440, height: 900, availWidth: 1440, availHeight: 860 }
      ];
      const randomScreen = screenResolutions[Math.floor(Math.random() * screenResolutions.length)];
      
      Object.defineProperty(screen, 'width', {
        get: () => randomScreen.width,
        configurable: true
      });
      Object.defineProperty(screen, 'height', {
        get: () => randomScreen.height,
        configurable: true
      });
      Object.defineProperty(screen, 'availWidth', {
        get: () => randomScreen.availWidth,
        configurable: true
      });
      Object.defineProperty(screen, 'availHeight', {
        get: () => randomScreen.availHeight,
        configurable: true
      });
      Object.defineProperty(screen, 'colorDepth', {
        get: () => 24,
        configurable: true
      });
      Object.defineProperty(screen, 'pixelDepth', {
        get: () => 24,
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
 * Enhanced to detect v2/v3, monitor scores, check token generation, detect errors
 * @param {Page} page - Playwright page object
 * @param {number} maxWaitTime - Maximum time to wait in milliseconds (default: 5000)
 * @returns {Promise<Object>} Detailed status object with ready, version, score, token, errors
 */
export async function waitForRecaptchaReady(page, maxWaitTime = 5000) {
  try {
    console.log('⏳ Waiting for reCAPTCHA to execute and calculate score...');
    
    // Wait for grecaptcha to be available with enhanced detection
    const recaptchaStatus = await page.evaluate(async (maxWait) => {
      return new Promise((resolve) => {
        const startTime = Date.now();
        let status = {
          ready: false,
          hasRecaptcha: false,
          version: null, // 'v2' or 'v3'
          siteKey: null,
          token: null,
          score: null, // For v3
          errors: [],
          warnings: [],
          timestamp: Date.now()
        };
        
        const checkRecaptcha = () => {
          try {
            // Check for reCAPTCHA v2 elements
            const v2Elements = {
              iframe: document.querySelector('iframe[src*="recaptcha/api"]'),
              grecaptchaDiv: document.querySelector('.g-recaptcha'),
              siteKeyElement: document.querySelector('[data-sitekey]')
            };
            
            // Check for reCAPTCHA v3 (invisible, check for script)
            const v3Script = document.querySelector('script[src*="recaptcha/api.js"]');
            const v3SiteKey = v3Script ? v3Script.getAttribute('data-sitekey') : null;
            
            // Determine version
            if (v2Elements.iframe || v2Elements.grecaptchaDiv || v2Elements.siteKeyElement) {
              status.version = 'v2';
              status.hasRecaptcha = true;
              status.siteKey = v2Elements.siteKeyElement?.getAttribute('data-sitekey') || null;
            } else if (v3Script || v3SiteKey) {
              status.version = 'v3';
              status.hasRecaptcha = true;
              status.siteKey = v3SiteKey;
            }
            
            // Check if grecaptcha is available
            if (window.grecaptcha) {
              if (window.grecaptcha.ready) {
                window.grecaptcha.ready(() => {
                  try {
                    // Try to get token for v2
                    if (status.version === 'v2' && status.siteKey) {
                      try {
                        const widgetId = window.grecaptcha.render ? 
                          window.grecaptcha.render(status.siteKey, {}) : null;
                        if (widgetId !== null && typeof widgetId === 'number') {
                          const response = window.grecaptcha.getResponse(widgetId);
                          if (response && response.length > 0) {
                            status.token = response.substring(0, 50) + '...'; // Truncate for logging
                          }
                        }
                      } catch (e) {
                        status.warnings.push(`Could not get v2 token: ${e.message}`);
                      }
                    }
                    
                    // Try to get score for v3
                    if (status.version === 'v3' && status.siteKey) {
                      try {
                        window.grecaptcha.execute(status.siteKey, { action: 'login' })
                          .then(token => {
                            if (token) {
                              status.token = token.substring(0, 50) + '...';
                            }
                          })
                          .catch(e => {
                            status.warnings.push(`Could not execute v3: ${e.message}`);
                          });
                      } catch (e) {
                        status.warnings.push(`Could not get v3 score: ${e.message}`);
                      }
                    }
                    
                    // Check for errors
                    const errorElements = document.querySelectorAll('.grecaptcha-error, [class*="recaptcha-error"]');
                    if (errorElements.length > 0) {
                      errorElements.forEach(el => {
                        const errorText = el.textContent || el.innerText;
                        if (errorText) {
                          status.errors.push(errorText.trim());
                        }
                      });
                    }
                    
                    status.ready = true;
                    status.timestamp = Date.now();
                    resolve(status);
                  } catch (e) {
                    status.errors.push(`Error in ready callback: ${e.message}`);
                    status.ready = true; // Still mark as ready even with errors
                    status.timestamp = Date.now();
                    resolve(status);
                  }
                });
              } else {
                // grecaptcha exists but ready() is not available
                status.ready = true;
                status.warnings.push('grecaptcha.ready() not available');
                status.timestamp = Date.now();
                resolve(status);
              }
            } else if (Date.now() - startTime < maxWait) {
              setTimeout(checkRecaptcha, 100);
            } else {
              // Timeout
              status.warnings.push('Timeout waiting for grecaptcha');
              status.timestamp = Date.now();
              resolve(status);
            }
          } catch (e) {
            status.errors.push(`Error checking reCAPTCHA: ${e.message}`);
            status.timestamp = Date.now();
            resolve(status);
          }
        };
        
        checkRecaptcha();
      });
    }, maxWaitTime);
    
    // Log detailed status
    if (recaptchaStatus.ready) {
      console.log(`✅ reCAPTCHA is ready (${recaptchaStatus.version || 'unknown version'})`);
      if (recaptchaStatus.hasRecaptcha) {
        console.log(`   Site Key: ${recaptchaStatus.siteKey || 'not found'}`);
        if (recaptchaStatus.token) {
          console.log(`   Token: ${recaptchaStatus.token}`);
        }
        if (recaptchaStatus.score !== null) {
          console.log(`   Score: ${recaptchaStatus.score}`);
        }
      }
      if (recaptchaStatus.errors.length > 0) {
        console.warn(`   Errors: ${recaptchaStatus.errors.join(', ')}`);
      }
      if (recaptchaStatus.warnings.length > 0) {
        console.warn(`   Warnings: ${recaptchaStatus.warnings.join(', ')}`);
      }
    } else {
      console.log('⚠️ reCAPTCHA may not be fully ready, but continuing...');
    }
    
    return recaptchaStatus;
  } catch (error) {
    console.log(`⚠️ Error checking reCAPTCHA status: ${error.message}`);
    return { 
      ready: false, 
      hasRecaptcha: false, 
      version: null,
      siteKey: null, 
      token: null,
      score: null,
      errors: [error.message],
      warnings: [],
      timestamp: Date.now() 
    };
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
  await page.waitForTimeout(200 + Math.random() * 200); // Optimized: 200-400ms (reduced from 500-1000ms)
  
  // 2. Move mouse around the form area (simulate reading/checking)
  if (formBox) {
    const formCenterX = formBox.x + formBox.width / 2;
    const formCenterY = formBox.y + formBox.height / 2;
    
    // Move to form area with natural curve (reduced point count for speed)
    const currentPos = { x: viewport.width / 2, y: viewport.height / 2 };
    const formPath = generateBezierPath(
      currentPos.x, currentPos.y,
      formCenterX, formCenterY,
      8 // Optimized: reduced from 15 to 8 points
    );
    
    for (const point of formPath) {
      await page.mouse.move(point.x, point.y);
      await page.waitForTimeout(30 + Math.random() * 50);
    }
    
    // Small micro-movements (human jitter) - reduced count and duration
    for (let i = 0; i < 2; i++) { // Optimized: reduced from 3 to 2
      await page.mouse.move(
        formCenterX + (Math.random() * 20 - 10),
        formCenterY + (Math.random() * 20 - 10)
      );
      await page.waitForTimeout(100 + Math.random() * 100); // Optimized: 100-200ms (reduced from 150-350ms)
    }
  }
  
  // 3. Additional wait to let reCAPTCHA observe behavior
  await page.waitForTimeout(400 + Math.random() * 200); // Optimized: 400-600ms (reduced from 1000-2000ms)
  
  // 4. Move to submit button with natural curve
  if (buttonBox && formBox) {
    const formCenterX = formBox.x + formBox.width / 2;
    const formCenterY = formBox.y + formBox.height / 2;
    const buttonCenterX = buttonBox.x + buttonBox.width / 2;
    const buttonCenterY = buttonBox.y + buttonBox.height / 2;
    
    const buttonPath = generateBezierPath(
      formCenterX, formCenterY,
      buttonCenterX, buttonCenterY,
      6 // Optimized: reduced from 12 to 6 points
    );
    
    for (const point of buttonPath) {
      await page.mouse.move(point.x, point.y);
      await page.waitForTimeout(40 + Math.random() * 60);
    }
    
    // Hover over button with slight movements (human hesitation)
    await page.waitForTimeout(150 + Math.random() * 100); // Optimized: 150-250ms (reduced from 300-700ms)
    await page.mouse.move(
      buttonCenterX + (Math.random() * 5 - 2.5),
      buttonCenterY + (Math.random() * 5 - 2.5)
    );
    await page.waitForTimeout(100 + Math.random() * 50); // Optimized: 100-150ms (reduced from 200-500ms)
  }
  
  console.log('✅ Human-like behavior simulation complete');
}

/**
 * Clears reCAPTCHA-related storage (localStorage, sessionStorage, IndexedDB)
 * @param {Page} page - Playwright page object
 * @returns {Promise<Object>} Object with cleared keys information
 */
export async function clearRecaptchaStorage(page) {
  try {
    console.log('🧹 Clearing reCAPTCHA storage (localStorage, sessionStorage, IndexedDB)...');
    
    const clearedInfo = await page.evaluate(() => {
      const cleared = {
        localStorage: [],
        sessionStorage: [],
        indexedDB: false
      };
      
      // Clear localStorage
      const localStorageKeys = Object.keys(localStorage);
      localStorageKeys.forEach(key => {
        if (key.includes('recaptcha') || key.includes('grecaptcha') || 
            key.startsWith('_grecaptcha') || key.toLowerCase().includes('captcha')) {
          localStorage.removeItem(key);
          cleared.localStorage.push(key);
        }
      });
      
      // Clear sessionStorage
      const sessionStorageKeys = Object.keys(sessionStorage);
      sessionStorageKeys.forEach(key => {
        if (key.includes('recaptcha') || key.includes('grecaptcha') || 
            key.toLowerCase().includes('captcha')) {
          sessionStorage.removeItem(key);
          cleared.sessionStorage.push(key);
        }
      });
      
      // Clear IndexedDB if available
      if (window.indexedDB) {
        try {
          // Delete reCAPTCHA-related databases
          const dbNames = ['recaptcha', 'grecaptcha', '_grecaptcha'];
          dbNames.forEach(dbName => {
            try {
              const deleteReq = indexedDB.deleteDatabase(dbName);
              deleteReq.onsuccess = () => {
                cleared.indexedDB = true;
              };
            } catch (e) {
              // Ignore errors
            }
          });
        } catch (e) {
          // IndexedDB clearing is optional
        }
      }
      
      return cleared;
    });
    
    console.log(`✅ Cleared ${clearedInfo.localStorage.length} localStorage keys, ${clearedInfo.sessionStorage.length} sessionStorage keys`);
    if (clearedInfo.localStorage.length > 0) {
      console.log(`   localStorage keys: ${clearedInfo.localStorage.join(', ')}`);
    }
    if (clearedInfo.sessionStorage.length > 0) {
      console.log(`   sessionStorage keys: ${clearedInfo.sessionStorage.join(', ')}`);
    }
    
    return clearedInfo;
  } catch (error) {
    console.warn(`⚠️ Error clearing reCAPTCHA storage: ${error.message}`);
    return { localStorage: [], sessionStorage: [], indexedDB: false };
  }
}

/**
 * Enhances behavioral patterns for better reCAPTCHA observation
 * @param {Page} page - Playwright page object
 * @param {Object} options - Options for behavioral patterns
 * @returns {Promise<void>}
 */
export async function enhanceBehavioralPatterns(page, options = {}) {
  const {
    preFormWait = 3000 + Math.random() * 2000, // 3-5 seconds
    postFillWait = 2000 + Math.random() * 2000, // 2-4 seconds
    enableScroll = true,
    enableMouseMovements = true,
    enableKeyboardEvents = true
  } = options;
  
  console.log('🤖 Enhancing behavioral patterns for reCAPTCHA observation...');
  
  // Pre-form interaction: simulate reading behavior
  if (enableScroll) {
    // Random scrolls to simulate reading
    const scrollCount = 2 + Math.floor(Math.random() * 3); // 2-4 scrolls
    for (let i = 0; i < scrollCount; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, (Math.random() - 0.5) * 200);
      });
      await page.waitForTimeout(300 + Math.random() * 500);
    }
  }
  
  // Random mouse movements during observation
  if (enableMouseMovements) {
    const viewport = page.viewportSize() || { width: 1280, height: 720 };
    const movementCount = 3 + Math.floor(Math.random() * 4); // 3-6 movements
    for (let i = 0; i < movementCount; i++) {
      await page.mouse.move(
        Math.random() * viewport.width,
        Math.random() * viewport.height
      );
      await page.waitForTimeout(200 + Math.random() * 300);
    }
  }
  
  // Simulate keyboard events (focus/blur)
  if (enableKeyboardEvents) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100 + Math.random() * 200);
    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(100 + Math.random() * 200);
  }
  
  // Wait for observation period
  await page.waitForTimeout(preFormWait);
  
  console.log('✅ Behavioral patterns enhanced');
}

