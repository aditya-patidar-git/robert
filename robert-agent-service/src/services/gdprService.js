/**
 * GDPR Service
 * Handles data retention cleanup and DSAR (Data Subject Access Request) operations
 */

import CallRecord from '../database/models/CallRecord.js';
import CallMemory from '../database/models/CallMemory.js';
import ComplaintRecord from '../database/models/ComplaintRecord.js';
import KBASession from '../database/models/KBASession.js';
import PrivacyConfig from '../database/models/PrivacyConfig.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class GDRPService {
  /**
   * Get active privacy configuration
   * @returns {Promise<Object>} Privacy configuration
   */
  async getPrivacyConfig() {
    try {
      const config = await PrivacyConfig.findOne({ isActive: true }).lean();
      if (!config) {
        // Return defaults if no config found
        return {
          retentionSettings: {
            transcriptRetention: 90,
            recordingRetention: 90,
            metadataRetention: 365
          }
        };
      }
      return config;
    } catch (error) {
      console.error('❌ [GDPR] Error getting privacy config:', error);
      throw error;
    }
  }

  /**
   * Clean up expired transcripts
   * @param {boolean} softDelete - If true, mark as deleted instead of hard delete
   * @returns {Promise<Object>} Cleanup results
   */
  async cleanupExpiredTranscripts(softDelete = false) {
    try {
      const config = await this.getPrivacyConfig();
      const retentionDays = config.retentionSettings?.transcriptRetention || 90;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const query = {
        createdAt: { $lt: cutoffDate },
        transcript: { $exists: true, $ne: [] }
      };

      let result;
      if (softDelete) {
        // Mark transcripts as deleted (set transcript to empty array)
        result = await CallRecord.updateMany(
          query,
          { $set: { transcript: [], transcriptDeleted: true, transcriptDeletedAt: new Date() } }
        );
      } else {
        // Hard delete transcripts
        result = await CallRecord.updateMany(
          query,
          { $unset: { transcript: '' } }
        );
      }

      console.log(`🧹 [GDPR] Cleaned up transcripts for ${result.modifiedCount} call records older than ${retentionDays} days`);
      
      return {
        deletedCount: result.modifiedCount,
        cutoffDate: cutoffDate.toISOString(),
        retentionDays
      };
    } catch (error) {
      console.error('❌ [GDPR] Error cleaning up expired transcripts:', error);
      throw error;
    }
  }

  /**
   * Clean up expired recordings
   * Note: This assumes recordings are stored as files or URLs
   * @param {boolean} softDelete - If true, mark as deleted instead of hard delete
   * @returns {Promise<Object>} Cleanup results
   */
  async cleanupExpiredRecordings(softDelete = false) {
    try {
      const config = await this.getPrivacyConfig();
      const retentionDays = config.retentionSettings?.recordingRetention || 90;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const query = {
        createdAt: { $lt: cutoffDate },
        recordingUrl: { $exists: true, $ne: null }
      };

      let result;
      if (softDelete) {
        // Mark recordings as deleted
        result = await CallRecord.updateMany(
          query,
          { 
            $set: { 
              recordingUrl: null, 
              recordingDeleted: true, 
              recordingDeletedAt: new Date() 
            } 
          }
        );
      } else {
        // Hard delete recording URLs
        result = await CallRecord.updateMany(
          query,
          { $unset: { recordingUrl: '' } }
        );
      }

      console.log(`🧹 [GDPR] Cleaned up recordings for ${result.modifiedCount} call records older than ${retentionDays} days`);
      
      return {
        deletedCount: result.modifiedCount,
        cutoffDate: cutoffDate.toISOString(),
        retentionDays
      };
    } catch (error) {
      console.error('❌ [GDPR] Error cleaning up expired recordings:', error);
      throw error;
    }
  }

  /**
   * Clean up expired metadata
   * @param {boolean} softDelete - If true, mark as deleted instead of hard delete
   * @returns {Promise<Object>} Cleanup results
   */
  async cleanupExpiredMetadata(softDelete = false) {
    try {
      const config = await this.getPrivacyConfig();
      const retentionDays = config.retentionSettings?.metadataRetention || 365;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const query = {
        createdAt: { $lt: cutoffDate }
      };

      // For metadata cleanup, we remove non-essential fields but keep basic record
      const fieldsToRemove = {
        transcript: '',
        recordingUrl: '',
        summary: '',
        provenance: '',
        piiDetected: '',
        toolsUsed: '',
        metrics: '',
        audioQuality: ''
      };

      let result;
      if (softDelete) {
        // Mark metadata as deleted
        result = await CallRecord.updateMany(
          query,
          { 
            $set: { 
              metadataDeleted: true, 
              metadataDeletedAt: new Date() 
            },
            $unset: fieldsToRemove
          }
        );
      } else {
        // Hard delete metadata fields
        result = await CallRecord.updateMany(
          query,
          { $unset: fieldsToRemove }
        );
      }

      console.log(`🧹 [GDPR] Cleaned up metadata for ${result.modifiedCount} call records older than ${retentionDays} days`);
      
      return {
        deletedCount: result.modifiedCount,
        cutoffDate: cutoffDate.toISOString(),
        retentionDays
      };
    } catch (error) {
      console.error('❌ [GDPR] Error cleaning up expired metadata:', error);
      throw error;
    }
  }

  /**
   * Export all data for a caller (DSAR export)
   * @param {string} callerId - Caller phone number or identifier
   * @returns {Promise<Object>} Exported data
   */
  async exportDSARData(callerId) {
    try {
      const requestId = `dsar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Find all data for this caller
      const [callRecords, callMemories, complaints, kbaSessions] = await Promise.all([
        CallRecord.find({ from: callerId }).lean(),
        CallMemory.find({ callerId }).lean(),
        ComplaintRecord.find({ callerPhone: callerId }).lean(),
        KBASession.find({ callerId }).lean()
      ]);

      const exportData = {
        requestId,
        callerId,
        exportedAt: new Date().toISOString(),
        data: {
          callRecords: callRecords.map(record => {
            // Remove internal fields
            const { _id, __v, ...cleanRecord } = record;
            return cleanRecord;
          }),
          callMemories: callMemories.map(memory => {
            const { _id, __v, ...cleanMemory } = memory;
            return cleanMemory;
          }),
          complaints: complaints.map(complaint => {
            const { _id, __v, ...cleanComplaint } = complaint;
            return cleanComplaint;
          }),
          kbaSessions: kbaSessions.map(session => {
            const { _id, __v, ...cleanSession } = session;
            return cleanSession;
          })
        },
        summary: {
          totalCallRecords: callRecords.length,
          totalCallMemories: callMemories.length,
          totalComplaints: complaints.length,
          totalKBASessions: kbaSessions.length
        }
      };

      console.log(`📤 [GDPR] DSAR export created for caller ${callerId}: ${exportData.summary.totalCallRecords} calls, ${exportData.summary.totalCallMemories} memories`);
      
      return exportData;
    } catch (error) {
      console.error('❌ [GDPR] Error exporting DSAR data:', error);
      throw error;
    }
  }

  /**
   * Delete all data for a caller (DSAR deletion)
   * @param {string} callerId - Caller phone number or identifier
   * @param {boolean} verify - Require verification before deletion
   * @returns {Promise<Object>} Deletion results
   */
  async deleteDSARData(callerId, verify = true) {
    try {
      if (verify) {
        // In production, this should require additional verification
        // For now, we'll log a warning
        console.warn(`⚠️ [GDPR] DSAR deletion requested for ${callerId} - verification should be performed`);
      }

      // Delete all data for this caller
      const [callRecordsResult, callMemoriesResult, complaintsResult, kbaSessionsResult] = await Promise.all([
        CallRecord.deleteMany({ from: callerId }),
        CallMemory.deleteMany({ callerId }),
        ComplaintRecord.deleteMany({ callerPhone: callerId }),
        KBASession.deleteMany({ callerId })
      ]);

      const deletionResult = {
        callerId,
        deletedAt: new Date().toISOString(),
        deletedCounts: {
          callRecords: callRecordsResult.deletedCount,
          callMemories: callMemoriesResult.deletedCount,
          complaints: complaintsResult.deletedCount,
          kbaSessions: kbaSessionsResult.deletedCount
        },
        totalDeleted: 
          callRecordsResult.deletedCount +
          callMemoriesResult.deletedCount +
          complaintsResult.deletedCount +
          kbaSessionsResult.deletedCount
      };

      console.log(`🗑️ [GDPR] DSAR deletion completed for caller ${callerId}: ${deletionResult.totalDeleted} records deleted`);
      
      return deletionResult;
    } catch (error) {
      console.error('❌ [GDPR] Error deleting DSAR data:', error);
      throw error;
    }
  }

  /**
   * Process a DSAR request (export or delete)
   * @param {string} requestId - Request ID
   * @param {string} action - 'export' or 'delete'
   * @param {string} callerId - Caller identifier
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Processing result
   */
  async processDSARRequest(requestId, action, callerId, options = {}) {
    try {
      if (action === 'export') {
        const exportData = await this.exportDSARData(callerId);
        return {
          requestId,
          action: 'export',
          status: 'completed',
          result: exportData
        };
      } else if (action === 'delete') {
        const deletionResult = await this.deleteDSARData(callerId, options.verify !== false);
        return {
          requestId,
          action: 'delete',
          status: 'completed',
          result: deletionResult
        };
      } else {
        throw new Error(`Unknown DSAR action: ${action}`);
      }
    } catch (error) {
      console.error(`❌ [GDPR] Error processing DSAR request ${requestId}:`, error);
      throw error;
    }
  }

  /**
   * Run all retention cleanup tasks
   * @param {boolean} softDelete - Use soft delete
   * @returns {Promise<Object>} Cleanup results
   */
  async runRetentionCleanup(softDelete = false) {
    try {
      console.log('🧹 [GDPR] Starting retention cleanup...');
      
      const [transcripts, recordings, metadata] = await Promise.all([
        this.cleanupExpiredTranscripts(softDelete),
        this.cleanupExpiredRecordings(softDelete),
        this.cleanupExpiredMetadata(softDelete)
      ]);

      const totalDeleted = transcripts.deletedCount + recordings.deletedCount + metadata.deletedCount;

      console.log(`✅ [GDPR] Retention cleanup completed. Total records cleaned: ${totalDeleted}`);

      return {
        transcripts,
        recordings,
        metadata,
        totalDeleted,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ [GDPR] Error running retention cleanup:', error);
      throw error;
    }
  }
}

export default new GDRPService();

