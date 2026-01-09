/**
 * Report Generator
 * Generates test reports (HTML/JSON)
 * Single responsibility: report generation only
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ReportGenerator {
  constructor() {
    this.reportsDir = path.join(__dirname, '../../reports');
  }

  /**
   * Generate HTML report
   */
  async generateHTMLReport(testResults) {
    await fs.mkdir(this.reportsDir, { recursive: true });

    const html = this.buildHTML(testResults);
    const reportPath = path.join(this.reportsDir, `test-report-${Date.now()}.html`);
    await fs.writeFile(reportPath, html);

    return reportPath;
  }

  /**
   * Generate JSON report
   */
  async generateJSONReport(testResults) {
    await fs.mkdir(this.reportsDir, { recursive: true });

    const reportPath = path.join(this.reportsDir, `test-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(testResults, null, 2));

    return reportPath;
  }

  /**
   * Build HTML report content
   */
  buildHTML(testResults) {
    const { summary, tests, metrics } = testResults;
    
    return `<!DOCTYPE html>
<html>
<head>
  <title>Acceptance Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
    .test { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
    .pass { border-left: 5px solid #4caf50; }
    .fail { border-left: 5px solid #f44336; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
    .metric { background: #e3f2fd; padding: 15px; border-radius: 5px; }
    h1 { color: #333; }
    h2 { color: #666; }
    .timestamp { color: #999; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>Acceptance Test Report</h1>
  <div class="timestamp">Generated: ${new Date().toISOString()}</div>
  
  <div class="summary">
    <h2>Summary</h2>
    <p><strong>Total Tests:</strong> ${summary.total}</p>
    <p><strong>Passed:</strong> <span style="color: #4caf50;">${summary.passed}</span></p>
    <p><strong>Failed:</strong> <span style="color: #f44336;">${summary.failed}</span></p>
    <p><strong>Duration:</strong> ${summary.duration}ms</p>
  </div>

  <div class="metrics">
    ${metrics ? Object.entries(metrics).map(([key, value]) => `
      <div class="metric">
        <strong>${key}:</strong> ${value}
      </div>
    `).join('') : ''}
  </div>

  <h2>Test Results</h2>
  ${tests.map(test => `
    <div class="test ${test.passed ? 'pass' : 'fail'}">
      <h3>${test.name}</h3>
      <p><strong>Status:</strong> ${test.passed ? 'PASS' : 'FAIL'}</p>
      <p><strong>Duration:</strong> ${test.duration}ms</p>
      ${test.error ? `<p><strong>Error:</strong> <pre>${test.error}</pre></p>` : ''}
      ${test.evidence ? `<p><strong>Evidence:</strong> ${test.evidence}</p>` : ''}
    </div>
  `).join('')}
</body>
</html>`;
  }

  /**
   * Generate summary report
   */
  generateSummary(testResults) {
    const summary = {
      total: testResults.tests.length,
      passed: testResults.tests.filter(t => t.passed).length,
      failed: testResults.tests.filter(t => !t.passed).length,
      duration: testResults.tests.reduce((sum, t) => sum + (t.duration || 0), 0),
      timestamp: new Date().toISOString()
    };

    return {
      ...testResults,
      summary
    };
  }
}

export const reportGenerator = new ReportGenerator();
export default reportGenerator;

