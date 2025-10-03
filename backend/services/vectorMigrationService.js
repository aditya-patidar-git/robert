import openaiService from './openaiService.js';
import KnowledgeBase from '../models/KnowledgeBase.js';
import fs from 'fs';
import path from 'path';

class VectorMigrationService {
  constructor() {
    this.migrationStatus = {
      inProgress: false,
      lastMigration: null,
      totalFiles: 0,
      migratedFiles: 0,
      failedFiles: 0,
      errors: []
    };
  }

  // Migrate all knowledge base files to OpenAI
  async migrateAllFiles() {
    if (this.migrationStatus.inProgress) {
      throw new Error('Migration already in progress');
    }

    this.migrationStatus.inProgress = true;
    this.migrationStatus.errors = [];
    this.migrationStatus.migratedFiles = 0;
    this.migrationStatus.failedFiles = 0;

    try {
      console.log('🔄 Starting vector store migration...');

      // Get all active knowledge base files
      const kbFiles = await KnowledgeBase.find({ status: 'Active' });
      this.migrationStatus.totalFiles = kbFiles.length;

      console.log(`📁 Found ${kbFiles.length} files to migrate`);

      // Get or create vector store
      const vectorStore = await openaiService.getVectorStore();
      console.log(`📦 Using vector store: ${vectorStore.id}`);

      // Migrate each file
      for (const file of kbFiles) {
        try {
          await this.migrateFile(file);
          this.migrationStatus.migratedFiles++;
        } catch (error) {
          console.error(`❌ Failed to migrate file ${file.title}:`, error);
          this.migrationStatus.failedFiles++;
          this.migrationStatus.errors.push({
            fileId: file._id,
            title: file.title,
            error: error.message
          });
        }
      }

      this.migrationStatus.lastMigration = new Date();
      console.log(`✅ Migration completed: ${this.migrationStatus.migratedFiles} migrated, ${this.migrationStatus.failedFiles} failed`);

      return this.migrationStatus;
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    } finally {
      this.migrationStatus.inProgress = false;
    }
  }

  // Migrate a single file
  async migrateFile(kbFile) {
    try {
      console.log(`🔄 Migrating file: ${kbFile.title}`);

      // Check if file already has OpenAI file ID
      if (kbFile.openaiFileId) {
        console.log(`✅ File ${kbFile.title} already migrated`);
        return kbFile;
      }

      // Check if file exists on disk
      if (!fs.existsSync(kbFile.uploadPath)) {
        throw new Error(`File not found: ${kbFile.uploadPath}`);
      }

      // Upload file to OpenAI
      const openaiFile = await openaiService.uploadFile(
        kbFile.uploadPath,
        kbFile.originalName,
        kbFile.fileType
      );

      // Add file to vector store
      await openaiService.addFileToVectorStore(openaiFile.id);

      // Update knowledge base record
      kbFile.openaiFileId = openaiFile.id;
      kbFile.vectorStoreId = openaiService.vectorStoreId;
      kbFile.lastSynced = new Date();
      await kbFile.save();

      console.log(`✅ File ${kbFile.title} migrated successfully`);
      return kbFile;
    } catch (error) {
      console.error(`❌ Failed to migrate file ${kbFile.title}:`, error);
      throw error;
    }
  }

  // Re-migrate a specific file
  async remigrateFile(kbFileId) {
    try {
      const kbFile = await KnowledgeBase.findById(kbFileId);
      if (!kbFile) {
        throw new Error('Knowledge base file not found');
      }

      // Remove old file from vector store if exists
      if (kbFile.openaiFileId) {
        try {
          await openaiService.removeFileFromVectorStore(kbFile.openaiFileId);
        } catch (error) {
          console.warn(`⚠️ Could not remove old file ${kbFile.openaiFileId}:`, error);
        }
      }

      // Migrate the file again
      return await this.migrateFile(kbFile);
    } catch (error) {
      console.error(`❌ Failed to re-migrate file ${kbFileId}:`, error);
      throw error;
    }
  }

