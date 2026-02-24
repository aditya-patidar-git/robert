import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import KnowledgeBase from '../models/KnowledgeBase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * KB Mapping Service
 * Manages file-URL mappings for KB drift detection
 */
class KBMappingService {
  constructor() {
    // Default mapping file location (configurable via environment variable)
    this.mappingFilePath = process.env.KB_MAPPING_FILE_PATH ||
      path.join(__dirname, '../config/kb-file-mappings.json');
  }

  /**
   * Get all mappings
   * @returns {Promise<Array>} Array of mappings
   */
  async getAllMappings() {
    try {
      // Try to load from file first
      if (fs.existsSync(this.mappingFilePath)) {
        const fileContent = fs.readFileSync(this.mappingFilePath, 'utf8');
        const mappingData = JSON.parse(fileContent);
        return mappingData.mappings || [];
      }

      // Fallback: Query database for mappings
      const kbFiles = await KnowledgeBase.find({
        status: 'Active',
        sourceUrl: { $exists: true, $ne: null }
      }).select('_id title filename uploadPath sourceUrl lastDriftCheck').lean();

      return kbFiles.map(file => ({
        id: file._id.toString(),
        filePath: file.uploadPath || file.filename,
        fileName: file.filename,
        title: file.title,
        url: file.sourceUrl,
        selector: null,
        lastChecked: file.lastDriftCheck ? file.lastDriftCheck.toISOString() : null
      }));
    } catch (error) {
      console.error('Error getting mappings:', error);
      throw error;
    }
  }

  /**
   * Get mapping by file ID
   * @param {string} fileId - KB file ID
   * @returns {Promise<Object|null>} Mapping object or null
   */
  async getMappingByFileId(fileId) {
    try {
      const kbFile = await KnowledgeBase.findById(fileId).select('filename uploadPath sourceUrl lastDriftCheck').lean();

      if (!kbFile || !kbFile.sourceUrl) {
        return null;
      }

      return {
        id: fileId,
        filePath: kbFile.uploadPath || kbFile.filename,
        fileName: kbFile.filename,
        url: kbFile.sourceUrl,
        selector: null,
        lastChecked: kbFile.lastDriftCheck ? kbFile.lastDriftCheck.toISOString() : null
      };
    } catch (error) {
      console.error('Error getting mapping by file ID:', error);
      throw error;
    }
  }

  /**
   * Create or update mapping
   * @param {Object} mappingData - Mapping data
   * @returns {Promise<Object>} Created/updated mapping
   */
  async saveMapping(mappingData) {
    try {
      const { fileId, url, selector } = mappingData;

      if (!fileId) {
        throw new Error('File ID is required');
      }

      if (!url) {
        throw new Error('URL is required');
      }

      // Validate URL format
      try {
        new URL(url);
      } catch (urlError) {
        throw new Error('Invalid URL format');
      }

      // Update KB file with source URL
      const kbFile = await KnowledgeBase.findByIdAndUpdate(
        fileId,
        {
          sourceUrl: url,
          $set: {
            'metadata.selector': selector || null
          }
        },
        { new: true }
      );

      if (!kbFile) {
        throw new Error('KB file not found');
      }

      // Also update mapping file if it exists
      await this.updateMappingFile({
        filePath: kbFile.uploadPath || kbFile.filename,
        url: url,
        selector: selector || null,
        lastChecked: null
      });

      return {
        id: fileId,
        filePath: kbFile.uploadPath || kbFile.filename,
        fileName: kbFile.filename,
        url: url,
        selector: selector || null,
        lastChecked: kbFile.lastDriftCheck ? kbFile.lastDriftCheck.toISOString() : null
      };
    } catch (error) {
      console.error('Error saving mapping:', error);
      throw error;
    }
  }

