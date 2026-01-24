import OpenAI from 'openai';
// dotenv is already loaded in index.js, no need to reload here
import mongoose from 'mongoose';
import Provenance from '../database/models/Provenance.js';
import uncertaintyGateService from '../services/uncertaintyGateService.js';
import configManager from '../agent/configManager.js';

// Lazy initialization: Create OpenAI client only when needed (after dotenv loads)
let openaiClient = null;
function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

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

      // Get OpenAI client (lazy initialization)
      const openai = getOpenAIClient();

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

      // Get uncertainty gate configuration from AIConfig
      const aiConfig = configManager.getAIConfig();
      const uncertaintyConfig = aiConfig?.uncertaintyGate || {};
      const uncertaintyEnabled = uncertaintyConfig.enabled !== false; // Default to true if not set

      // Apply uncertainty gate validation if enabled
      if (uncertaintyEnabled && results.length > 0) {
        try {
          const validation = await uncertaintyGateService.validateResults(
            { results: results },
            {
              threshold: uncertaintyConfig.confidenceThreshold || 0.8,
              minPassages: uncertaintyConfig.minSources || 1,
              requireProvenance: true
            }
          );

          if (!validation.passed) {
            console.log(`⚠️ [${callContext.callSid || 'unknown'}] Uncertainty gate validation failed:`, validation.recommendations.join(', '));
            
            // Track provenance even for failed validation (async)
            this.trackProvenance(query, results, callContext).catch(err => {
              console.warn(`⚠️ [${callContext.callSid || 'unknown'}] Failed to track provenance:`, err.message);
            });

            // Return structured error response indicating low confidence
            return {
              query: query,
              results: [],
              totalResults: 0,
              confidence: validation.confidence,
              validationFailed: true,
              validationDetails: {
                confidence: validation.confidence,
                recommendations: validation.recommendations,
                fallbackAction: validation.fallbackAction,
                passagesFound: validation.passages.length,
                validPassages: validation.passages.filter(p => {
                  const score = p.similarityScore || p.similarity_score || 0;
                  return score >= (uncertaintyConfig.confidenceThreshold || 0.8);
                }).length,
                threshold: uncertaintyConfig.confidenceThreshold || 0.8,
                minPassages: uncertaintyConfig.minSources || 1
              },
              error: `Uncertainty gate validation failed: ${validation.recommendations.join(', ')}`,
              vectorStore: {
                id: this.vectorStoreId,
                name: this.vectorStoreName
              },
              citations: []
            };
          }

          // Use validated passages only (filtered by threshold)
          const validatedResults = validation.passages;
          console.log(`✅ [${callContext.callSid || 'unknown'}] Uncertainty gate passed. Using ${validatedResults.length} validated passages (confidence: ${validation.confidence.toFixed(2)})`);

          // Track provenance (async, don't wait for it)
          this.trackProvenance(query, validatedResults, callContext).catch(err => {
            console.warn(`⚠️ [${callContext.callSid || 'unknown'}] Failed to track provenance:`, err.message);
          });

          return {
            query: query,
            results: validatedResults,
            totalResults: validatedResults.length,
            confidence: validation.confidence,
            provenance: validation.provenance,
            vectorStore: {
              id: this.vectorStoreId,
              name: this.vectorStoreName
            },
            citations: validatedResults.map(r => r.fileName || r.filename || 'Unknown')
          };
        } catch (validationError) {
          console.error(`❌ [${callContext.callSid || 'unknown'}] Uncertainty gate validation error:`, validationError);
          // If validation fails due to error, proceed with original results but log warning
          console.warn(`⚠️ [${callContext.callSid || 'unknown'}] Proceeding with results despite validation error`);
        }
      }

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
