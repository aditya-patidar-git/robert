/**
 * Evidence Collector
 * Collects test evidence (logs, recordings, screenshots, metrics)
 * Single responsibility: evidence collection only
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EvidenceCollector {
  constructor() {
    this.testEvidence = new Map();
    this.baseDir = path.join(__dirname, '../../evidence');
  }

  /**
   * Start collecting evidence for a test
   */
  startTest(testName) {
    this.testEvidence.set(testName, {
      logs: [],
      recordings: [],
      screenshots: [],
      metrics: {},
      errors: [],
      startTime: Date.now()
    });
  }

  /**
   * Record evidence item
   */
  record(testName, type, data) {
    const evidence = this.testEvidence.get(testName);
    if (!evidence) {
      console.warn(`[EvidenceCollector] No evidence collection started for test: ${testName}`);
      return;
    }

    switch (type) {
      case 'log':
        evidence.logs.push({
          timestamp: new Date().toISOString(),
          data
        });
        break;
      case 'recording':
        evidence.recordings.push({
          timestamp: new Date().toISOString(),
          ...data
        });
        break;
      case 'screenshot':
        evidence.screenshots.push({
          timestamp: new Date().toISOString(),
          ...data
        });
        break;
      case 'metric':
        evidence.metrics = { ...evidence.metrics, ...data };
        break;
      default:
        console.warn(`[EvidenceCollector] Unknown evidence type: ${type}`);
    }
  }

  /**
   * Record error
   */
  recordError(testName, error) {
    const evidence = this.testEvidence.get(testName);
    if (evidence) {
      evidence.errors.push({
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        error: error.toString()
      });
    }
  }

  /**
   * Collect all evidence for a test
   */
  async collectTestEvidence(testName) {
    const evidence = this.testEvidence.get(testName);
    if (!evidence) {
      return null;
    }

    evidence.endTime = Date.now();
    evidence.duration = evidence.endTime - evidence.startTime;

    // Ensure evidence directory exists
    await fs.mkdir(this.baseDir, { recursive: true });

    // Save evidence to file
    const evidenceFile = path.join(this.baseDir, `${testName}_evidence.json`);
    await fs.writeFile(evidenceFile, JSON.stringify(evidence, null, 2));

    return evidence;
  }

  /**
   * Get evidence for a test
   */
  getEvidence(testName) {
    return this.testEvidence.get(testName) || null;
  }

  /**
   * Clear evidence for a test
   */
  clearTest(testName) {
    this.testEvidence.delete(testName);
  }

  /**
   * Get all evidence
   */
  getAllEvidence() {
    return Object.fromEntries(this.testEvidence);
  }

  /**
   * Save screenshot
   */
  async saveScreenshot(testName, screenshotPath, description = '') {
    const evidence = this.testEvidence.get(testName);
    if (evidence) {
      const screenshotDir = path.join(this.baseDir, testName, 'screenshots');
      await fs.mkdir(screenshotDir, { recursive: true });
      
      const filename = `screenshot_${Date.now()}.png`;
      const destPath = path.join(screenshotDir, filename);
      
      // Copy screenshot if it exists
      try {
        await fs.copyFile(screenshotPath, destPath);
        
        evidence.screenshots.push({
          timestamp: new Date().toISOString(),
          path: destPath,
          description
        });
      } catch (error) {
        console.error(`[EvidenceCollector] Error saving screenshot: ${error.message}`);
      }
    }
  }

  /**
   * Save HAR file
   */
  async saveHAR(testName, harData, description = '') {
    const evidence = this.testEvidence.get(testName);
    if (evidence) {
      const harDir = path.join(this.baseDir, testName, 'har');
      await fs.mkdir(harDir, { recursive: true });
      
      const filename = `har_${Date.now()}.json`;
      const harPath = path.join(harDir, filename);
      
      await fs.writeFile(harPath, JSON.stringify(harData, null, 2));
      
      evidence.logs.push({
        timestamp: new Date().toISOString(),
        type: 'har',
        path: harPath,
        description
      });
    }
  }
}

export const evidenceCollector = new EvidenceCollector();
export default evidenceCollector;

