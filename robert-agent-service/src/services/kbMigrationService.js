/**
 * KB Migration Service
 * Handles nightly file re-ingestion to OpenAI Files API
 */

import OpenAI from 'openai';
// dotenv is already loaded in index.js, no need to reload here
import { fileURLToPath } from 'url';
import path, { dirname, join } from 'path';
import fs from 'fs';
import crypto from 'crypto';

class KBMigrationService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;
    this.vectorStoreName = process.env.OPENAI_VECTOR_STORE_NAME || 'UNIVERSALAIDATABASE';
    this.openai = this.openaiApiKey ? new OpenAI({ apiKey: this.openaiApiKey }) : null;
    this.sourceDirectory = process.env.KB_SOURCE_DIRECTORY || './kb-files';
    this.fileIndex = new Map(); // In-memory cache: filePath -> { fileId, uploadedAt, checksum }
  }

  /**
   * Calculate file checksum
   * @param {string} filePath - Path to file
   * @returns {Promise<string>} SHA256 checksum
   */
  async calculateChecksum(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Check if file needs to be uploaded/updated
   * @param {string} filePath - Path to file
   * @param {string} currentChecksum - Current file checksum
   * @returns {boolean} True if file needs upload
   */
  needsUpload(filePath, currentChecksum) {
    const cached = this.fileIndex.get(filePath);
    if (!cached) {
      return true; // New file
    }
    return cached.checksum !== currentChecksum; // File changed
  }

  /**
   * Upload file to OpenAI Files API
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} Upload result with fileId
   */
  async uploadFile(filePath) {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      const fileStream = fs.createReadStream(filePath);
      const fileName = path.basename(filePath);
      
      const file = await this.openai.files.create({
        file: fileStream,
        purpose: 'assistants'
      });

      console.log(`✅ [KB MIGRATION] Uploaded file: ${fileName} (ID: ${file.id})`);
      
      return {
        fileId: file.id,
        fileName: file.filename || fileName,
        uploadedAt: new Date()
      };
    } catch (error) {
      console.error(`❌ [KB MIGRATION] Error uploading file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Associate file with vector store
   * @param {string} fileId - OpenAI file ID
   * @returns {Promise<Object>} Association result
   */
  async associateWithVectorStore(fileId) {
    if (!this.openai || !this.vectorStoreId) {
      throw new Error('OpenAI client or vector store not configured');
    }

    try {
      // Add file to vector store
      const vectorStore = await this.openai.beta.vectorStores.files.create(
        this.vectorStoreId,
        {
          file_id: fileId
        }
      );

      console.log(`✅ [KB MIGRATION] Associated file ${fileId} with vector store ${this.vectorStoreId}`);
      
      return {
        success: true,
        vectorStoreId: this.vectorStoreId,
        fileId
      };
    } catch (error) {
      // File might already be associated
      if (error.message && error.message.includes('already exists')) {
        console.log(`ℹ️ [KB MIGRATION] File ${fileId} already associated with vector store`);
        return { success: true, alreadyAssociated: true };
      }
      console.error(`❌ [KB MIGRATION] Error associating file with vector store:`, error);
      throw error;
    }
  }

  /**
   * Scan source directory for files
   * @returns {Promise<Array>} Array of file paths
   */
  async scanSourceDirectory() {
    try {
      if (!fs.existsSync(this.sourceDirectory)) {
        console.warn(`⚠️ [KB MIGRATION] Source directory does not exist: ${this.sourceDirectory}`);
        return [];
      }

      const files = [];
      const scanDir = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        entries.forEach(entry => {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            scanDir(fullPath);
          } else if (entry.isFile()) {
            // Only process supported file types
            const ext = path.extname(entry.name).toLowerCase();
            if (['.pdf', '.txt', '.md', '.html', '.json'].includes(ext)) {
              files.push(fullPath);
            }
          }
        });
      };

      scanDir(this.sourceDirectory);
      console.log(`📁 [KB MIGRATION] Found ${files.length} files in source directory`);
      
      return files;
    } catch (error) {
      console.error('❌ [KB MIGRATION] Error scanning source directory:', error);
      throw error;
    }
  }

  /**
   * Migrate files to OpenAI
   * @returns {Promise<Object>} Migration results
   */
  async migrateFilesToOpenAI() {
    try {
      console.log('🔄 [KB MIGRATION] Starting file migration...');
      
      const files = await this.scanSourceDirectory();
      const results = {
        filesProcessed: 0,
        filesAdded: 0,
        filesUpdated: 0,
        filesSkipped: 0,
        errors: []
      };

      for (const filePath of files) {
        try {
          results.filesProcessed++;
          
          // Calculate checksum
          const checksum = await this.calculateChecksum(filePath);
          
          // Check if upload needed
          if (!this.needsUpload(filePath, checksum)) {
            results.filesSkipped++;
            console.log(`⏭️ [KB MIGRATION] Skipping unchanged file: ${path.basename(filePath)}`);
            continue;
          }

          // Upload file
          const uploadResult = await this.uploadFile(filePath);
          
          // Associate with vector store
          await this.associateWithVectorStore(uploadResult.fileId);
          
          // Update file index
          const cached = this.fileIndex.get(filePath);
          if (cached) {
            results.filesUpdated++;
          } else {
            results.filesAdded++;
          }
          
          this.fileIndex.set(filePath, {
            fileId: uploadResult.fileId,
            fileName: uploadResult.fileName,
            uploadedAt: uploadResult.uploadedAt,
            checksum
          });

        } catch (error) {
          results.errors.push({
            filePath,
            error: error.message
          });
          console.error(`❌ [KB MIGRATION] Error processing file ${filePath}:`, error);
        }
      }

      console.log(`✅ [KB MIGRATION] Migration completed:`);
      console.log(`   - Processed: ${results.filesProcessed}`);
      console.log(`   - Added: ${results.filesAdded}`);
      console.log(`   - Updated: ${results.filesUpdated}`);
      console.log(`   - Skipped: ${results.filesSkipped}`);
      console.log(`   - Errors: ${results.errors.length}`);

      return {
        ...results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ [KB MIGRATION] Error during migration:', error);
      throw error;
    }
  }

  /**
   * Update file index mapping
   * @param {string} filePath - File path
   * @param {string} fileId - OpenAI file ID
   * @param {string} checksum - File checksum
   */
  updateFileIndex(filePath, fileId, checksum) {
    this.fileIndex.set(filePath, {
      fileId,
      fileName: path.basename(filePath),
      uploadedAt: new Date(),
      checksum
    });
  }

  /**
   * Get migration status
   * @returns {Object} Migration status
   */
  getMigrationStatus() {
    return {
      totalFiles: this.fileIndex.size,
      lastMigration: this.lastMigrationTime || null,
      vectorStoreId: this.vectorStoreId,
      vectorStoreName: this.vectorStoreName
    };
  }
}

export default new KBMigrationService();

