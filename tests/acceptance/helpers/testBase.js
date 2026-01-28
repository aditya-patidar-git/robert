/**
 * Base Test Class
 * Provides common setup/teardown logic for all acceptance tests
 * Follows single-responsibility principle - handles test lifecycle only
 */

import testConfig from '../config/testConfig.js';
import { dbCleaner } from './dbCleaner.js';
import { stateManager } from './stateManager.js';
import { evidenceCollector } from './evidenceCollector.js';

export class TestBase {
  constructor(testName) {
    this.testName = testName;
    this.startTime = null;
    this.evidence = {
      logs: [],
      recordings: [],
      screenshots: [],
      metrics: {},
      errors: []
    };
  }

  /**
   * Setup before each test
   */
  async setup() {
    this.startTime = Date.now();
    console.log(`\n[SETUP] Starting test: ${this.testName}`);
    
    // Initialize state manager for this test
    await stateManager.initialize(this.testName);
    
    // Clean database if configured
    if (testConfig.database.cleanupAfterTest) {
      await dbCleaner.cleanup();
    }
    
    // Initialize evidence collector
    evidenceCollector.startTest(this.testName);
  }

  /**
   * Teardown after each test
   */
  async teardown() {
    const duration = Date.now() - this.startTime;
    console.log(`[TEARDOWN] Completing test: ${this.testName} (${duration}ms)`);
    
    // Collect evidence
    this.evidence = await evidenceCollector.collectTestEvidence(this.testName);
    
    // Cleanup state
    await stateManager.cleanup(this.testName);
    
    // Clean database if configured
    if (testConfig.database.cleanupAfterTest) {
      await dbCleaner.cleanup();
    }
    
    // Wait for final cleanup to complete (allows WebSocket close, Twilio termination, etc.)
    console.log(`[TEARDOWN] Waiting for final cleanup to complete...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`[TEARDOWN] Test ${this.testName} cleanup complete`);
  }

  /**
   * Record evidence item
   */
  recordEvidence(type, data) {
    evidenceCollector.record(this.testName, type, data);
  }

  /**
   * Record error
   */
  recordError(error) {
    this.evidence.errors.push({
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    });
    evidenceCollector.recordError(this.testName, error);
  }

  /**
   * Get test duration
   */
  getDuration() {
    return Date.now() - this.startTime;
  }
}

export default TestBase;

