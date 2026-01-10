/**
 * Test Harness
 * Main test runner, environment setup/teardown, test orchestration
 * Single responsibility: test orchestration only
 */

import testConfig from './config/testConfig.js';
import { dbCleaner } from './helpers/dbCleaner.js';
import { stateManager } from './helpers/stateManager.js';
import { evidenceCollector } from './helpers/evidenceCollector.js';
import mongoose from 'mongoose';

class TestHarness {
  constructor() {
    this.testResults = [];
    this.startTime = null;
  }

  /**
   * Initialize test environment
   */
  async initialize() {
    console.log('[TestHarness] Initializing test environment...');
    this.startTime = Date.now();

    // Load environment variables
    if (typeof process !== 'undefined' && process.env) {
      // Environment variables should be loaded via dotenv in test files
      console.log('[TestHarness] Environment variables loaded');
    }

    // Connect to test database
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
      const dbName = testConfig.database.testDbName;
      
      if (!mongoose.connection.readyState) {
        await mongoose.connect(`${mongoUri}/${dbName}`, {
          serverSelectionTimeoutMS: 5000
        });
        console.log(`[TestHarness] Connected to test database: ${dbName}`);
      }
    } catch (error) {
      console.warn(`[TestHarness] Database connection failed: ${error.message}`);
      console.warn('[TestHarness] Continuing without database (some tests may fail)');
    }

    // Clean database if configured
    if (testConfig.database.cleanupAfterSuite) {
      await dbCleaner.cleanup();
    }

    console.log('[TestHarness] Test environment initialized');
  }

  /**
   * Cleanup test environment
   */
  async cleanup() {
    console.log('[TestHarness] Cleaning up test environment...');

    // Clean database if configured
    if (testConfig.database.cleanupAfterSuite) {
      await dbCleaner.cleanup();
    }

    // Close database connection
    if (mongoose.connection.readyState) {
      await mongoose.connection.close();
      console.log('[TestHarness] Database connection closed');
    }

    const duration = Date.now() - this.startTime;
    console.log(`[TestHarness] Cleanup complete (${duration}ms)`);
  }

  /**
   * Run a single test
   */
  async runTest(testName, testFunction) {
    const testStartTime = Date.now();
    let testResult = {
      name: testName,
      passed: false,
      duration: 0,
      error: null,
      evidence: null
    };

    try {
      console.log(`\n[TestHarness] Running test: ${testName}`);
      
      // Start evidence collection
      evidenceCollector.startTest(testName);
      
      // Run test
      await testFunction();
      
      // Test passed
      testResult.passed = true;
      testResult.duration = Date.now() - testStartTime;
      
      // Collect evidence
      testResult.evidence = await evidenceCollector.collectTestEvidence(testName);
      
      console.log(`[TestHarness] Test passed: ${testName} (${testResult.duration}ms)`);
    } catch (error) {
      // Test failed
      testResult.passed = false;
      testResult.duration = Date.now() - testStartTime;
      testResult.error = error.message;
      testResult.stack = error.stack;
      
      // Record error in evidence
      evidenceCollector.recordError(testName, error);
      testResult.evidence = await evidenceCollector.collectTestEvidence(testName);
      
      console.error(`[TestHarness] Test failed: ${testName}`);
      console.error(`[TestHarness] Error: ${error.message}`);
    }

    this.testResults.push(testResult);
    return testResult;
  }

  /**
   * Run multiple tests sequentially
   */
  async runTests(tests) {
    const results = [];
    
    for (const test of tests) {
      const result = await this.runTest(test.name, test.fn);
      results.push(result);
      
      // Stop on first failure if configured
      if (!result.passed && test.stopOnFailure) {
        console.log('[TestHarness] Stopping test suite due to failure');
        break;
      }
    }
    
    return results;
  }

  /**
   * Get test results summary
   */
  getSummary() {
    const total = this.testResults.length;
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;
    const duration = this.testResults.reduce((sum, r) => sum + r.duration, 0);

    return {
      total,
      passed,
      failed,
      duration,
      passRate: total > 0 ? (passed / total * 100).toFixed(2) + '%' : '0%'
    };
  }

  /**
   * Get all test results
   */
  getResults() {
    return this.testResults;
  }

  /**
   * Reset test results
   */
  reset() {
    this.testResults = [];
    this.startTime = Date.now();
  }
}

export const testHarness = new TestHarness();
export default testHarness;

