import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import archiver from 'archiver';
import tar from 'tar';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Backup Service
 * Handles system backups including MongoDB dumps and configuration files
 */
class BackupService {
  constructor() {
    this.backupDirectory = process.env.BACKUP_DIRECTORY || path.join(__dirname, '../../backups');
    this.mongoUri = process.env.MONGO_URI;
    this.dbName = this.extractDbName(this.mongoUri);
    
    // Ensure backup directory exists
    this.ensureBackupDirectory();
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
   * Ensure backup directory exists
   */
  ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDirectory)) {
      fs.mkdirSync(this.backupDirectory, { recursive: true });
    }
  }

  /**
   * Create system backup
   * @param {Object} options - Backup options
   * @returns {Promise<Object>} Backup result
   */
  async createBackup(options = {}) {
    const {
      includeScreenshots = false,
      includeAuditLogs = true,
      collections = null // null = all collections
    } = options;

    const backupId = `backup-${Date.now()}`;
    const backupPath = path.join(this.backupDirectory, backupId);
    const timestamp = new Date().toISOString();

    try {
      console.log(`🔄 Starting backup: ${backupId}`);

      // Create backup directory
      fs.mkdirSync(backupPath, { recursive: true });

      // Step 1: Create MongoDB dump
      const mongoDumpPath = path.join(backupPath, 'mongodb-dump');
      await this.createMongoDBDump(mongoDumpPath, collections);

      // Step 2: Export configuration files (if any)
      const configPath = path.join(backupPath, 'config');
      await this.exportConfigurations(configPath);

      // Step 3: Include audit logs if requested
      if (includeAuditLogs) {
        const auditLogsPath = path.join(backupPath, 'audit-logs');
        await this.copyAuditLogs(auditLogsPath);
      }

      // Step 4: Include screenshots if requested
      if (includeScreenshots) {
        const screenshotsPath = path.join(backupPath, 'screenshots');
        await this.copyScreenshots(screenshotsPath);
      }

      // Step 5: Create metadata file
      const metadata = {
        backupId,
        timestamp,
        dbName: this.dbName,
        collections: collections || 'all',
        includeScreenshots,
        includeAuditLogs,
        size: await this.calculateBackupSize(backupPath),
        version: '1.0'
      };

      fs.writeFileSync(
        path.join(backupPath, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );

      // Step 6: Create compressed archive
      const archivePath = `${backupPath}.tar.gz`;
      await this.createArchive(backupPath, archivePath);

      // Step 7: Remove uncompressed directory
      fs.rmSync(backupPath, { recursive: true, force: true });

      console.log(`✅ Backup created: ${backupId}`);

      return {
        success: true,
        backupId,
        filePath: archivePath,
        size: await this.getFileSize(archivePath),
        timestamp,
        metadata
      };
    } catch (error) {
      console.error(`❌ Backup failed: ${error.message}`);
      
      // Cleanup on failure
      if (fs.existsSync(backupPath)) {
        fs.rmSync(backupPath, { recursive: true, force: true });
      }

      throw error;
    }
  }

  /**
   * Create MongoDB dump
   * @param {string} dumpPath - Path to save dump
   * @param {Array|null} collections - Specific collections to backup (null = all)
   * @returns {Promise<void>}
   */
  async createMongoDBDump(dumpPath, collections = null) {
    try {
      fs.mkdirSync(dumpPath, { recursive: true });

      let command = `mongodump --uri="${this.mongoUri}" --out="${dumpPath}"`;

      // Add collection filter if specified
      if (collections && Array.isArray(collections) && collections.length > 0) {
        const collectionArgs = collections.map(c => `--collection=${c}`).join(' ');
        command += ` ${collectionArgs}`;
      }

      console.log(`📦 Creating MongoDB dump...`);
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      if (stderr && !stderr.includes('writing')) {
        console.warn('⚠️ MongoDB dump warnings:', stderr);
      }

      console.log(`✅ MongoDB dump created`);
    } catch (error) {
      console.error(`❌ MongoDB dump failed:`, error);
      throw new Error(`MongoDB dump failed: ${error.message}`);
    }
  }

  /**
   * Export configurations
   * @param {string} configPath - Path to save configs
   * @returns {Promise<void>}
   */
  async exportConfigurations(configPath) {
    try {
      fs.mkdirSync(configPath, { recursive: true });

      // Export configurations from MongoDB
      const configs = await this.exportConfigsFromDB();
      
      fs.writeFileSync(
        path.join(configPath, 'configs.json'),
        JSON.stringify(configs, null, 2)
      );

      console.log(`✅ Configurations exported`);
    } catch (error) {
      console.warn(`⚠️ Configuration export failed:`, error.message);
      // Don't fail backup if config export fails
    }
  }

  /**
   * Export configs from database
   * @returns {Promise<Object>} Configuration data
   */
  async exportConfigsFromDB() {
    try {
      const configs = {};

      // Export AIConfig
      try {
        const AIConfig = (await import('../models/AIConfig.js')).default;
        configs.aiConfig = await AIConfig.findOne().lean();
      } catch (e) {
        console.warn('⚠️ Could not export AIConfig:', e.message);
      }

      // Export AudioConfig
      try {
        const AudioConfig = (await import('../models/AudioConfig.js')).default;
        configs.audioConfig = await AudioConfig.findOne().lean();
      } catch (e) {
        console.warn('⚠️ Could not export AudioConfig:', e.message);
      }

      // Export TelephonyConfig
      try {
        const TelephonyConfig = (await import('../models/TelephonyConfig.js')).default;
        configs.telephonyConfig = await TelephonyConfig.findOne().lean();
      } catch (e) {
        console.warn('⚠️ Could not export TelephonyConfig:', e.message);
      }

      // Export ToolConfig
      try {
        const ToolConfig = (await import('../models/ToolConfig.js')).default;
        configs.toolConfig = await ToolConfig.findOne().lean();
      } catch (e) {
        console.warn('⚠️ Could not export ToolConfig:', e.message);
      }

      // Export PrivacyConfig
      try {
        const PrivacyConfig = (await import('../models/PrivacyConfig.js')).default;
        configs.privacyConfig = await PrivacyConfig.findOne().lean();
      } catch (e) {
        console.warn('⚠️ Could not export PrivacyConfig:', e.message);
      }

      return configs;
    } catch (error) {
      console.warn('⚠️ Error exporting configs:', error.message);
      return {};
    }
  }

  /**
   * Copy audit logs
   * @param {string} auditLogsPath - Path to save audit logs
   * @returns {Promise<void>}
   */
  async copyAuditLogs(auditLogsPath) {
    try {
      const sourcePath = path.join(__dirname, '../../audit-logs');
      
      if (!fs.existsSync(sourcePath)) {
        console.log('ℹ️ No audit logs directory found');
        return;
      }

      fs.mkdirSync(auditLogsPath, { recursive: true });
      
      // Copy all audit log files
      const files = fs.readdirSync(sourcePath);
      for (const file of files) {
        const sourceFile = path.join(sourcePath, file);
        const destFile = path.join(auditLogsPath, file);
        
        if (fs.statSync(sourceFile).isFile()) {
          fs.copyFileSync(sourceFile, destFile);
        }
      }

      console.log(`✅ Audit logs copied`);
    } catch (error) {
      console.warn(`⚠️ Audit logs copy failed:`, error.message);
      // Don't fail backup if audit logs copy fails
    }
  }

  /**
   * Copy screenshots
   * @param {string} screenshotsPath - Path to save screenshots
   * @returns {Promise<void>}
   */
  async copyScreenshots(screenshotsPath) {
    try {
      const sourcePath = process.env.SCREENSHOTS_DIRECTORY || 
        path.join(__dirname, '../../../robert-agent-service/screenshots');
      
      if (!fs.existsSync(sourcePath)) {
        console.log('ℹ️ No screenshots directory found');
        return;
      }

      fs.mkdirSync(screenshotsPath, { recursive: true });
      
      // Copy screenshots (this can be large, so we might want to limit)
      const maxScreenshots = 1000; // Limit to prevent huge backups
      const files = fs.readdirSync(sourcePath).slice(0, maxScreenshots);
      
      for (const file of files) {
        const sourceFile = path.join(sourcePath, file);
        const destFile = path.join(screenshotsPath, file);
        
        if (fs.statSync(sourceFile).isFile()) {
          fs.copyFileSync(sourceFile, destFile);
        }
      }

      console.log(`✅ Screenshots copied (${files.length} files)`);
    } catch (error) {
      console.warn(`⚠️ Screenshots copy failed:`, error.message);
      // Don't fail backup if screenshots copy fails
    }
  }

  /**
   * Create compressed archive
   * @param {string} sourcePath - Source directory
   * @param {string} archivePath - Archive file path
   * @returns {Promise<void>}
   */
  async createArchive(sourcePath, archivePath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(archivePath);
      const archive = archiver('tar', {
        gzip: true,
        gzipOptions: { level: 6 }
      });

      output.on('close', () => {
        console.log(`✅ Archive created: ${archivePath} (${archive.pointer()} bytes)`);
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
   * Calculate backup size
   * @param {string} backupPath - Backup directory path
   * @returns {Promise<number>} Size in bytes
   */
  async calculateBackupSize(backupPath) {
    let totalSize = 0;

    const calculateDirSize = (dirPath) => {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          calculateDirSize(filePath);
        } else {
          totalSize += stats.size;
        }
      }
    };

    calculateDirSize(backupPath);
    return totalSize;
  }

  /**
   * Get file size
   * @param {string} filePath - File path
   * @returns {Promise<number>} Size in bytes
   */
  async getFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch {
      return 0;
    }
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
          
          // Try to extract metadata from filename or read metadata file
          const backupId = file.replace('.tar.gz', '');
          const metadataPath = path.join(this.backupDirectory, backupId, 'metadata.json');
          
          let metadata = null;
          if (fs.existsSync(metadataPath)) {
            try {
              metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            } catch (e) {
              // Metadata file doesn't exist (backup is compressed)
            }
          }

          backups.push({
            backupId,
            fileName: file,
            filePath,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            metadata: metadata || {
              backupId,
              timestamp: stats.birthtime.toISOString(),
              size: stats.size
            }
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
   * Get backup details
   * @param {string} backupId - Backup ID
   * @returns {Promise<Object>} Backup details
   */
  async getBackupDetails(backupId) {
    try {
      const backupFile = path.join(this.backupDirectory, `${backupId}.tar.gz`);
      
      if (!fs.existsSync(backupFile)) {
        throw new Error('Backup not found');
      }

      const stats = fs.statSync(backupFile);
      
      // Try to extract metadata (would need to extract archive, but for now use file stats)
      return {
        backupId,
        fileName: `${backupId}.tar.gz`,
        filePath: backupFile,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        exists: true
      };
    } catch (error) {
      console.error('Error getting backup details:', error);
      throw error;
    }
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
      
      // Basic validation: file exists and has size > 0
      if (stats.size === 0) {
        return {
          valid: false,
          error: 'Backup file is empty'
        };
      }

      // TODO: Could add more validation like checking archive integrity
      
      return {
        valid: true,
        size: stats.size,
        createdAt: stats.birthtime
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
}

export default new BackupService();

