/**
 * KB Drift Detection Service
 * Compares KB files vs live website content to detect stale documents
 */

import { chromium } from 'playwright';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class KBDriftDetectionService {
  constructor() {
    this.sourceDirectory = process.env.KB_SOURCE_DIRECTORY || './kb-files';
    this.driftThreshold = parseFloat(process.env.KB_DRIFT_THRESHOLD || '0.2'); // 20% difference
    this.browser = null;
  }

  /**
   * Initialize browser instance
   * @returns {Promise<void>}
   */
  async initializeBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true
      });
    }
  }

  /**
   * Cleanup browser instance
   */
  async cleanupBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Fetch content from live website
   * @param {string} url - URL to fetch
   * @returns {Promise<string>} Website content
   */
  async fetchWebsiteContent(url) {
    try {
      // Try using axios first (faster for simple pages)
      try {
        const response = await axios.get(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        // Extract text content from HTML (simple extraction)
        const html = response.data;
        const textContent = this.extractTextFromHTML(html);
        return textContent;
      } catch (axiosError) {
        // Fallback to Playwright for JavaScript-rendered content
        console.log(`⚠️ [KB DRIFT] Axios failed for ${url}, using Playwright...`);
        await this.initializeBrowser();
        const page = await this.browser.newPage();
        
        try {
          await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
          const textContent = await page.evaluate(() => {
            // Remove script and style elements
            const scripts = document.querySelectorAll('script, style, noscript');
            scripts.forEach(el => el.remove());
            
            // Get text content
            return document.body.innerText || document.body.textContent || '';
          });
          
          await page.close();
          return textContent;
        } catch (playwrightError) {
          console.error(`❌ [KB DRIFT] Error fetching ${url} with Playwright:`, playwrightError);
          throw playwrightError;
        }
      }
    } catch (error) {
      console.error(`❌ [KB DRIFT] Error fetching website content from ${url}:`, error);
      throw error;
    }
  }

  /**
   * Extract text content from HTML (simple implementation)
   * @param {string} html - HTML content
   * @returns {string} Extracted text
   */
  extractTextFromHTML(html) {
    // Remove script and style tags
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');
    
    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ');
    
    // Decode HTML entities (basic)
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    
    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
  }

  /**
   * Read KB file content
   * @param {string} filePath - Path to KB file
   * @returns {Promise<string>} File content
   */
  async readKBFile(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      
      // If it's HTML, extract text
      if (path.extname(filePath).toLowerCase() === '.html') {
        return this.extractTextFromHTML(content);
      }
      
      return content;
    } catch (error) {
      console.error(`❌ [KB DRIFT] Error reading KB file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Calculate similarity between two texts
   * Uses simple word-based comparison
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(text1, text2) {
    // Normalize texts
    const normalize = (text) => {
      return text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const normalized1 = normalize(text1);
    const normalized2 = normalize(text2);

    // Split into words
    const words1 = new Set(normalized1.split(' ').filter(w => w.length > 0));
    const words2 = new Set(normalized2.split(' ').filter(w => w.length > 0));

    // Calculate Jaccard similarity
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    if (union.size === 0) {
      return 1.0; // Both empty, consider identical
    }

    return intersection.size / union.size;
  }

  /**
   * Detect drift for a single KB file
   * @param {string} filePath - Path to KB file
   * @param {string} websiteUrl - URL to compare against
   * @returns {Promise<Object>} Drift detection result
   */
  async detectDriftForFile(filePath, websiteUrl) {
    try {
      // Read KB file content
      const kbContent = await this.readKBFile(filePath);
      
      // Fetch website content
      const websiteContent = await this.fetchWebsiteContent(websiteUrl);
      
      // Calculate similarity
      const similarity = this.calculateSimilarity(kbContent, websiteContent);
      const difference = 1 - similarity;
      
      const isStale = difference > this.driftThreshold;
      
      return {
        filePath,
        fileName: path.basename(filePath),
        websiteUrl,
        similarity,
        difference,
        isStale,
        kbContentLength: kbContent.length,
        websiteContentLength: websiteContent.length
      };
    } catch (error) {
      console.error(`❌ [KB DRIFT] Error detecting drift for ${filePath}:`, error);
      return {
        filePath,
        fileName: path.basename(filePath),
        websiteUrl,
        error: error.message,
        isStale: false // Mark as not stale if we can't check
      };
    }
  }

  /**
   * Generate drift detection report
   * @param {Array<Object>} fileUrlMappings - Array of { filePath, url } mappings
   * @returns {Promise<Object>} Drift report
   */
  async generateDriftReport(fileUrlMappings = []) {
    try {
      console.log('🔍 [KB DRIFT] Starting drift detection...');
      
      await this.initializeBrowser();
      
      const results = [];
      const staleFiles = [];
      
      for (const mapping of fileUrlMappings) {
        const result = await this.detectDriftForFile(mapping.filePath, mapping.url);
        results.push(result);
        
        if (result.isStale) {
          staleFiles.push(result);
        }
      }
      
      await this.cleanupBrowser();
      
      const report = {
        generatedAt: new Date().toISOString(),
        totalFiles: results.length,
        staleFiles: staleFiles.length,
        driftThreshold: this.driftThreshold,
        results: results.sort((a, b) => (b.difference || 0) - (a.difference || 0)), // Sort by difference descending
        staleFilesList: staleFiles.map(f => ({
          fileName: f.fileName,
          filePath: f.filePath,
          websiteUrl: f.websiteUrl,
          difference: f.difference,
          similarity: f.similarity
        }))
      };
      
      console.log(`✅ [KB DRIFT] Drift detection completed:`);
      console.log(`   - Total files: ${report.totalFiles}`);
      console.log(`   - Stale files: ${report.staleFiles}`);
      
      if (report.staleFiles > 0) {
        console.warn(`⚠️ [KB DRIFT] Found ${report.staleFiles} stale files that need updating`);
      }
      
      return report;
    } catch (error) {
      await this.cleanupBrowser();
      console.error('❌ [KB DRIFT] Error generating drift report:', error);
      throw error;
    }
  }

  /**
   * Auto-detect file-URL mappings from KB directory
   * Looks for metadata files, KB database, or infers from file names
   * @returns {Promise<Array>} Array of { filePath, url, selector } mappings
   */
  async autoDetectMappings() {
    try {
      console.log('🔍 [KB DRIFT] Auto-detecting file-URL mappings...');
      const mappings = [];

      // Strategy 1: Load from mapping file
      const mappingFilePath = path.join(__dirname, '../../config/kb-file-mappings.json');
      if (fs.existsSync(mappingFilePath)) {
        try {
          const mappingFileContent = fs.readFileSync(mappingFilePath, 'utf8');
          const mappingData = JSON.parse(mappingFileContent);
          if (mappingData.mappings && Array.isArray(mappingData.mappings)) {
            console.log(`✅ [KB DRIFT] Loaded ${mappingData.mappings.length} mappings from file`);
            return mappingData.mappings;
          }
        } catch (fileError) {
          console.warn('⚠️ [KB DRIFT] Error reading mapping file:', fileError.message);
        }
      }

      // Strategy 2: Query KB database for source URLs
      try {
        const mongoose = (await import('mongoose')).default;
        const KnowledgeBase = (await import('../../database/models/KnowledgeBase.js')).default;
        
        // Check if mongoose is connected
        if (mongoose.connection.readyState === 1) {
          const kbFiles = await KnowledgeBase.find({ 
            status: 'Active',
            sourceUrl: { $exists: true, $ne: null }
          }).select('filename uploadPath sourceUrl').lean();

          for (const kbFile of kbFiles) {
            mappings.push({
              filePath: kbFile.uploadPath || kbFile.filename,
              url: kbFile.sourceUrl,
              selector: null, // Can be added later if stored in DB
              lastChecked: kbFile.lastDriftCheck ? kbFile.lastDriftCheck.toISOString() : null
            });
          }

          if (mappings.length > 0) {
            console.log(`✅ [KB DRIFT] Auto-detected ${mappings.length} mappings from KB database`);
            return mappings;
          }
        } else {
          console.warn('⚠️ [KB DRIFT] MongoDB not connected, skipping database auto-detection');
        }
      } catch (dbError) {
        console.warn('⚠️ [KB DRIFT] Error querying KB database:', dbError.message);
      }

      // Strategy 3: Check environment variable
      const mappingsEnv = process.env.KB_FILE_URL_MAPPINGS;
      if (mappingsEnv) {
        try {
          const envMappings = JSON.parse(mappingsEnv);
          if (Array.isArray(envMappings) && envMappings.length > 0) {
            console.log(`✅ [KB DRIFT] Loaded ${envMappings.length} mappings from environment variable`);
            return envMappings;
          }
        } catch (parseError) {
          console.warn('⚠️ [KB DRIFT] Error parsing KB_FILE_URL_MAPPINGS:', parseError.message);
        }
      }

      // Strategy 4: Infer from file naming convention (basic pattern matching)
      // This is a fallback - looks for common patterns in filenames
      if (fs.existsSync(this.sourceDirectory)) {
        const files = fs.readdirSync(this.sourceDirectory, { recursive: true });
        const inferredMappings = [];
        
        for (const file of files) {
          if (file.endsWith('.pdf') || file.endsWith('.html') || file.endsWith('.md')) {
            // Try to infer URL from filename (very basic - can be improved)
            const fileName = path.basename(file, path.extname(file));
            // This is a placeholder - actual inference would need domain knowledge
            // For now, just log that we found files but couldn't infer URLs
          }
        }

        if (inferredMappings.length > 0) {
          console.log(`✅ [KB DRIFT] Inferred ${inferredMappings.length} mappings from file names`);
          return inferredMappings;
        }
      }

      if (mappings.length === 0) {
        console.warn('⚠️ [KB DRIFT] No mappings found via auto-detection. Please configure mappings manually.');
      }

      return mappings;
    } catch (error) {
      console.error('❌ [KB DRIFT] Error in auto-detection:', error);
      return [];
    }
  }
}

export default new KBDriftDetectionService();

