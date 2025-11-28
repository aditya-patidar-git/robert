import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
}

export default new FileSearchTool();

