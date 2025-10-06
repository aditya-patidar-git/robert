import openaiService from './openaiService.js';
import KnowledgeBase from '../models/KnowledgeBase.js';
import driftDetectionService from './driftDetectionService.js';

class ReingestService {
  constructor() {
    this.vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;
    this.reingestStatus = {
      isRunning: false,
      lastRun: null,
      filesProcessed: 0,
      filesFailed: 0,
      errors: []
    };
  }

  // Reingest all files or specific files
  async reingestFiles(fileIds = null) {
    try {
      console.log('🔄 Starting reingest process...');
      
      if (this.reingestStatus.isRunning) {
        throw new Error('Reingest is already running');
      }

      this.reingestStatus.isRunning = true;
      this.reingestStatus.lastRun = new Date();
      this.reingestStatus.filesProcessed = 0;
      this.reingestStatus.filesFailed = 0;
      this.reingestStatus.errors = [];

      // Get files to reingest
      const query = fileIds ? { _id: { $in: fileIds } } : { status: 'Active' };
      const filesToReingest = await KnowledgeBase.find(query);

      console.log(`📁 Found ${filesToReingest.length} files to reingest`);

      // Process each file
      for (const file of filesToReingest) {
        try {
          await this.reingestFile(file);
          this.reingestStatus.filesProcessed++;
        } catch (error) {
          console.error(`Error reingesting file ${file.title}:`, error);
          this.reingestStatus.filesFailed++;
          this.reingestStatus.errors.push({
            fileId: file._id,
            fileName: file.title,
            error: error.message
          });
        }
      }

      // Clear drift flags for successfully processed files
      if (this.reingestStatus.filesProcessed > 0) {
        const successfulFileIds = filesToReingest
          .filter((_, index) => index < this.reingestStatus.filesProcessed)
          .map(file => file._id);
        
        await driftDetectionService.clearDriftFlags(successfulFileIds);
      }

      this.reingestStatus.isRunning = false;

      console.log(`✅ Reingest completed. Processed: ${this.reingestStatus.filesProcessed}, Failed: ${this.reingestStatus.filesFailed}`);

      return {
        status: 'completed',
        filesProcessed: this.reingestStatus.filesProcessed,
        filesFailed: this.reingestStatus.filesFailed,
        errors: this.reingestStatus.errors,
        lastRun: this.reingestStatus.lastRun
      };

    } catch (error) {
      this.reingestStatus.isRunning = false;
      console.error('Error in reingest process:', error);
      throw new Error(`Reingest failed: ${error.message}`);
    }
  }

  // Reingest a single file
  async reingestFile(file) {
    try {
      console.log(`🔄 Reingesting file: ${file.title}`);

      // Update file status to processing
      await KnowledgeBase.findByIdAndUpdate(file._id, {
        status: 'Processing',
        lastIngested: new Date()
      });

      // Re-upload file to OpenAI vector store
      const openaiFile = await this.uploadFileToOpenAI(file);
      
      // Update file with new OpenAI file ID
      await KnowledgeBase.findByIdAndUpdate(file._id, {
        openaiFileId: openaiFile.id,
        status: 'Active',
        lastSynced: new Date(),
        hasDrift: false,
        driftScore: 0
      });

      console.log(`✅ Successfully reingested file: ${file.title}`);

    } catch (error) {
      // Update file status to error
      await KnowledgeBase.findByIdAndUpdate(file._id, {
        status: 'Error',
        lastIngested: new Date()
      });

      throw error;
    }
  }

  // Upload file to OpenAI vector store
  async uploadFileToOpenAI(file) {
    try {
      // Create a file object for OpenAI
      const fileContent = file.content;
      const fileName = file.filename || file.title;

      // Upload to OpenAI
      const openaiFile = await openaiService.uploadFile(fileContent, fileName);
      
      // Add to vector store
      await openaiService.addFileToVectorStore(this.vectorStoreId, openaiFile.id);

      return openaiFile;

    } catch (error) {
      console.error('Error uploading file to OpenAI:', error);
      throw new Error(`Failed to upload file to OpenAI: ${error.message}`);
    }
  }

  // Get reingest status
  getReingestStatus() {
    return {
      isRunning: this.reingestStatus.isRunning,
      lastRun: this.reingestStatus.lastRun,
      filesProcessed: this.reingestStatus.filesProcessed,
      filesFailed: this.reingestStatus.filesFailed,
      errors: this.reingestStatus.errors
    };
  }

  // Get files that need reingest
  async getFilesNeedingReingest() {
    try {
      const filesNeedingReingest = await KnowledgeBase.find({
        $or: [
          { hasDrift: true },
          { status: 'Error' },
          { lastIngested: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } // Older than 7 days
        ]
      }).sort({ lastIngested: 1 });

      return filesNeedingReingest.map(file => ({
        id: file._id,
        title: file.title,
        status: file.status,
        hasDrift: file.hasDrift,
        driftScore: file.driftScore,
        lastIngested: file.lastIngested,
        tags: file.tags
      }));

    } catch (error) {
      console.error('Error getting files needing reingest:', error);
      throw new Error(`Failed to get files needing reingest: ${error.message}`);
    }
  }

  // Schedule reingest for specific files
  async scheduleReingest(fileIds, delay = 0) {
    try {
      console.log(`📅 Scheduling reingest for ${fileIds.length} files`);
      
      if (delay > 0) {
        setTimeout(() => {
          this.reingestFiles(fileIds).catch(console.error);
        }, delay);
      } else {
        return await this.reingestFiles(fileIds);
      }

    } catch (error) {
      console.error('Error scheduling reingest:', error);
      throw new Error(`Failed to schedule reingest: ${error.message}`);
    }
  }
}

export default new ReingestService();





