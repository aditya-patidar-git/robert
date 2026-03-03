import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import tar from 'tar';
import mongoose from 'mongoose';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Restore Service
 * Handles system restore from backups with safety measures
 */
class RestoreService {
  constructor() {
    this.backupDirectory = process.env.BACKUP_DIRECTORY || path.join(__dirname, '../../backups');
    this.mongoUri = process.env.MONGO_URI;
    this.dbName = this.extractDbName(this.mongoUri);
    this.tempRestorePath = path.join(this.backupDirectory, 'temp-restore');
  }

  /**
   * Extract database name from MongoDB URI
   * @param {string} mongoUri - MongoDB connection string
   * @returns {string} Database name
   */
  extractDbName(mongoUri) {
    try {
      const match = mongoUri.match(/\/([^/?]+)(\?|$)/);
      return match ? match[1] : 'robert-ai';
    } catch {
      return 'robert-ai';
    }
  }

  /**
   * Restore system from backup
   * @param {string} backupId - Backup ID
   * @param {Object} options - Restore options
   * @returns {Promise<Object>} Restore result
   */
  async restoreBackup(backupId, options = {}) {
    const {
      createSafetyBackup = true,
      collections = null, // null = all collections
      dryRun = false
    } = options;

    const backupFile = path.join(this.backupDirectory, `${backupId}.tar.gz`);
    
    if (!fs.existsSync(backupFile)) {
      throw new Error(`Backup file not found: ${backupId}`);
    }

    try {
      console.log(`🔄 Starting restore from backup: ${backupId}`);

      // Step 1: Validate backup
      const validation = await this.validateBackup(backupId);
      if (!validation.valid) {
        throw new Error(`Backup validation failed: ${validation.error}`);
      }

      // Step 2: Create safety backup if requested
      let safetyBackupId = null;
      if (createSafetyBackup && !dryRun) {
        console.log('🛡️ Creating safety backup before restore...');
        const backupService = (await import('./backupService.js')).default;
        const safetyBackup = await backupService.createBackup({
          includeScreenshots: false,
          includeAuditLogs: false
        });
        safetyBackupId = safetyBackup.backupId;
        console.log(`✅ Safety backup created: ${safetyBackupId}`);
      }

      // Step 3: Extract backup archive
      if (!dryRun) {
        await this.extractBackup(backupFile, this.tempRestorePath);
      } else {
        console.log('🔍 [DRY RUN] Would extract backup archive');
      }

      // Step 4: Restore MongoDB
      if (!dryRun) {
        const mongoDumpPath = path.join(this.tempRestorePath, 'mongodb-dump');
        if (fs.existsSync(mongoDumpPath)) {
          await this.restoreMongoDB(mongoDumpPath, collections);
        }
      } else {
        console.log('🔍 [DRY RUN] Would restore MongoDB');
      }

      // Step 5: Restore configurations
      if (!dryRun) {
        const configPath = path.join(this.tempRestorePath, 'config');
        if (fs.existsSync(configPath)) {
          await this.restoreConfigurations(configPath);
        }
      } else {
        console.log('🔍 [DRY RUN] Would restore configurations');
      }

      // Step 6: Restore audit logs (optional)
      if (!dryRun) {
        const auditLogsPath = path.join(this.tempRestorePath, 'audit-logs');
        if (fs.existsSync(auditLogsPath)) {
          await this.restoreAuditLogs(auditLogsPath);
        }
      } else {
        console.log('🔍 [DRY RUN] Would restore audit logs');
      }

      // Step 7: Cleanup temp directory
      if (!dryRun && fs.existsSync(this.tempRestorePath)) {
        fs.rmSync(this.tempRestorePath, { recursive: true, force: true });
      }

      console.log(`✅ Restore completed: ${backupId}`);

      return {
        success: true,
        backupId,
        safetyBackupId,
        dryRun,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ Restore failed: ${error.message}`);
      
      // Cleanup on failure
      if (fs.existsSync(this.tempRestorePath)) {
        fs.rmSync(this.tempRestorePath, { recursive: true, force: true });
      }

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

      // Try to extract and check structure
      try {
        const tempExtractPath = path.join(this.backupDirectory, 'temp-validate');
        fs.mkdirSync(tempExtractPath, { recursive: true });
        
        await tar.extract({
          file: backupFile,
          cwd: tempExtractPath
        });

        // Check for required directories
        const hasMongoDump = fs.existsSync(path.join(tempExtractPath, 'mongodb-dump'));
        const hasMetadata = fs.existsSync(path.join(tempExtractPath, 'metadata.json'));

        // Cleanup
        fs.rmSync(tempExtractPath, { recursive: true, force: true });

        if (!hasMongoDump) {
          return {
            valid: false,
            error: 'Backup does not contain MongoDB dump'
          };
        }

        return {
          valid: true,
          size: stats.size,
          hasMetadata,
          createdAt: stats.birthtime
        };
      } catch (extractError) {
        return {
          valid: false,
          error: `Backup archive is corrupted: ${extractError.message}`
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
   * Extract backup archive
   * @param {string} backupFile - Backup file path
   * @param {string} extractPath - Path to extract to
   * @returns {Promise<void>}
   */
  async extractBackup(backupFile, extractPath) {
    try {
      // Clean up temp directory if it exists
      if (fs.existsSync(extractPath)) {
        fs.rmSync(extractPath, { recursive: true, force: true });
      }

      fs.mkdirSync(extractPath, { recursive: true });

      console.log(`📦 Extracting backup archive...`);
      
      await tar.extract({
        file: backupFile,
        cwd: extractPath
      });

      console.log(`✅ Backup extracted`);
    } catch (error) {
      console.error(`❌ Backup extraction failed:`, error);
      throw new Error(`Backup extraction failed: ${error.message}`);
    }
  }

  /**
   * Restore MongoDB from dump
   * @param {string} dumpPath - Path to MongoDB dump
   * @param {Array|null} collections - Specific collections to restore (null = all)
   * @returns {Promise<void>}
   */
  async restoreMongoDB(dumpPath, collections = null) {
    try {
      // Find the actual dump directory (mongodump creates a subdirectory with db name)
      const dumpDirs = fs.readdirSync(dumpPath);
      const dbDumpPath = dumpDirs.length > 0 
        ? path.join(dumpPath, dumpDirs[0])
        : dumpPath;

      if (!fs.existsSync(dbDumpPath)) {
        throw new Error('MongoDB dump directory not found');
      }

      let command = `mongorestore --uri="${this.mongoUri}" --drop "${dbDumpPath}"`;

      // Add collection filter if specified
      if (collections && Array.isArray(collections) && collections.length > 0) {
        const collectionArgs = collections.map(c => `--collection=${c}`).join(' ');
        command += ` ${collectionArgs}`;
      } else {
        // Restore all collections
        command += ` --drop`; // Drop existing collections before restore
      }

      console.log(`📦 Restoring MongoDB...`);
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      if (stderr && !stderr.includes('restoring')) {
        console.warn('⚠️ MongoDB restore warnings:', stderr);
      }

      console.log(`✅ MongoDB restored`);
    } catch (error) {
      console.error(`❌ MongoDB restore failed:`, error);
      throw new Error(`MongoDB restore failed: ${error.message}`);
    }
  }

  /**
   * Restore configurations
   * @param {string} configPath - Path to config files
   * @returns {Promise<void>}
   */
  async restoreConfigurations(configPath) {
    try {
      const configsFile = path.join(configPath, 'configs.json');
      
      if (!fs.existsSync(configsFile)) {
        console.log('ℹ️ No configuration file found in backup');
        return;
      }

      let configs;
      try {
        configs = JSON.parse(fs.readFileSync(configsFile, 'utf8'));
      } catch (parseErr) {
        console.warn('⚠️ Invalid configs JSON in backup:', parseErr.message);
        return;
      }

      // Restore AIConfig
      if (configs.aiConfig) {
        try {
          const AIConfig = (await import('../models/AIConfig.js')).default;
          await AIConfig.findOneAndUpdate(
            { name: configs.aiConfig.name || 'default' },
            { $set: configs.aiConfig },
            { upsert: true, new: true }
          );
          console.log('✅ AIConfig restored');
        } catch (e) {
          console.warn('⚠️ Could not restore AIConfig:', e.message);
        }
      }

      // Restore AudioConfig
      if (configs.audioConfig) {
        try {
          const AudioConfig = (await import('../models/AudioConfig.js')).default;
          await AudioConfig.findOneAndUpdate(
            { name: configs.audioConfig.name || 'default' },
            { $set: configs.audioConfig },
            { upsert: true, new: true }
          );
          console.log('✅ AudioConfig restored');
        } catch (e) {
          console.warn('⚠️ Could not restore AudioConfig:', e.message);
        }
      }

      // Restore TelephonyConfig
      if (configs.telephonyConfig) {
        try {
          const TelephonyConfig = (await import('../models/TelephonyConfig.js')).default;
          await TelephonyConfig.findOneAndUpdate(
            { name: configs.telephonyConfig.name || 'default' },
            { $set: configs.telephonyConfig },
            { upsert: true, new: true }
          );
          console.log('✅ TelephonyConfig restored');
        } catch (e) {
          console.warn('⚠️ Could not restore TelephonyConfig:', e.message);
        }
      }

      // Restore ToolConfig
      if (configs.toolConfig) {
        try {
          const ToolConfig = (await import('../models/ToolConfig.js')).default;
          await ToolConfig.findOneAndUpdate(
            { name: configs.toolConfig.name || 'default' },
            { $set: configs.toolConfig },
            { upsert: true, new: true }
          );
          console.log('✅ ToolConfig restored');
        } catch (e) {
          console.warn('⚠️ Could not restore ToolConfig:', e.message);
        }
      }

      // Restore PrivacyConfig
      if (configs.privacyConfig) {
        try {
          const PrivacyConfig = (await import('../models/PrivacyConfig.js')).default;
          await PrivacyConfig.findOneAndUpdate(
            { name: configs.privacyConfig.name || 'default' },
            { $set: configs.privacyConfig },
            { upsert: true, new: true }
          );
          console.log('✅ PrivacyConfig restored');
        } catch (e) {
          console.warn('⚠️ Could not restore PrivacyConfig:', e.message);
        }
      }

      console.log(`✅ Configurations restored`);
    } catch (error) {
      console.warn(`⚠️ Configuration restore failed:`, error.message);
      // Don't fail restore if config restore fails
    }
  }

  /**
   * Audit logs and DSAR exports are stored in MongoDB only; no file restore.
   * @param {string} _auditLogsPath - Unused (kept for API compatibility)
   */
  async restoreAuditLogs(_auditLogsPath) {
    console.log('ℹ️ Audit logs are stored in MongoDB only; skipping file restore.');
  }

  /**
   * Get restore preview (dry run)
   * @param {string} backupId - Backup ID
   * @returns {Promise<Object>} Preview result
   */
  async getRestorePreview(backupId) {
    try {
      const validation = await this.validateBackup(backupId);
      
      if (!validation.valid) {
        return {
          canRestore: false,
          error: validation.error
        };
      }

      // Extract and read metadata
      const backupFile = path.join(this.backupDirectory, `${backupId}.tar.gz`);
      const tempExtractPath = path.join(this.backupDirectory, 'temp-preview');
      
      try {
        fs.mkdirSync(tempExtractPath, { recursive: true });
        
        await tar.extract({
          file: backupFile,
          cwd: tempExtractPath
        });

        let metadata = null;
        const metadataPath = path.join(tempExtractPath, 'metadata.json');
        if (fs.existsSync(metadataPath)) {
          try {
            metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
          } catch (parseErr) {
            console.warn('⚠️ Invalid metadata.json in backup:', parseErr.message);
          }
        }

        // List collections in dump
        const mongoDumpPath = path.join(tempExtractPath, 'mongodb-dump');
        let collections = [];
        if (fs.existsSync(mongoDumpPath)) {
          const dumpDirs = fs.readdirSync(mongoDumpPath);
          if (dumpDirs.length > 0) {
            const dbDumpPath = path.join(mongoDumpPath, dumpDirs[0]);
            if (fs.existsSync(dbDumpPath)) {
              collections = fs.readdirSync(dbDumpPath)
                .filter(item => {
                  const itemPath = path.join(dbDumpPath, item);
                  return fs.statSync(itemPath).isDirectory();
                });
            }
          }
        }

        // Cleanup
        fs.rmSync(tempExtractPath, { recursive: true, force: true });

        return {
          canRestore: true,
          backupId,
          metadata,
          collections,
          size: validation.size,
          createdAt: validation.createdAt
        };
      } catch (extractError) {
        // Cleanup on error
        if (fs.existsSync(tempExtractPath)) {
          fs.rmSync(tempExtractPath, { recursive: true, force: true });
        }
        throw extractError;
      }
    } catch (error) {
      return {
        canRestore: false,
        error: error.message
      };
    }
  }
}

export default new RestoreService();

