/**
 * Browser Pool Service
 * 
 * Single Responsibility: Manage browser pool lifecycle
 * - Pool initialization and configuration
 * - Browser acquisition with queue/timeout
 * - Browser release and cleanup
 * - Health monitoring and crash recovery
 * - Pool metrics for observability
 * 
 * This service does NOT handle browser configuration, authentication,
 * or CRM-specific logic - those belong to BrowserManager.
 */

import { chromium } from 'playwright';
import { EventEmitter } from 'events';

/**
 * @typedef {Object} PooledBrowser
 * @property {string} id - Unique identifier for the browser instance
 * @property {import('playwright').Browser} browser - Playwright browser instance
 * @property {import('playwright').BrowserContext|null} context - Browser context (for VPN mode)
 * @property {boolean} inUse - Whether the browser is currently checked out
 * @property {number} createdAt - Timestamp when browser was created
 * @property {number} lastUsedAt - Timestamp when browser was last used
 * @property {number} useCount - Number of times this browser has been used
 * @property {boolean} isVpnMode - Whether this browser uses VPN persistent context
 */

/**
 * @typedef {Object} PoolConfig
 * @property {number} size - Maximum number of browsers in pool
 * @property {number} maxQueueSize - Maximum pending acquisition requests
 * @property {number} acquireTimeout - Timeout for acquiring a browser (ms)
 * @property {number} idleTimeout - Time before idle browser is recycled (ms)
 * @property {number} maxUseCount - Maximum uses before browser is recycled
 * @property {boolean} lazyInit - Whether to initialize browsers on demand
 */

/**
 * @typedef {Object} PoolStatus
 * @property {number} total - Total browsers in pool
 * @property {number} available - Browsers available for checkout
 * @property {number} inUse - Browsers currently checked out
 * @property {number} queued - Pending acquisition requests
 * @property {boolean} initialized - Whether pool is initialized
 * @property {string} mode - 'vpn' or 'normal'
 */

class BrowserPoolService extends EventEmitter {
  constructor() {
    super();
    
    /** @type {Map<string, PooledBrowser>} */
    this.pool = new Map();
    
    /** @type {Array<{resolve: Function, reject: Function, timeout: NodeJS.Timeout}>} */
    this.waitQueue = [];
    
    /** @type {PoolConfig} */
    this.config = {
      size: parseInt(process.env.BROWSER_POOL_SIZE || '3', 10),
      maxQueueSize: parseInt(process.env.BROWSER_POOL_MAX_QUEUE_SIZE || '10', 10),
      acquireTimeout: parseInt(process.env.BROWSER_ACQUIRE_TIMEOUT_MS || '30000', 10),
      idleTimeout: parseInt(process.env.BROWSER_IDLE_TIMEOUT_MS || '300000', 10), // 5 minutes
      maxUseCount: parseInt(process.env.BROWSER_MAX_USE_COUNT || '100', 10),
      lazyInit: process.env.BROWSER_LAZY_INIT !== 'false'
    };
    
    this.initialized = false;
    this.shuttingDown = false;
    this.vpnMode = false;
    this.healthCheckInterval = null;
    
    // Bind methods
    this.acquire = this.acquire.bind(this);
    this.release = this.release.bind(this);
    this.getStatus = this.getStatus.bind(this);
  }

