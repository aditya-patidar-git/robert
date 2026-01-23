/**
 * Master Test Runner
 * Runs all 12 acceptance tests sequentially twice
 * Generates comprehensive reports and evidence packs
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import testHarness from './testHarness.js';
import { reportGenerator } from './helpers/reportGenerator.js';
import { evidencePackGenerator } from './scripts/generateEvidencePack.js';
import { dbCleaner } from './helpers/dbCleaner.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env files from both backend and robert-agent-service
dotenv.config({ path: path.join(__dirname, '../../backend/.env') });
dotenv.config({ path: path.join(__dirname, '../../robert-agent-service/.env') });

// Import all test modules
import test1 from './01-call-pickup.test.js';
import test2 from './02-barge-in.test.js';
import test3 from './03-vad-thresholds.test.js';
import test4 from './04-kb-retrieval.test.js';
import test5 from './05-web-search.test.js';
import test6 from './06-crm-tasking.test.js';
import test7 from './07-human-transfer.test.js';
import test8 from './08-memory.test.js';
import test9 from './09-concurrency.test.js';
import test10 from './10-error-paths.test.js';
import test11 from './11-gdpr-dsar.test.js';
import test12 from './12-security.test.js';

const ALL_TESTS = [
  test1,
  test2,
  test3,
  test4,
  test5,
  test6,
  test7,
  test8,
  test9,
  test10,
  test11,
  test12
];

/**
 * Run all tests once
 */
async function runTestSuite(runNumber) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running Acceptance Test Suite - Run ${runNumber}`);
  console.log(`${'='.repeat(60)}\n`);
  
  // Reset test harness for this run
  testHarness.reset();
  
  // Initialize test harness
  await testHarness.initialize();
  
  // Clean environment
  console.log('[TestRunner] Cleaning test environment...');
  await dbCleaner.cleanup();
  
  // Run all tests
  const results = await testHarness.runTests(ALL_TESTS.map(test => ({
    name: test.name,
    fn: test.fn,
    stopOnFailure: false
  })));
  
  // Get summary
  const summary = testHarness.getSummary();
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Test Run ${runNumber} Summary`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total: ${summary.total}`);
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Pass Rate: ${summary.passRate}`);
  console.log(`Duration: ${summary.duration}ms`);
  console.log(`${'='.repeat(60)}\n`);
  
  // Cleanup
  await testHarness.cleanup();
  
  return {
    runNumber,
    summary,
    results,
    timestamp: new Date().toISOString()
  };
}

/**
 * Main execution
 */
async function main() {
  const startTime = Date.now();
  
  try {
    console.log('Acceptance Test Suite Runner');
    console.log('=============================\n');
    
    // Run tests twice as required
    const run1Results = await runTestSuite(1);
    
    // Wait a bit between runs
    console.log('\nWaiting 5 seconds before second run...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const run2Results = await runTestSuite(2);
    
    // Combine results
    const allResults = {
      run1: run1Results,
      run2: run2Results,
      overall: {
        total: run1Results.summary.total + run2Results.summary.total,
        passed: run1Results.summary.passed + run2Results.summary.passed,
        failed: run1Results.summary.failed + run2Results.summary.failed,
        duration: Date.now() - startTime
      }
    };
    
    // Generate reports
    console.log('\n[TestRunner] Generating test reports...');
    const htmlReportPath = await reportGenerator.generateHTMLReport(allResults);
    const jsonReportPath = await reportGenerator.generateJSONReport(allResults);
    
    console.log(`[TestRunner] HTML Report: ${htmlReportPath}`);
    console.log(`[TestRunner] JSON Report: ${jsonReportPath}`);
    
    // Generate evidence packs
    console.log('\n[TestRunner] Generating evidence packs...');
    const evidencePack1 = await evidencePackGenerator.generateEvidencePack(run1Results, 1);
    const evidencePack2 = await evidencePackGenerator.generateEvidencePack(run2Results, 2);
    
    console.log(`[TestRunner] Evidence Pack 1: ${evidencePack1}`);
    console.log(`[TestRunner] Evidence Pack 2: ${evidencePack2}`);
    
    // Final summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('Final Test Results');
    console.log(`${'='.repeat(60)}`);
    console.log(`Run 1: ${run1Results.summary.passed}/${run1Results.summary.total} passed (${run1Results.summary.passRate})`);
    console.log(`Run 2: ${run2Results.summary.passed}/${run2Results.summary.total} passed (${run2Results.summary.passRate})`);
    console.log(`Overall: ${allResults.overall.passed}/${allResults.overall.total} passed`);
    console.log(`${'='.repeat(60)}\n`);
    
    // Check if all tests passed both runs
    const allPassed = run1Results.summary.failed === 0 && run2Results.summary.failed === 0;
    
    if (allPassed) {
      console.log('✓ All tests passed 100% in both runs!');
      process.exit(0);
    } else {
      console.error('✗ Some tests failed. Review reports and evidence packs.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n[TestRunner] Fatal error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
// This file is meant to be run directly, so always execute main()
console.log('[TestRunner] Starting test runner...');
main().catch(error => {
  console.error('\n[TestRunner] Fatal error:', error);
  console.error(error.stack);
  process.exit(1);
});

export default { runTestSuite, main };

