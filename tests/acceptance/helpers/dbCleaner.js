/**
 * Database Cleaner
 * Handles database cleanup operations for tests
 * Single responsibility: database cleanup only
 */

import mongoose from 'mongoose';
import testConfig from '../config/testConfig.js';

class DatabaseCleaner {
  /**
   * Clean up test database
   */
  async cleanup() {
    try {
      if (!mongoose.connection.readyState) {
        console.log('[DB Cleaner] MongoDB not connected, skipping cleanup');
        return;
      }

      const db = mongoose.connection.db;
      if (!db) {
        console.log('[DB Cleaner] Database not available, skipping cleanup');
        return;
      }

      // Get all collections
      const collections = await db.listCollections().toArray();
      
      // Clean test-specific collections
      const testCollections = [
        'callrecords',
        'callmemories',
        'conversationcontexts',
        'kbavsessions',
        'handoverrecords',
        'complaintrecords'
      ];

      for (const collectionName of testCollections) {
        const collection = db.collection(collectionName);
        if (collection) {
          // Delete documents created during tests (by test phone numbers or test markers)
          await collection.deleteMany({
            $or: [
              { from: { $in: testConfig.testData.callerNumbers } },
              { to: { $in: testConfig.testData.callerNumbers } },
              { callSid: { $regex: /^TEST_/ } },
              { testMarker: true }
            ]
          });
        }
      }

      console.log('[DB Cleaner] Test data cleaned');
    } catch (error) {
      console.error('[DB Cleaner] Error during cleanup:', error.message);
      // Don't throw - cleanup failures shouldn't break tests
    }
  }

  /**
   * Clean specific collection
   */
  async cleanCollection(collectionName, filter = {}) {
    try {
      if (!mongoose.connection.readyState) {
        return;
      }

      const db = mongoose.connection.db;
      if (!db) {
        return;
      }

      const collection = db.collection(collectionName);
      if (collection) {
        await collection.deleteMany(filter);
      }
    } catch (error) {
      console.error(`[DB Cleaner] Error cleaning collection ${collectionName}:`, error.message);
    }
  }
}

export const dbCleaner = new DatabaseCleaner();
export default dbCleaner;