  // Sync file with vector store
  async syncFile(kbFileId) {
    try {
      const kbFile = await KnowledgeBase.findById(kbFileId);
      if (!kbFile) {
        throw new Error('Knowledge base file not found');
      }

      if (!kbFile.openaiFileId) {
        throw new Error('File not yet migrated to OpenAI');
      }

      // Check if file content has changed
      const currentContent = fs.readFileSync(kbFile.uploadPath, 'utf8');
      if (currentContent !== kbFile.content) {
        console.log(`📝 File content changed, re-migrating: ${kbFile.title}`);
        return await this.remigrateFile(kbFileId);
      }

      // Update sync timestamp
      kbFile.lastSynced = new Date();
      await kbFile.save();

      console.log(`✅ File ${kbFile.title} synced successfully`);
      return kbFile;
    } catch (error) {
      console.error(`❌ Failed to sync file ${kbFileId}:`, error);
      throw error;
    }
  }

  // Get migration status
  getMigrationStatus() {
    return {
      ...this.migrationStatus,
      isInProgress: this.migrationStatus.inProgress
    };
  }

  // Get files that need migration
  async getFilesNeedingMigration() {
    try {
      const files = await KnowledgeBase.find({
        status: 'Active',
        $or: [
          { openaiFileId: { $exists: false } },
          { openaiFileId: null },
          { lastSynced: { $exists: false } }
        ]
      });

      return files;
    } catch (error) {
      console.error('Error getting files needing migration:', error);
      throw error;
    }
  }

  // Get files that need re-sync
  async getFilesNeedingSync() {
    try {
      const files = await KnowledgeBase.find({
        status: 'Active',
        openaiFileId: { $exists: true, $ne: null },
        lastSynced: { $exists: true }
      });

      const needsSync = [];
      for (const file of files) {
        if (fs.existsSync(file.uploadPath)) {
          const currentContent = fs.readFileSync(file.uploadPath, 'utf8');
          if (currentContent !== file.content) {
            needsSync.push(file);
          }
        }
      }

      return needsSync;
    } catch (error) {
      console.error('Error getting files needing sync:', error);
      throw error;
    }
  }

  // Validate vector store integrity
  async validateVectorStore() {
    try {
      console.log('🔍 Validating vector store integrity...');

      const vectorStoreFiles = await openaiService.listVectorStoreFiles();
      const kbFiles = await KnowledgeBase.find({ 
        openaiFileId: { $exists: true, $ne: null } 
      });

      const validation = {
        totalVectorStoreFiles: vectorStoreFiles.length,
        totalKBFiles: kbFiles.length,
        missingInVectorStore: [],
        orphanedInVectorStore: [],
        syncIssues: []
      };

      // Check for KB files not in vector store
      for (const kbFile of kbFiles) {
        const inVectorStore = vectorStoreFiles.find(vf => vf.id === kbFile.openaiFileId);
        if (!inVectorStore) {
          validation.missingInVectorStore.push({
            kbFileId: kbFile._id,
            title: kbFile.title,
            openaiFileId: kbFile.openaiFileId
          });
        }
      }

      // Check for vector store files not in KB
      for (const vectorFile of vectorStoreFiles) {
        const inKB = kbFiles.find(kb => kb.openaiFileId === vectorFile.id);
        if (!inKB) {
          validation.orphanedInVectorStore.push({
            openaiFileId: vectorFile.id,
            filename: vectorFile.filename
          });
        }
      }

      console.log(`✅ Validation complete: ${validation.missingInVectorStore.length} missing, ${validation.orphanedInVectorStore.length} orphaned`);
      return validation;
    } catch (error) {
      console.error('Error validating vector store:', error);
      throw error;
    }
  }

  // Clean up orphaned files
  async cleanupOrphanedFiles() {
    try {
      console.log('🧹 Cleaning up orphaned files...');

      const validation = await this.validateVectorStore();
      let cleanedCount = 0;

      for (const orphaned of validation.orphanedInVectorStore) {
        try {
          await openaiService.removeFileFromVectorStore(orphaned.openaiFileId);
          cleanedCount++;
          console.log(`🗑️ Removed orphaned file: ${orphaned.filename}`);
        } catch (error) {
          console.error(`❌ Failed to remove orphaned file ${orphaned.openaiFileId}:`, error);
        }
      }

      console.log(`✅ Cleanup complete: ${cleanedCount} files removed`);
      return { cleanedCount, totalOrphaned: validation.orphanedInVectorStore.length };
    } catch (error) {
      console.error('Error cleaning up orphaned files:', error);
      throw error;
    }
  }
}

export default new VectorMigrationService();
