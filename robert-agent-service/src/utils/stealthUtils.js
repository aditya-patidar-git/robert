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