  /**
   * Initialize the browser pool
   * @param {Object} options - Initialization options
   * @param {boolean} options.vpnMode - Whether to use VPN mode
   * @param {Function} options.browserFactory - Factory function to create browsers
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    if (this.initialized) {
      console.log('⚠️ Browser pool already initialized');
      return;
    }

    this.vpnMode = options.vpnMode || false;
    this.browserFactory = options.browserFactory || this.defaultBrowserFactory.bind(this);
    
    console.log(`🏊 Initializing browser pool: size=${this.config.size}, vpnMode=${this.vpnMode}, lazyInit=${this.config.lazyInit}`);
    
    // Pre-warm pool if not lazy initialization
    if (!this.config.lazyInit) {
      const initPromises = [];
      for (let i = 0; i < this.config.size; i++) {
        initPromises.push(this.createPooledBrowser());
      }
      await Promise.all(initPromises);
    }
    
    // Start health check interval
    this.startHealthCheck();
    
    this.initialized = true;
    console.log(`✅ Browser pool initialized: ${this.pool.size} browsers ready`);
    this.emit('initialized', this.getStatus());
  }

  /**
   * Default browser factory for non-VPN mode
   * @returns {Promise<import('playwright').Browser>}
   */
  async defaultBrowserFactory() {
    const headless = process.env.NODE_ENV === 'production';
    return await chromium.launch({
      headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials'
      ]
    });
  }

  /**
   * Create a new pooled browser instance
   * @returns {Promise<PooledBrowser>}
   */
  async createPooledBrowser() {
    const id = `browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const browser = await this.browserFactory();
      
      /** @type {PooledBrowser} */
      const pooledBrowser = {
        id,
        browser,
        context: null,
        inUse: false,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        useCount: 0,
        isVpnMode: this.vpnMode
      };
      
      // Monitor browser disconnection
      browser.on('disconnected', () => {
        console.log(`⚠️ Browser ${id} disconnected`);
        this.handleBrowserDisconnect(id);
      });
      
      this.pool.set(id, pooledBrowser);
      console.log(`🌐 Created browser ${id} (pool size: ${this.pool.size})`);
      
      return pooledBrowser;
    } catch (error) {
      console.error(`❌ Failed to create browser ${id}:`, error.message);
      throw error;
    }
  }

  /**
   * Handle browser disconnection
   * @param {string} browserId
   */
  handleBrowserDisconnect(browserId) {
    const pooledBrowser = this.pool.get(browserId);
    if (pooledBrowser) {
      this.pool.delete(browserId);
      this.emit('browserCrashed', { browserId });
      
      // If not shutting down, try to replace the browser
      if (!this.shuttingDown && this.pool.size < this.config.size) {
        console.log(`🔄 Replacing crashed browser ${browserId}`);
        this.createPooledBrowser().catch(err => {
          console.error('❌ Failed to replace crashed browser:', err.message);
        });
      }
    }
  }

  /**
   * Acquire a browser from the pool
   * @param {number} [timeout] - Optional timeout override
   * @returns {Promise<PooledBrowser>}
   */
  async acquire(timeout = this.config.acquireTimeout) {
    if (this.shuttingDown) {
      throw new Error('Browser pool is shutting down');
    }

    if (!this.initialized) {
      throw new Error('Browser pool not initialized. Call initialize() first.');
    }

    // Try to find an available browser
    for (const [id, pooledBrowser] of this.pool) {
      if (!pooledBrowser.inUse && pooledBrowser.browser.isConnected()) {
        pooledBrowser.inUse = true;
        pooledBrowser.lastUsedAt = Date.now();
        pooledBrowser.useCount++;
        
        console.log(`✅ Acquired browser ${id} (use count: ${pooledBrowser.useCount})`);
        this.emit('acquired', { browserId: id });
        return pooledBrowser;
      }
    }

    // No available browser - try to create one if pool isn't full
    if (this.pool.size < this.config.size) {
      console.log('📈 Pool not full, creating new browser...');
      const newBrowser = await this.createPooledBrowser();
      newBrowser.inUse = true;
      newBrowser.useCount++;
      this.emit('acquired', { browserId: newBrowser.id });
      return newBrowser;
    }

    // Pool is full, queue the request
    if (this.waitQueue.length >= this.config.maxQueueSize) {
      throw new Error(`Browser pool queue is full (${this.config.maxQueueSize} pending requests)`);
    }

    console.log(`⏳ All browsers in use, queuing request (queue size: ${this.waitQueue.length + 1})`);
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this.waitQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.waitQueue.splice(index, 1);
        }
        reject(new Error(`Browser acquisition timed out after ${timeout}ms`));
      }, timeout);

      this.waitQueue.push({ resolve, reject, timeout: timeoutId });
    });
  }

  /**
   * Release a browser back to the pool
   * @param {PooledBrowser} pooledBrowser
   * @param {Object} [options]
   * @param {boolean} [options.recycle] - Force browser recycling
   */
  async release(pooledBrowser, options = {}) {
    if (!pooledBrowser || !pooledBrowser.id) {
      console.warn('⚠️ Attempted to release invalid browser');
      return;
    }

    const existing = this.pool.get(pooledBrowser.id);
    if (!existing) {
      console.warn(`⚠️ Browser ${pooledBrowser.id} not found in pool`);
      return;
    }

    // Check if browser should be recycled
    const shouldRecycle = options.recycle || 
      !pooledBrowser.browser.isConnected() ||
      pooledBrowser.useCount >= this.config.maxUseCount;

    if (shouldRecycle) {
      console.log(`♻️ Recycling browser ${pooledBrowser.id} (useCount: ${pooledBrowser.useCount})`);
      await this.recycleBrowser(pooledBrowser.id);
      return;
    }

    // Mark as available
    existing.inUse = false;
    existing.lastUsedAt = Date.now();
    
    console.log(`🔄 Released browser ${pooledBrowser.id} back to pool`);
    this.emit('released', { browserId: pooledBrowser.id });

    // Process wait queue
    this.processWaitQueue();
  }

  /**
   * Process waiting acquisition requests
   */
  processWaitQueue() {
    if (this.waitQueue.length === 0) return;

    // Find available browser
    for (const [id, pooledBrowser] of this.pool) {
      if (!pooledBrowser.inUse && pooledBrowser.browser.isConnected()) {
        const waiting = this.waitQueue.shift();
        if (waiting) {
          clearTimeout(waiting.timeout);
          pooledBrowser.inUse = true;
          pooledBrowser.lastUsedAt = Date.now();
          pooledBrowser.useCount++;
          
          console.log(`✅ Assigned browser ${id} to queued request`);
          waiting.resolve(pooledBrowser);
        }
        return;
      }
    }
  }

  /**
   * Recycle a browser (close and optionally replace)
   * @param {string} browserId
   */
  async recycleBrowser(browserId) {
    const pooledBrowser = this.pool.get(browserId);
    if (!pooledBrowser) return;

    this.pool.delete(browserId);

    try {
      if (pooledBrowser.browser.isConnected()) {
        await pooledBrowser.browser.close();
      }
    } catch (error) {
      console.warn(`⚠️ Error closing browser ${browserId}:`, error.message);
    }

    // Replace browser if not shutting down
    if (!this.shuttingDown && this.pool.size < this.config.size) {
      try {
        await this.createPooledBrowser();
      } catch (error) {
        console.error('❌ Failed to replace recycled browser:', error.message);
      }
    }

    this.emit('recycled', { browserId });
  }

  /**
   * Start periodic health check
   */
  startHealthCheck() {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 60000); // Every minute

    console.log('🏥 Browser pool health check started');
  }

  /**
   * Perform health check on all browsers
   */
  async performHealthCheck() {
    if (this.shuttingDown) return;

    const now = Date.now();
    const browsersToRecycle = [];

    for (const [id, pooledBrowser] of this.pool) {
      // Check connection health
      if (!pooledBrowser.browser.isConnected()) {
        console.log(`🏥 Browser ${id} disconnected, marking for recycle`);
        browsersToRecycle.push(id);
        continue;
      }

      // Check idle timeout (only for browsers not in use)
      if (!pooledBrowser.inUse) {
        const idleTime = now - pooledBrowser.lastUsedAt;
        if (idleTime > this.config.idleTimeout) {
          console.log(`🏥 Browser ${id} idle for ${Math.round(idleTime / 1000)}s, marking for recycle`);
          browsersToRecycle.push(id);
        }
      }
    }

    // Recycle unhealthy browsers
    for (const id of browsersToRecycle) {
      await this.recycleBrowser(id);
    }

    this.emit('healthCheck', this.getStatus());
  }

  /**
   * Get pool status for monitoring
   * @returns {PoolStatus}
   */
  getStatus() {
    let available = 0;
    let inUse = 0;

    for (const [, pooledBrowser] of this.pool) {
      if (pooledBrowser.inUse) {
        inUse++;
      } else if (pooledBrowser.browser.isConnected()) {
        available++;
      }
    }

    return {
      total: this.pool.size,
      available,
      inUse,
      queued: this.waitQueue.length,
      initialized: this.initialized,
      mode: this.vpnMode ? 'vpn' : 'normal',
      config: {
        size: this.config.size,
        maxQueueSize: this.config.maxQueueSize,
        acquireTimeout: this.config.acquireTimeout
      }
    };
  }

  /**
   * Gracefully shutdown the pool
   * @param {number} [gracePeriod=5000] - Time to wait for in-use browsers
   * @returns {Promise<void>}
   */
  async shutdown(gracePeriod = 5000) {
    if (this.shuttingDown) {
      console.log('⚠️ Pool already shutting down');
      return;
    }

    console.log('🛑 Shutting down browser pool...');
    this.shuttingDown = true;

    // Stop health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Reject all queued requests
    for (const waiting of this.waitQueue) {
      clearTimeout(waiting.timeout);
      waiting.reject(new Error('Browser pool is shutting down'));
    }
    this.waitQueue = [];

    // Wait for in-use browsers (with grace period)
    const startTime = Date.now();
    while (Date.now() - startTime < gracePeriod) {
      const status = this.getStatus();
      if (status.inUse === 0) break;
      console.log(`⏳ Waiting for ${status.inUse} browser(s) to be released...`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Close all browsers
    const closePromises = [];
    for (const [id, pooledBrowser] of this.pool) {
      closePromises.push(
        (async () => {
          try {
            if (pooledBrowser.browser.isConnected()) {
              await pooledBrowser.browser.close();
            }
            console.log(`🧹 Closed browser ${id}`);
          } catch (error) {
            console.warn(`⚠️ Error closing browser ${id}:`, error.message);
          }
        })()
      );
    }

    await Promise.all(closePromises);
    this.pool.clear();
    this.initialized = false;

    console.log('✅ Browser pool shutdown complete');
    this.emit('shutdown');
  }

  /**
   * Reset pool state (for testing)
   */
  async reset() {
    await this.shutdown(0);
    this.shuttingDown = false;
    this.vpnMode = false;
    this.browserFactory = null;
  }
}

// Export singleton instance
const browserPoolService = new BrowserPoolService();
export default browserPoolService;

// Also export class for testing
export { BrowserPoolService };
