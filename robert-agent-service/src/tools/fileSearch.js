import OpenAI from 'openai';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Provenance from '../database/models/Provenance.js';

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class FileSearchTool {
  constructor() {
    this.vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;
    this.vectorStoreName = process.env.OPENAI_VECTOR_STORE_NAME || 'UNIVERSALAIDATABASE';
  }

  async execute(parameters, callContext = {}) {
    const { query, files } = parameters;

    if (!this.vectorStoreId) {
      throw new Error('OPENAI_VECTOR_STORE_ID not configured. File search is unavailable.');
    }

    if (!query) {
      throw new Error('Search query is required');
    }

    try {
      console.log(`🔍 [${callContext.callSid || 'unknown'}] Searching knowledge base: "${query}"`);

      // Get vector store
      const vectorStore = await openai.vectorStores.retrieve(this.vectorStoreId);

      if (!vectorStore) {
        throw new Error('Vector store not found');
      }

      // Prepare search parameters
      const searchParams = {
        query: query
      };

      // Add file filtering if specified
      if (files && Array.isArray(files) && files.length > 0) {
        searchParams.file_ids = files;
      }

      // Perform the search
      const searchResults = await openai.vectorStores.search(
        this.vectorStoreId,
        searchParams
      );

      // Process results
      const results = (searchResults.data || []).map(result => ({
        fileId: result.id,
        fileName: result.filename || 'Unknown',
        similarityScore: result.similarity_score || 0,
        content: result.content || '',
        metadata: result.metadata || {},
        source: 'OpenAI Vector Store'
      }));

      console.log(`✅ [${callContext.callSid || 'unknown'}] Found ${results.length} results for query: "${query}"`);

      // Track provenance (async, don't wait for it)
      this.trackProvenance(query, results, callContext).catch(err => {
        console.warn(`⚠️ [${callContext.callSid || 'unknown'}] Failed to track provenance:`, err.message);
      });

      return {
        query: query,
        results: results,
        totalResults: results.length,
        vectorStore: {
          id: this.vectorStoreId,
          name: this.vectorStoreName
        },
        citations: results.map(r => r.fileName)
      };
    } catch (error) {
      console.error(`❌ [${callContext.callSid || 'unknown'}] File search error:`, error);
      throw new Error(`File search failed: ${error.message}`);
    }
  }

  /**
   * Track file usage for provenance analytics
   * @private
   */
  async trackProvenance(query, results, callContext = {}) {
    try {
      // Only track if we have results and a call context
      if (!results || results.length === 0 || !callContext.callSid) {
        return;
      }

      // Check if mongoose is connected
      if (mongoose.connection.readyState !== 1) {
        console.warn(`⚠️ [${callContext.callSid}] MongoDB not connected, skipping provenance tracking`);
        return;
      }

      const provenance = new Provenance({
        callId: callContext.callSid,
        sessionId: callContext.sessionId || callContext.callSid,
        userId: callContext.userId || callContext.callerId || null,
        query: query,
        fileIds: results.map(r => r.fileId).filter(Boolean),
        titles: results.map(r => r.fileName).filter(Boolean),
        similarityScores: results.map(r => r.similarityScore || 0),
        results: results.map(r => ({
          fileId: r.fileId,
          fileName: r.fileName,
          similarityScore: r.similarityScore,
          content: r.content?.substring(0, 500) || '', // Limit content size
          metadata: r.metadata || {}
        })),
        model: 'gpt-realtime',
        confidence: results.length > 0 ? results[0].similarityScore : 0,
        metadata: {
          vectorStoreId: this.vectorStoreId,
          vectorStoreName: this.vectorStoreName,
          totalResults: results.length
        }
      });

      await provenance.save();
      console.log(`📊 [${callContext.callSid}] Tracked provenance for ${results.length} files`);
    } catch (error) {
      // Don't throw - tracking failure shouldn't break the search
      console.warn(`⚠️ [${callContext.callSid || 'unknown'}] Provenance tracking error:`, error.message);
    }
  }
}

export default new FileSearchTool();

