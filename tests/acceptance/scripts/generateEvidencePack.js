/**
 * Evidence Pack Generator
 * Collects and packages all test evidence into a ZIP file
 */

import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import { evidenceCollector } from '../helpers/evidenceCollector.js';
import { reportGenerator } from '../helpers/reportGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EvidencePackGenerator {
  constructor() {
    this.evidenceDir = path.join(__dirname, '../../evidence');
    this.reportsDir = path.join(__dirname, '../../reports');
    this.outputDir = path.join(__dirname, '../../evidence-packs');
  }

  /**
   * Generate evidence pack ZIP file
   */
  async generateEvidencePack(testResults, runNumber = 1) {
    console.log(`[EvidencePack] Generating evidence pack for run ${runNumber}...`);
    
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const zipFileName = `evidence-pack-run${runNumber}-${timestamp}.zip`;
    const zipPath = path.join(this.outputDir, zipFileName);
    
    return new Promise((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      output.on('close', () => {
        console.log(`[EvidencePack] Evidence pack created: ${zipPath} (${archive.pointer()} bytes)`);
        resolve(zipPath);
      });
      
      archive.on('error', (err) => {
        reject(err);
      });
      
      archive.pipe(output);
      
      // Add evidence files
      this.addEvidenceFiles(archive, testResults);
      
      // Add test reports
      this.addTestReports(archive);
      
      // Add environment details
      this.addEnvironmentDetails(archive);
      
      // Finalize archive
      archive.finalize();
    });
  }

  /**
   * Add evidence files to archive
   */
  async addEvidenceFiles(archive, testResults) {
    // Add evidence directory
    const evidenceDir = this.evidenceDir;
    
    try {
      const files = await fs.readdir(evidenceDir, { recursive: true });
      
      for (const file of files) {
        const filePath = path.join(evidenceDir, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isFile()) {
          archive.file(filePath, { name: `evidence/${file}` });
        }
      }
    } catch (error) {
      console.warn(`[EvidencePack] Error adding evidence files: ${error.message}`);
    }
    
    // Add test results summary
    archive.append(JSON.stringify(testResults, null, 2), {
      name: 'test-results-summary.json'
    });
  }

  /**
   * Add test reports to archive
   */
  async addTestReports(archive) {
    const reportsDir = this.reportsDir;
    
    try {
      const files = await fs.readdir(reportsDir);
      
      for (const file of files) {
        if (file.endsWith('.html') || file.endsWith('.json')) {
          const filePath = path.join(reportsDir, file);
          archive.file(filePath, { name: `reports/${file}` });
        }
      }
    } catch (error) {
      console.warn(`[EvidencePack] Error adding test reports: ${error.message}`);
    }
  }

  /**
   * Add environment details to archive
   */
  async addEnvironmentDetails(archive) {
    const envDetails = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'test'
    };
    
    archive.append(JSON.stringify(envDetails, null, 2), {
      name: 'environment-details.json'
    });
  }
}

export const evidencePackGenerator = new EvidencePackGenerator();
export default evidencePackGenerator;