  /**
   * Delete mapping
   * @param {string} fileId - KB file ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteMapping(fileId) {
    try {
      // Remove source URL from KB file
      await KnowledgeBase.findByIdAndUpdate(
        fileId,
        {
          $unset: { sourceUrl: '' }
        }
      );

      return true;
    } catch (error) {
      console.error('Error deleting mapping:', error);
      throw error;
    }
  }

  /**
   * Bulk import mappings
   * @param {Array} mappings - Array of mapping objects
   * @returns {Promise<Object>} Import result
   */
  async bulkImportMappings(mappings) {
    try {
      const results = {
        success: 0,
        failed: 0,
        errors: []
      };

      for (const mapping of mappings) {
        try {
          // Find KB file by filename or title
          let kbFile = null;

          if (mapping.fileId) {
            kbFile = await KnowledgeBase.findById(mapping.fileId);
          } else if (mapping.filename) {
            kbFile = await KnowledgeBase.findOne({ filename: mapping.filename });
          } else if (mapping.title) {
            kbFile = await KnowledgeBase.findOne({ title: mapping.title });
          }

          if (!kbFile) {
            results.failed++;
            results.errors.push({
              mapping,
              error: 'KB file not found'
            });
            continue;
          }

          // Validate URL
          try {
            new URL(mapping.url);
          } catch (urlError) {
            results.failed++;
            results.errors.push({
              mapping,
              error: 'Invalid URL format'
            });
            continue;
          }

          // Save mapping
          await this.saveMapping({
            fileId: kbFile._id.toString(),
            url: mapping.url,
            selector: mapping.selector || null
          });

          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            mapping,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error in bulk import:', error);
      throw error;
    }
  }

  /**
   * Export mappings
   * @returns {Promise<Array>} Array of mappings
   */
  async exportMappings() {
    return this.getAllMappings();
  }

  /**
   * Sync mappings with KB database
   * Updates mapping file with current database state
   * @returns {Promise<Object>} Sync result
   */
  async syncWithDatabase() {
    try {
      const mappings = await this.getAllMappings();

      const mappingData = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        mappings: mappings
      };

      // Ensure directory exists
      const dir = path.dirname(this.mappingFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write to file
      fs.writeFileSync(
        this.mappingFilePath,
        JSON.stringify(mappingData, null, 2),
        'utf8'
      );

      return {
        success: true,
        mappingsCount: mappings.length,
        filePath: this.mappingFilePath
      };
    } catch (error) {
      console.error('Error syncing mappings:', error);
      throw error;
    }
  }

  /**
   * Update mapping file
   * @param {Object} mapping - Mapping to add/update
   * @returns {Promise<void>}
   */
  async updateMappingFile(mapping) {
    try {
      let mappingData = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        mappings: []
      };

      // Load existing mappings if file exists
      if (fs.existsSync(this.mappingFilePath)) {
        const fileContent = fs.readFileSync(this.mappingFilePath, 'utf8');
        mappingData = JSON.parse(fileContent);
      }

      // Check if mapping already exists (by filePath)
      const existingIndex = mappingData.mappings.findIndex(
        m => m.filePath === mapping.filePath
      );

      if (existingIndex >= 0) {
        // Update existing mapping
        mappingData.mappings[existingIndex] = {
          ...mappingData.mappings[existingIndex],
          ...mapping,
          lastUpdated: new Date().toISOString()
        };
      } else {
        // Add new mapping
        mappingData.mappings.push({
          ...mapping,
          lastUpdated: new Date().toISOString()
        });
      }

      mappingData.lastUpdated = new Date().toISOString();

      // Ensure directory exists
      const dir = path.dirname(this.mappingFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write to file
      fs.writeFileSync(
        this.mappingFilePath,
        JSON.stringify(mappingData, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Error updating mapping file:', error);
      throw error;
    }
  }

  /**
   * Validate URL
   * @param {string} url - URL to validate
   * @returns {Promise<{valid: boolean, error?: string}>}
   */
  async validateUrl(url) {
    try {
      new URL(url);

      // Try to fetch URL to verify it's accessible
      const axios = (await import('axios')).default;
      const response = await axios.head(url, { timeout: 5000 });

      return {
        valid: true,
        statusCode: response.status
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Test mapping
   * Fetches URL and compares with KB file
   * @param {string} fileId - KB file ID
   * @returns {Promise<Object>} Test result
   */
  async testMapping(fileId) {
    try {
      const mapping = await this.getMappingByFileId(fileId);

      if (!mapping) {
        throw new Error('Mapping not found');
      }

      const kbFile = await KnowledgeBase.findById(fileId);
      if (!kbFile) {
        throw new Error('KB file not found');
      }

      // Fetch similarity analysis from agent service via API
      const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:3002';
      const axios = (await import('axios')).default;

      const response = await axios.post(`${AGENT_SERVICE_URL}/api/utils/similarity`, {
        url: mapping.url,
        kbContent: kbFile.content
      }, { timeout: 30000 });

      if (!response.data || !response.data.success) {
        throw new Error(response.data?.error || 'Failed to test mapping via agent API');
      }

      const { similarity, difference, isStale } = response.data;
      const driftThreshold = response.data.driftThreshold || 0.2;

      return {
        success: true,
        similarity,
        difference,
        isStale,
        driftThreshold: kbDriftDetectionService.driftThreshold,
        kbContentLength: kbFile.content.length,
        websiteContentLength: websiteContent.length
      };
    } catch (error) {
      console.error('Error testing mapping:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new KBMappingService();

