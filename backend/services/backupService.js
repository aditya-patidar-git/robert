/**
 * Backup Service
 * Pure JavaScript/Mongoose implementation for database backup and restore
 * 
 * Features:
 * - No external dependencies (no mongodump/mongorestore required)
 * - Works with MongoDB Atlas and cloud environments
 * - Selective backup/restore by collection
 * - GDPR-compliant with sensitive field exclusion
 * - Preview/diff before restore
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import archiver from 'archiver';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import * as tar from 'tar';
import mongoose from 'mongoose';
import { 
  modelRegistry, 
  getAllModelKeys, 
  getModelsSortedByPriority,
  isValidModelKey,
  getDefaultBackupCollections 
} from '../models/index.js';
import websocketService from './websocketService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Backup format version for compatibility checking
const BACKUP_FORMAT_VERSION = '2.0';

/**
 * Backup Service Class
 * Handles system backups using Mongoose queries instead of mongodump
 */
class BackupService {
  constructor() {
    this.backupDirectory = process.env.BACKUP_DIRECTORY || path.join(__dirname, '../../backups');
    this.ensureBackupDirectory();
  }

  /**
   * Ensure backup directory exists
   */
  ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDirectory)) {
      fs.mkdirSync(this.backupDirectory, { recursive: true });
    }
  }

  /**
   * Create system backup using Mongoose queries
   * @param {Object} options - Backup options
   * @param {string[]} options.collections - Array of collection keys to backup (null = default set)
   * @param {boolean} options.includeAuditLogs - Include audit log collections
   * @param {boolean} options.includeScreenshots - Include screenshot files
   * @param {string} options.description - Optional description for the backup
   * @returns {Promise<Object>} Backup result
   */
  async createBackup(options = {}) {
    const {
      collections = null,
      includeAuditLogs = false,
      includeScreenshots = false,
      description = ''
    } = options;

    const backupId = `backup-${Date.now()}`;
    const backupPath = path.join(this.backupDirectory, backupId);
    const timestamp = new Date().toISOString();

    try {
      console.log(`🔄 Starting backup: ${backupId}`);

      // Emit backup started event
      websocketService.emitBackupProgress({
        backupId,
        status: 'started',
        progress: 0,
        message: 'Initializing backup...'
      });

      // Create backup directory
      fs.mkdirSync(backupPath, { recursive: true });

      // Determine which collections to backup
      let collectionsToBackup = collections;
      if (!collectionsToBackup || collectionsToBackup.length === 0) {
        collectionsToBackup = getDefaultBackupCollections();
      }

      // Add audit logs if requested
      if (includeAuditLogs) {
        const logCollections = ['callRecords', 'auditLogs', 'alerts', 'complaintRecords', 'escalationLogs', 'provenances', 'modelHistory'];
        collectionsToBackup = [...new Set([...collectionsToBackup, ...logCollections])];
      }

      // Validate collection keys
      const validCollections = collectionsToBackup.filter(key => isValidModelKey(key));
      if (validCollections.length === 0) {
        websocketService.emitBackupProgress({
          backupId,
          status: 'failed',
          progress: 0,
          message: 'No valid collections specified for backup',
          error: { message: 'No valid collections specified for backup' }
        });
        throw new Error('No valid collections specified for backup');
      }

      // Export data from each collection
      const exportedData = {};
      const documentCounts = {};
      const errors = [];
      const totalCollections = validCollections.length;

      for (let i = 0; i < validCollections.length; i++) {
        const collectionKey = validCollections[i];
        const progress = Math.round(((i + 1) / totalCollections) * 80); // Reserve 20% for archiving

        // Emit progress for each collection
        websocketService.emitBackupProgress({
          backupId,
          status: 'in_progress',
          progress,
          currentCollection: collectionKey,
          processedCollections: i + 1,
          totalCollections,
          message: `Exporting ${collectionKey}...`
        });

        try {
          const result = await this.exportCollection(collectionKey);
          exportedData[collectionKey] = result.documents;
          documentCounts[collectionKey] = result.count;
          console.log(`  ✓ ${collectionKey}: ${result.count} documents`);
        } catch (error) {
          console.warn(`  ⚠️ Failed to export ${collectionKey}: ${error.message}`);
          errors.push({ collection: collectionKey, error: error.message });
        }
      }

      // Create the backup data file
      const backupData = {
        metadata: {
          version: BACKUP_FORMAT_VERSION,
          backupId,
          timestamp,
          description,
          collections: validCollections,
          documentCounts,
          totalDocuments: Object.values(documentCounts).reduce((a, b) => a + b, 0),
          includeAuditLogs,
          includeScreenshots,
          errors: errors.length > 0 ? errors : undefined
        },
        data: exportedData
      };

      // Write backup data
      const dataFilePath = path.join(backupPath, 'backup-data.json');
      fs.writeFileSync(dataFilePath, JSON.stringify(backupData, null, 2));
      console.log(`📦 Backup data written to ${dataFilePath}`);

      // Copy screenshots if requested
      if (includeScreenshots) {
        websocketService.emitBackupProgress({
          backupId,
          status: 'in_progress',
          progress: 85,
          message: 'Copying screenshots...'
        });
        await this.copyScreenshots(path.join(backupPath, 'screenshots'));
      }

      // Copy audit log files if they exist
      if (includeAuditLogs) {
        websocketService.emitBackupProgress({
          backupId,
          status: 'in_progress',
          progress: 90,
          message: 'Copying audit log files...'
        });
        await this.copyAuditLogFiles(path.join(backupPath, 'audit-log-files'));
      }

      // Create compressed archive
      websocketService.emitBackupProgress({
        backupId,
        status: 'in_progress',
        progress: 95,
        message: 'Creating compressed archive...'
      });
      const archivePath = `${backupPath}.tar.gz`;
      await this.createArchive(backupPath, archivePath);

      // Get archive size
      const archiveStats = fs.statSync(archivePath);

      // Remove uncompressed directory
      fs.rmSync(backupPath, { recursive: true, force: true });

      console.log(`✅ Backup created: ${backupId} (${this.formatBytes(archiveStats.size)})`);

      // Emit backup completed event
      websocketService.emitBackupProgress({
        backupId,
        status: 'completed',
        progress: 100,
        message: `Backup created successfully (${this.formatBytes(archiveStats.size)})`,
        size: archiveStats.size,
        timestamp
      });

      return {
        success: true,
        backupId,
        filePath: archivePath,
        size: archiveStats.size,
        timestamp,
        metadata: backupData.metadata
      };
    } catch (error) {
      console.error(`❌ Backup failed: ${error.message}`);
      
      // Emit backup failed event
      websocketService.emitBackupProgress({
        backupId,
        status: 'failed',
        progress: 0,
        message: `Backup failed: ${error.message}`,
        error: { message: error.message }
      });
      
      // Cleanup on failure
      if (fs.existsSync(backupPath)) {
        fs.rmSync(backupPath, { recursive: true, force: true });
      }
      const archivePath = `${backupPath}.tar.gz`;
      if (fs.existsSync(archivePath)) {
        fs.unlinkSync(archivePath);
      }

      throw error;
    }
  }

  /**
   * Export a single collection using Mongoose
   * @param {string} collectionKey - Key from modelRegistry
   * @returns {Promise<Object>} { documents, count }
   */
  async exportCollection(collectionKey) {
    const registryEntry = modelRegistry[collectionKey];
    if (!registryEntry) {
      throw new Error(`Unknown collection: ${collectionKey}`);
    }

    const { model, excludeFields, isSingleton } = registryEntry;

    // Build projection to exclude sensitive fields
    const projection = {};
    if (excludeFields && excludeFields.length > 0) {
      excludeFields.forEach(field => {
        projection[field] = 0;
      });
    }

    // Fetch documents
    let documents;
    if (isSingleton) {
      const doc = await model.findOne({}, projection).lean();
      documents = doc ? [doc] : [];
    } else {
      documents = await model.find({}, projection).lean();
    }

    // Convert ObjectIds and Dates to serializable format
    const serializedDocs = documents.map(doc => this.serializeDocument(doc));

    return {
      documents: serializedDocs,
      count: serializedDocs.length
    };
  }

  /**
   * Serialize a document for JSON export (handle ObjectIds, Dates, etc.)
   * @param {Object} doc - Mongoose document (lean)
   * @returns {Object} Serialized document
   */
  serializeDocument(doc) {
    if (!doc) return doc;
    
    const serialized = {};
    
    for (const [key, value] of Object.entries(doc)) {
      if (value === null || value === undefined) {
        serialized[key] = value;
      } else if (value._bsontype === 'ObjectId' || (value.constructor && value.constructor.name === 'ObjectId')) {
        // Handle ObjectId
        serialized[key] = { $oid: value.toString() };
      } else if (value instanceof Date) {
        // Handle Date
        serialized[key] = { $date: value.toISOString() };
      } else if (Array.isArray(value)) {
        // Handle arrays
        serialized[key] = value.map(item => 
          typeof item === 'object' ? this.serializeDocument(item) : item
        );
      } else if (typeof value === 'object') {
        // Handle nested objects
        serialized[key] = this.serializeDocument(value);
      } else {
        serialized[key] = value;
      }
    }
    
    return serialized;
  }

  /**
   * Deserialize a document from JSON (restore ObjectIds, Dates, etc.)
   * @param {Object} doc - Serialized document
   * @returns {Object} Deserialized document
   */
  deserializeDocument(doc) {
    if (!doc) return doc;
    
    const deserialized = {};
    
    for (const [key, value] of Object.entries(doc)) {
      if (value === null || value === undefined) {
        deserialized[key] = value;
      } else if (value.$oid) {
        // Handle ObjectId
        deserialized[key] = new mongoose.Types.ObjectId(value.$oid);
      } else if (value.$date) {
        // Handle Date
        deserialized[key] = new Date(value.$date);
      } else if (Array.isArray(value)) {
        // Handle arrays
        deserialized[key] = value.map(item => 
          typeof item === 'object' ? this.deserializeDocument(item) : item
        );
      } else if (typeof value === 'object') {
        // Handle nested objects
        deserialized[key] = this.deserializeDocument(value);
      } else {
        deserialized[key] = value;
      }
    }
    
    return deserialized;
  }

  /**
   * Copy audit log files
   * @param {string} destPath - Destination path
   */
  async copyAuditLogFiles(destPath) {
    try {
      const sourcePath = path.join(__dirname, '../../audit-logs');
      
      if (!fs.existsSync(sourcePath)) {
        console.log('ℹ️ No audit logs directory found');
        return;
      }

      fs.mkdirSync(destPath, { recursive: true });
      
      const files = fs.readdirSync(sourcePath);
      for (const file of files) {
        const sourceFile = path.join(sourcePath, file);
        const destFile = path.join(destPath, file);
        
        if (fs.statSync(sourceFile).isFile()) {
          fs.copyFileSync(sourceFile, destFile);
        }
      }

      console.log(`  ✓ Audit log files copied (${files.length} files)`);
    } catch (error) {
      console.warn(`  ⚠️ Audit log files copy failed: ${error.message}`);
    }
  }

  /**
   * Copy screenshots
   * @param {string} destPath - Destination path
   */
  async copyScreenshots(destPath) {
    try {
      const sourcePath = process.env.SCREENSHOTS_DIRECTORY || 
        path.join(__dirname, '../../../robert-agent-service/screenshots');
      
      if (!fs.existsSync(sourcePath)) {
        console.log('ℹ️ No screenshots directory found');
        return;
      }

      fs.mkdirSync(destPath, { recursive: true });
      
      const maxScreenshots = 1000;
      const files = fs.readdirSync(sourcePath).slice(0, maxScreenshots);
      
      for (const file of files) {
        const sourceFile = path.join(sourcePath, file);
        const destFile = path.join(destPath, file);
        
        if (fs.statSync(sourceFile).isFile()) {
          fs.copyFileSync(sourceFile, destFile);
        }
      }

      console.log(`  ✓ Screenshots copied (${files.length} files)`);
    } catch (error) {
      console.warn(`  ⚠️ Screenshots copy failed: ${error.message}`);
    }
  }

  /**
   * Create compressed archive
   * @param {string} sourcePath - Source directory
   * @param {string} archivePath - Archive file path
   */
  async createArchive(sourcePath, archivePath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(archivePath);
      const archive = archiver('tar', {
        gzip: true,
        gzipOptions: { level: 6 }
      });

      output.on('close', () => {
        console.log(`📦 Archive created: ${archivePath}`);
        resolve();
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      archive.directory(sourcePath, false);
      archive.finalize();
    });
  }

  /**
   * List all backups
   * @returns {Promise<Array>} Array of backup metadata
   */
  async listBackups() {
    try {
      const backups = [];

      if (!fs.existsSync(this.backupDirectory)) {
        return backups;
      }

      const files = fs.readdirSync(this.backupDirectory);
      
      for (const file of files) {
        if (file.endsWith('.tar.gz')) {
          const filePath = path.join(this.backupDirectory, file);
          const stats = fs.statSync(filePath);
          const backupId = file.replace('.tar.gz', '');

          backups.push({
            backupId,
            fileName: file,
            filePath,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
          });
        }
      }

      // Sort by creation date (newest first)
      backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return backups;
    } catch (error) {
      console.error('Error listing backups:', error);
      throw error;
    }
  }

  /**
   * Get backup details (extract and read metadata)
   * @param {string} backupId - Backup ID
   * @returns {Promise<Object>} Backup details with metadata
   */
  async getBackupDetails(backupId) {
    try {
      const backupFile = path.join(this.backupDirectory, `${backupId}.tar.gz`);
      
      if (!fs.existsSync(backupFile)) {
        throw new Error('Backup not found');
      }

      const stats = fs.statSync(backupFile);
      
      // Try to extract and read metadata
      let metadata = null;
      try {
        const backupData = await this.extractBackupData(backupId);
        metadata = backupData.metadata;
      } catch (e) {
        console.warn(`Could not read backup metadata: ${e.message}`);
      }

      return {
        backupId,
        fileName: `${backupId}.tar.gz`,
        filePath: backupFile,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        exists: true,
        metadata: metadata || {
          backupId,
          timestamp: stats.birthtime.toISOString(),
          version: 'unknown'
        }
      };
    } catch (error) {
      console.error('Error getting backup details:', error);
      throw error;
    }
  }

  /**
   * Extract and read backup data from archive
   * @param {string} backupId - Backup ID
   * @returns {Promise<Object>} Backup data (metadata + data)
   */
  async extractBackupData(backupId) {
    const backupFile = path.join(this.backupDirectory, `${backupId}.tar.gz`);
    const extractPath = path.join(this.backupDirectory, `_temp_${backupId}`);

    try {
      if (!fs.existsSync(backupFile)) {
        throw new Error('Backup file not found');
      }

      // Create temp extraction directory
      fs.mkdirSync(extractPath, { recursive: true });

      // Extract archive
      await tar.extract({
        file: backupFile,
        cwd: extractPath
      });

      // Read backup data
      const dataFilePath = path.join(extractPath, 'backup-data.json');
      if (!fs.existsSync(dataFilePath)) {
        throw new Error('Backup data file not found in archive');
      }

      const backupData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));

      // Cleanup
      fs.rmSync(extractPath, { recursive: true, force: true });

      return backupData;
    } catch (error) {
      // Cleanup on error
      if (fs.existsSync(extractPath)) {
        fs.rmSync(extractPath, { recursive: true, force: true });
      }
      throw error;
    }
  }

  /**
   * Get restore preview (compare backup with current database state)
   * @param {string} backupId - Backup ID
   * @param {string[]} collections - Collections to preview (null = all from backup)
   * @returns {Promise<Object>} Preview/diff information
   */
  async getRestorePreview(backupId, collections = null) {
    try {
      const backupData = await this.extractBackupData(backupId);
      const preview = {
        backupId,
        backupTimestamp: backupData.metadata.timestamp,
        backupVersion: backupData.metadata.version,
        collections: {}
      };

      const collectionsToPreview = collections || backupData.metadata.collections;

      for (const collectionKey of collectionsToPreview) {
        if (!isValidModelKey(collectionKey)) continue;
        if (!backupData.data[collectionKey]) continue;

        const registryEntry = modelRegistry[collectionKey];
        const model = registryEntry.model;

        // Get current count
        const currentCount = await model.countDocuments();
        const backupCount = backupData.data[collectionKey].length;

        // Get IDs for comparison
        const currentDocs = await model.find({}, { _id: 1 }).lean();
        const currentIds = new Set(currentDocs.map(d => d._id.toString()));
        
        const backupIds = new Set(
          backupData.data[collectionKey]
            .filter(d => d._id)
            .map(d => d._id.$oid || d._id.toString())
        );

        // Calculate diff
        const newInBackup = [...backupIds].filter(id => !currentIds.has(id)).length;
        const deletedInBackup = [...currentIds].filter(id => !backupIds.has(id)).length;
        const existing = [...backupIds].filter(id => currentIds.has(id)).length;

        preview.collections[collectionKey] = {
          displayName: registryEntry.displayName,
          isSingleton: registryEntry.isSingleton,
          current: {
            count: currentCount
          },
          backup: {
            count: backupCount
          },
          diff: {
            toAdd: newInBackup,
            toUpdate: existing,
            toRemove: deletedInBackup
          }
        };
      }

      return preview;
    } catch (error) {
      console.error('Error generating restore preview:', error);
      throw error;
    }
  }

  /**
   * Restore from backup
   * @param {string} backupId - Backup ID
   * @param {Object} options - Restore options
   * @param {string[]} options.collections - Collections to restore (null = all)
   * @param {string} options.mode - 'overwrite' or 'merge'
   * @returns {Promise<Object>} Restore result
   */
  async restoreBackup(backupId, options = {}) {
    const {
      collections = null,
      mode = 'overwrite' // 'overwrite' or 'merge'
    } = options;

    const results = {
      success: true,
      backupId,
      mode,
      restored: {},
      errors: []
    };

    try {
      console.log(`🔄 Starting restore from backup: ${backupId} (mode: ${mode})`);

      // Emit restore started event
      websocketService.emitRestoreProgress({
        backupId,
        status: 'started',
        progress: 0,
        message: 'Extracting backup data...'
      });

      // Extract backup data
      const backupData = await this.extractBackupData(backupId);

      // Validate backup version
      if (!backupData.metadata || !backupData.metadata.version) {
        websocketService.emitRestoreProgress({
          backupId,
          status: 'failed',
          progress: 0,
          message: 'Invalid backup format: missing version',
          error: { message: 'Invalid backup format: missing version' }
        });
        throw new Error('Invalid backup format: missing version');
      }

      websocketService.emitRestoreProgress({
        backupId,
        status: 'in_progress',
        progress: 10,
        message: 'Validating backup data...'
      });

      const collectionsToRestore = collections || backupData.metadata.collections;

      // Sort by priority (configs first)
      const sortedCollections = collectionsToRestore
        .filter(key => isValidModelKey(key) && backupData.data[key])
        .sort((a, b) => {
          const prioA = modelRegistry[a]?.backupPriority || 99;
          const prioB = modelRegistry[b]?.backupPriority || 99;
          return prioA - prioB;
        });

      const totalCollections = sortedCollections.length;

      // Restore each collection
      for (let i = 0; i < sortedCollections.length; i++) {
        const collectionKey = sortedCollections[i];
        const progress = Math.round(10 + ((i + 1) / totalCollections) * 85); // 10-95%

        // Emit progress for each collection
        websocketService.emitRestoreProgress({
          backupId,
          status: 'in_progress',
          progress,
          currentCollection: collectionKey,
          processedCollections: i + 1,
          totalCollections,
          message: `Restoring ${collectionKey}...`
        });

        try {
          const restored = await this.restoreCollection(
            collectionKey, 
            backupData.data[collectionKey],
            mode
          );
          results.restored[collectionKey] = restored;
          console.log(`  ✓ ${collectionKey}: ${restored.count} documents`);
        } catch (error) {
          console.error(`  ❌ Failed to restore ${collectionKey}: ${error.message}`);
          results.errors.push({
            collection: collectionKey,
            error: error.message
          });
        }
      }

      if (results.errors.length > 0) {
        results.success = false;
      }

      console.log(`✅ Restore completed: ${Object.keys(results.restored).length} collections`);

      // Emit restore completed event
      websocketService.emitRestoreProgress({
        backupId,
        status: results.success ? 'completed' : 'completed_with_errors',
        progress: 100,
        message: results.success 
          ? `Restore completed: ${Object.keys(results.restored).length} collections restored`
          : `Restore completed with ${results.errors.length} errors`,
        restoredCount: Object.keys(results.restored).length,
        errorCount: results.errors.length
      });

      return results;
    } catch (error) {
      console.error(`❌ Restore failed: ${error.message}`);
      
      // Emit restore failed event
      websocketService.emitRestoreProgress({
        backupId,
        status: 'failed',
        progress: 0,
        message: `Restore failed: ${error.message}`,
        error: { message: error.message }
      });

      results.success = false;
      results.errors.push({ error: error.message });
      throw error;
    }
  }

  /**
   * Restore a single collection
   * @param {string} collectionKey - Collection key
   * @param {Array} documents - Documents to restore
   * @param {string} mode - 'overwrite' or 'merge'
   * @returns {Promise<Object>} Restore result
   */
  async restoreCollection(collectionKey, documents, mode) {
    const registryEntry = modelRegistry[collectionKey];
    if (!registryEntry) {
      throw new Error(`Unknown collection: ${collectionKey}`);
    }

    const { model, isSingleton } = registryEntry;

    // Deserialize documents (convert $oid, $date back to proper types)
    const deserializedDocs = documents.map(doc => this.deserializeDocumentSync(doc));

    if (mode === 'overwrite') {
      // Clear collection and insert all documents
      await model.deleteMany({});
      
      if (deserializedDocs.length > 0) {
        if (isSingleton) {
          await model.create(deserializedDocs[0]);
        } else {
          await model.insertMany(deserializedDocs, { ordered: false });
        }
      }
    } else {
      // Merge mode: upsert by _id
      for (const doc of deserializedDocs) {
        const id = doc._id;
        delete doc._id; // Remove _id for update
        
        if (id) {
          await model.findByIdAndUpdate(id, doc, { upsert: true, new: true });
        } else {
          await model.create(doc);
        }
      }
    }

    return {
      count: deserializedDocs.length,
      mode
    };
  }

  /**
   * Synchronous version of deserializeDocument
   * @param {Object} doc - Serialized document
   * @returns {Object} Deserialized document
   */
  deserializeDocumentSync(doc) {
    if (!doc) return doc;
    
    const deserialized = {};
    
    for (const [key, value] of Object.entries(doc)) {
      if (value === null || value === undefined) {
        deserialized[key] = value;
      } else if (value && value.$oid) {
        // Handle ObjectId
        deserialized[key] = new mongoose.Types.ObjectId(value.$oid);
      } else if (value && value.$date) {
        // Handle Date
        deserialized[key] = new Date(value.$date);
      } else if (Array.isArray(value)) {
        // Handle arrays
        deserialized[key] = value.map(item => 
          typeof item === 'object' && item !== null 
            ? this.deserializeDocumentSync(item) 
            : item
        );
      } else if (typeof value === 'object') {
        // Handle nested objects
        deserialized[key] = this.deserializeDocumentSync(value);
      } else {
        deserialized[key] = value;
      }
    }
    
    return deserialized;
  }

  /**
   * Delete backup
   * @param {string} backupId - Backup ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteBackup(backupId) {
    try {
      const backupFile = path.join(this.backupDirectory, `${backupId}.tar.gz`);
      
      if (!fs.existsSync(backupFile)) {
        throw new Error('Backup not found');
      }

      fs.unlinkSync(backupFile);
      console.log(`✅ Backup deleted: ${backupId}`);
      
      return true;
    } catch (error) {
      console.error('Error deleting backup:', error);
      throw error;
    }
  }

  /**
   * Validate backup file
   * @param {string} backupId - Backup ID
   * @returns {Promise<Object>} Validation result
   */
  async validateBackup(backupId) {
    try {
      const backupFile = path.join(this.backupDirectory, `${backupId}.tar.gz`);
      
      if (!fs.existsSync(backupFile)) {
        return {
          valid: false,
          error: 'Backup file not found'
        };
      }

      const stats = fs.statSync(backupFile);
      
      if (stats.size === 0) {
        return {
          valid: false,
          error: 'Backup file is empty'
        };
      }

      // Try to extract and validate data
      try {
        const backupData = await this.extractBackupData(backupId);
        
        if (!backupData.metadata || !backupData.data) {
          return {
            valid: false,
            error: 'Invalid backup structure'
          };
        }

        return {
          valid: true,
          size: stats.size,
          createdAt: stats.birthtime,
          version: backupData.metadata.version,
          collections: backupData.metadata.collections,
          totalDocuments: backupData.metadata.totalDocuments
        };
      } catch (extractError) {
        return {
          valid: false,
          error: `Failed to extract backup: ${extractError.message}`
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Get available collections for backup/restore UI
   * @returns {Object} Collection information
   */
  getAvailableCollections() {
    const collections = {};
    
    for (const [key, info] of Object.entries(modelRegistry)) {
      collections[key] = {
        displayName: info.displayName,
        category: info.category,
        isSingleton: info.isSingleton,
        hasExcludedFields: info.excludeFields.length > 0
      };
    }
    
    return collections;
  }

  /**
   * Format bytes to human readable
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default new BackupService();
