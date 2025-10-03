import axios from 'axios';
import KnowledgeBase from '../models/KnowledgeBase.js';

class DriftDetectionService {
  constructor() {
    this.driftThreshold = 0.8; // Similarity threshold for drift detection
    this.checkInterval = 24 * 60 * 60 * 1000; // 24 hours
    this.lastCheck = null;
  }

  // Check for content drift by comparing KB content with live website
  async detectDrift() {
    try {
      console.log('🔍 Starting drift detection...');
      
      const kbFiles = await KnowledgeBase.find({ status: 'Active' });
      const driftResults = [];

      for (const file of kbFiles) {
        try {
          const driftResult = await this.checkFileDrift(file);
          if (driftResult.hasDrift) {
            driftResults.push(driftResult);
          }
        } catch (error) {
          console.error(`Error checking drift for file ${file.title}:`, error);
        }
      }

      this.lastCheck = new Date();
      
      console.log(`✅ Drift detection completed. Found ${driftResults.length} files with drift`);
      return {
        totalFiles: kbFiles.length,
        filesWithDrift: driftResults.length,
        driftResults,
        lastCheck: this.lastCheck
      };

    } catch (error) {
      console.error('Error in drift detection:', error);
      throw new Error(`Drift detection failed: ${error.message}`);
    }
  }

  // Check drift for a specific file
  async checkFileDrift(file) {
    try {
      // For now, simulate drift detection by checking file age and content
      // In a real implementation, this would compare with live website content
      const fileAge = Date.now() - new Date(file.updatedAt).getTime();
      const daysSinceUpdate = fileAge / (1000 * 60 * 60 * 24);
      
      // Simulate drift based on file age and content changes
      const hasDrift = daysSinceUpdate > 30 || this.simulateContentChange(file);
      
      if (hasDrift) {
        // Update file with drift flag
        await KnowledgeBase.findByIdAndUpdate(file._id, {
          hasDrift: true,
          driftScore: Math.random() * 0.5 + 0.3, // Simulate drift score
          lastDriftCheck: new Date()
        });

        return {
          fileId: file._id,
          fileName: file.title,
          hasDrift: true,
          driftScore: Math.random() * 0.5 + 0.3,
          lastUpdated: file.updatedAt,
          daysSinceUpdate: Math.floor(daysSinceUpdate),
          reason: daysSinceUpdate > 30 ? 'Content may be outdated' : 'Content structure changed'
        };
      }

      return {
        fileId: file._id,
        fileName: file.title,
        hasDrift: false,
        driftScore: 0,
        lastUpdated: file.updatedAt,
        daysSinceUpdate: Math.floor(daysSinceUpdate)
      };

    } catch (error) {
      console.error(`Error checking drift for file ${file.title}:`, error);
      throw error;
    }
  }

  // Simulate content change detection
  simulateContentChange(file) {
    // Simulate drift based on file characteristics
    const driftProbability = 0.1; // 10% chance of drift
    return Math.random() < driftProbability;
  }

  // Get drift detection status
  getDriftStatus() {
    return {
      lastCheck: this.lastCheck,
      checkInterval: this.checkInterval,
      driftThreshold: this.driftThreshold,
      isCheckNeeded: this.isCheckNeeded()
    };
  }

  // Check if drift detection is needed
  isCheckNeeded() {
    if (!this.lastCheck) return true;
    return (Date.now() - this.lastCheck.getTime()) > this.checkInterval;
  }

  // Get files with drift
  async getFilesWithDrift() {
    try {
      const filesWithDrift = await KnowledgeBase.find({ 
        hasDrift: true,
        status: 'Active'
      }).sort({ lastDriftCheck: -1 });

      return filesWithDrift.map(file => ({
        id: file._id,
        title: file.title,
        driftScore: file.driftScore,
        lastDriftCheck: file.lastDriftCheck,
        lastUpdated: file.updatedAt,
        tags: file.tags,
        status: file.status
      }));

    } catch (error) {
      console.error('Error getting files with drift:', error);
      throw new Error(`Failed to get files with drift: ${error.message}`);
    }
  }

  // Clear drift flags (after reingest)
  async clearDriftFlags(fileIds) {
    try {
      const result = await KnowledgeBase.updateMany(
        { _id: { $in: fileIds } },
        { 
          hasDrift: false, 
          driftScore: 0,
          lastDriftCheck: new Date()
        }
      );

      console.log(`✅ Cleared drift flags for ${result.modifiedCount} files`);
      return result;

    } catch (error) {
      console.error('Error clearing drift flags:', error);
      throw new Error(`Failed to clear drift flags: ${error.message}`);
    }
  }

  // Start periodic drift detection
  startPeriodicDetection() {
    console.log('🔄 Starting periodic drift detection...');
    
    // Run immediately
    this.detectDrift().catch(console.error);
    
    // Then run every 24 hours
    setInterval(() => {
      if (this.isCheckNeeded()) {
        this.detectDrift().catch(console.error);
      }
    }, this.checkInterval);
  }
}

export default new DriftDetectionService();
