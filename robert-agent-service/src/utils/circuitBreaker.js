/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by opening circuit after threshold failures
 */

class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || 'default';
    this.failureThreshold = options.failureThreshold || 5; // Open circuit after 5 failures
    this.resetTimeout = options.resetTimeout || 60000; // 60 seconds before attempting reset
    this.monitoringWindow = options.monitoringWindow || 60000; // 60 second window for failure tracking
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    this.failureHistory = []; // Array of { timestamp, error }
    
    // Statistics
    this.stats = {
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      circuitOpens: 0,
      circuitCloses: 0
    };
  }

  /**
   * Execute a function with circuit breaker protection
   * @param {Function} fn - Function to execute
   * @param {Array} args - Arguments to pass to function
   * @returns {Promise<any>} Function result
   */
  async execute(fn, ...args) {
    this.stats.totalRequests++;
    
    // Check circuit state
    if (this.state === 'OPEN') {
      // Check if we should attempt to close (half-open state)
      if (Date.now() >= this.nextAttemptTime) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        console.log(`🔄 [CIRCUIT BREAKER:${this.name}] Moving to HALF_OPEN state`);
      } else {
        const waitTime = Math.ceil((this.nextAttemptTime - Date.now()) / 1000);
        throw new Error(`Circuit breaker is OPEN. Service ${this.name} is unavailable. Retry after ${waitTime}s`);
      }
    }

    try {
      const result = await fn(...args);
      
      // Success - reset failure count and close circuit if needed
      this.onSuccess();
      return result;
    } catch (error) {
      // Failure - increment failure count
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  onSuccess() {
    this.stats.totalSuccesses++;
    this.failureCount = 0;
    
    // Clean old failures from history
    const now = Date.now();
    this.failureHistory = this.failureHistory.filter(
      f => (now - f.timestamp) < this.monitoringWindow
    );

    if (this.state === 'HALF_OPEN') {
      // If we get enough successes in half-open, close the circuit
      this.successCount++;
      if (this.successCount >= 2) {
        this.state = 'CLOSED';
        this.stats.circuitCloses++;
        this.successCount = 0;
        console.log(`✅ [CIRCUIT BREAKER:${this.name}] Circuit CLOSED - service recovered`);
      }
    }
  }

  /**
   * Handle failed execution
   * @param {Error} error - Error that occurred
   */
  onFailure(error) {
    this.stats.totalFailures++;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    // Add to failure history
    this.failureHistory.push({
      timestamp: this.lastFailureTime,
      error: error.message || String(error)
    });

    // Clean old failures from history
    const now = Date.now();
    this.failureHistory = this.failureHistory.filter(
      f => (now - f.timestamp) < this.monitoringWindow
    );

    // Check if we should open the circuit
    const recentFailures = this.failureHistory.length;
    if (recentFailures >= this.failureThreshold && this.state !== 'OPEN') {
      this.state = 'OPEN';
      this.stats.circuitOpens++;
      this.nextAttemptTime = Date.now() + this.resetTimeout;
      console.error(`🔴 [CIRCUIT BREAKER:${this.name}] Circuit OPENED - ${recentFailures} failures in ${this.monitoringWindow}ms`);
    }

    // If in half-open state and we get a failure, immediately open again
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.resetTimeout;
      console.error(`🔴 [CIRCUIT BREAKER:${this.name}] Circuit RE-OPENED after failure in HALF_OPEN state`);
    }
  }

  /**
   * Get current circuit state
   * @returns {Object} State information
   */
  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      recentFailures: this.failureHistory.length,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      stats: { ...this.stats }
    };
  }

  /**
   * Manually reset circuit breaker
   */
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.failureHistory = [];
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    console.log(`🔄 [CIRCUIT BREAKER:${this.name}] Manually reset to CLOSED state`);
  }

  /**
   * Check if circuit is open
   * @returns {boolean} True if circuit is open
   */
  isOpen() {
    if (this.state === 'OPEN' && Date.now() < this.nextAttemptTime) {
      return true;
    }
    return false;
  }
}

/**
 * Circuit Breaker Manager
 * Manages multiple circuit breakers for different services
 */
class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
  }

  /**
   * Get or create a circuit breaker for a service
   * @param {string} serviceName - Name of the service
   * @param {Object} options - Circuit breaker options
   * @returns {CircuitBreaker} Circuit breaker instance
   */
  getBreaker(serviceName, options = {}) {
    if (!this.breakers.has(serviceName)) {
      const breaker = new CircuitBreaker({
        name: serviceName,
        ...options
      });
      this.breakers.set(serviceName, breaker);
    }
    return this.breakers.get(serviceName);
  }

  /**
   * Get all circuit breaker states
   * @returns {Array} Array of circuit breaker states
   */
  getAllStates() {
    return Array.from(this.breakers.values()).map(breaker => breaker.getState());
  }

  /**
   * Reset a specific circuit breaker
   * @param {string} serviceName - Name of the service
   */
  resetBreaker(serviceName) {
    const breaker = this.breakers.get(serviceName);
    if (breaker) {
      breaker.reset();
    }
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    this.breakers.forEach(breaker => breaker.reset());
  }
}

// Export singleton instance
const circuitBreakerManager = new CircuitBreakerManager();

export default circuitBreakerManager;
export { CircuitBreaker, CircuitBreakerManager };

