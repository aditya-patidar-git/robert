import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AudioStorageService {
  constructor() {
    // Store audio files in backend/audio-previews directory
    this.audioDir = path.join(__dirname, '../audio-previews');
    this.maxFileAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    // Ensure directory exists
    this.ensureDirectoryExists();
    
    // Start cleanup interval (run every hour)
    this.startCleanupInterval();
  }

  /**
   * Ensure the audio previews directory exists
   */
  ensureDirectoryExists() {
    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
      console.log(`✅ [AudioStorage] Created audio previews directory: ${this.audioDir}`);
    }
  }

  /**
   * Generate a unique filename for audio preview
   * @param {string} voiceId - Voice ID
   * @param {string} text - Preview text (used for hash)
   * @returns {string} Filename
   */
  generateFilename(voiceId, text) {
    // Create a hash from voiceId + text to reuse same file for same content
    const hash = crypto
      .createHash('md5')
      .update(`${voiceId}-${text}`)
      .digest('hex')
      .substring(0, 12);
    
    const timestamp = Date.now();
    return `preview-${voiceId}-${hash}-${timestamp}.mp3`;
  }

  /**
   * Save audio buffer to file
   * @param {Buffer} audioBuffer - Audio file buffer
   * @param {string} voiceId - Voice ID
   * @param {string} text - Preview text
   * @returns {Promise<{filename: string, filepath: string, url: string}>}
   */
  async saveAudio(audioBuffer, voiceId, text) {
    try {
      const filename = this.generateFilename(voiceId, text);
      const filepath = path.join(this.audioDir, filename);
      
      // Write file
      await fs.promises.writeFile(filepath, audioBuffer);
      
      // Generate URL (relative to API base)
      const url = `/api/admin/audio-telephony/audio-previews/${filename}`;
      
      console.log(`✅ [AudioStorage] Saved audio preview: ${filename} (${audioBuffer.length} bytes)`);
      
      return {
        filename,
        filepath,
        url
      };
    } catch (error) {
      console.error('❌ [AudioStorage] Error saving audio:', error);
      throw new Error(`Failed to save audio file: ${error.message}`);
    }
  }

  /**
   * Get audio file path
   * @param {string} filename - Filename
   * @returns {string} Full file path
   */
  getAudioPath(filename) {
    // Security: prevent directory traversal
    const safeFilename = path.basename(filename);
    const filepath = path.join(this.audioDir, safeFilename);
    
    // Ensure file is within audio directory
    if (!filepath.startsWith(this.audioDir)) {
      throw new Error('Invalid file path');
    }
    
    return filepath;
  }

  /**
   * Check if audio file exists
   * @param {string} filename - Filename
   * @returns {Promise<boolean>}
   */
  async fileExists(filename) {
    try {
      const filepath = this.getAudioPath(filename);
      await fs.promises.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete audio file
   * @param {string} filename - Filename
   * @returns {Promise<void>}
   */
  async deleteAudio(filename) {
    try {
      const filepath = this.getAudioPath(filename);
      await fs.promises.unlink(filepath);
      console.log(`🗑️ [AudioStorage] Deleted audio file: ${filename}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`❌ [AudioStorage] Error deleting audio file ${filename}:`, error);
        throw error;
      }
    }
  }

  /**
   * Clean up old audio files
   * @returns {Promise<number>} Number of files deleted
   */
  async cleanupOldFiles() {
    try {
      const files = await fs.promises.readdir(this.audioDir);
      const now = Date.now();
      let deletedCount = 0;

      for (const file of files) {
        const filepath = path.join(this.audioDir, file);
        const stats = await fs.promises.stat(filepath);
        const age = now - stats.mtimeMs;

        if (age > this.maxFileAge) {
          await this.deleteAudio(file);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(`🧹 [AudioStorage] Cleaned up ${deletedCount} old audio preview files`);
      }

      return deletedCount;
    } catch (error) {
      console.error('❌ [AudioStorage] Error during cleanup:', error);
      return 0;
    }
  }

  /**
   * Start cleanup interval
   */
  startCleanupInterval() {
    // Run cleanup every hour
    setInterval(() => {
      this.cleanupOldFiles().catch(err => {
        console.error('❌ [AudioStorage] Cleanup interval error:', err);
      });
    }, 60 * 60 * 1000); // 1 hour

    // Run initial cleanup after 5 minutes
    setTimeout(() => {
      this.cleanupOldFiles().catch(err => {
        console.error('❌ [AudioStorage] Initial cleanup error:', err);
      });
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Get storage statistics
   * @returns {Promise<{totalFiles: number, totalSize: number, oldestFile: Date|null, newestFile: Date|null}>}
   */
  async getStats() {
    try {
      const files = await fs.promises.readdir(this.audioDir);
      let totalSize = 0;
      let oldestTime = null;
      let newestTime = null;

      for (const file of files) {
        const filepath = path.join(this.audioDir, file);
        const stats = await fs.promises.stat(filepath);
        totalSize += stats.size;

        if (!oldestTime || stats.mtimeMs < oldestTime) {
          oldestTime = stats.mtimeMs;
        }
        if (!newestTime || stats.mtimeMs > newestTime) {
          newestTime = stats.mtimeMs;
        }
      }

      return {
        totalFiles: files.length,
        totalSize,
        oldestFile: oldestTime ? new Date(oldestTime) : null,
        newestFile: newestTime ? new Date(newestTime) : null
      };
    } catch (error) {
      console.error('❌ [AudioStorage] Error getting stats:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        oldestFile: null,
        newestFile: null
      };
    }
  }
}

export default new AudioStorageService();

