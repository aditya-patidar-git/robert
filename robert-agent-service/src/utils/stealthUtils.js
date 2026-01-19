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
 * Checks for reCAPTCHA image challenge after checkbox click
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>} True if challenge is detected
 */
export async function checkForRecaptchaChallenge(page) {
  try {
    // Wait a bit for challenge to appear (usually appears within 2-3 seconds)
    await page.waitForTimeout(2000 + Math.random() * 2000);
    
    // Check for challenge iframe (different from checkbox iframe)
    const challengeIframeSelectors = [
      'iframe[src*="recaptcha/api2/bframe"]',
      'iframe[src*="recaptcha/bframe"]',
      'iframe[title*="recaptcha challenge"]'
    ];
    
    for (const selector of challengeIframeSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        const iframe = page.locator(selector).first();
        const src = await iframe.getAttribute('src').catch(() => '');
        
        // Challenge iframe has "bframe" in URL (not "anchor" which is the checkbox)
        if (src.includes('bframe') && !src.includes('anchor')) {
          console.log(`🖼️ reCAPTCHA image challenge detected (iframe: ${selector})`);
          
          // Wait for challenge to potentially auto-resolve (if behavior is good enough)
          // Sometimes reCAPTCHA auto-resolves if behavioral patterns are human-like
          const maxWaitTime = 8000 + Math.random() * 4000; // 8-12 seconds
          console.log(`⏳ Waiting up to ${Math.round(maxWaitTime/1000)}s for challenge to resolve...`);
          
          const startTime = Date.now();
          while (Date.now() - startTime < maxWaitTime) {
            // Check if challenge iframe still exists
            const stillExists = await page.locator(selector).count() > 0;
            if (!stillExists) {
              console.log('✅ Challenge iframe disappeared - challenge resolved');
              return false; // Challenge was resolved
            }
            
            // Check if we've been redirected (login successful)
            const currentUrl = page.url();
            if (!currentUrl.includes('/Account/Login')) {
              const pageContent = await page.content().catch(() => '');
              if (pageContent.includes('Dashboard') || pageContent.includes('Contacts')) {
                console.log('✅ Challenge resolved - redirected to dashboard');
                return false; // Challenge was resolved
              }
            }
            
            await page.waitForTimeout(1000);
          }
          
          // Challenge still present after wait
          const stillVisible = await page.locator(selector).count() > 0;
          if (stillVisible) {
            console.warn('⚠️ reCAPTCHA image challenge still present - login may fail');
            console.warn('💡 Recommendation: Improve stealth patterns, use residential proxies, or integrate CAPTCHA solving service');
            return true; // Challenge detected and not resolved
          }
          
          return false; // Challenge was resolved
        }
      }
    }
    
    // No challenge detected
    return false;
  } catch (error) {
    console.warn(`⚠️ Error checking for reCAPTCHA challenge: ${error.message}`);
    return false;
  }
}

