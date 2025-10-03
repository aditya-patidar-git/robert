import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class FileSearchService {
  constructor() {
    this.vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;
    this.vectorStoreName = process.env.OPENAI_VECTOR_STORE_NAME || 'UNIVERSALAIDATABASE';
  }

  // Search files using OpenAI File Search tool
  async searchFiles(query, options = {}) {
    try {
      console.log(`🔍 Searching files with query: "${query}"`);
      
      if (!this.vectorStoreId) {
        throw new Error('Vector store ID not configured');
      }

      const {
        maxResults = 5,
        similarityThreshold = 0.7,
        tags = [],
        fileIds = null
      } = options;

      // Get vector store
      const vectorStore = await openai.vectorStores.retrieve(this.vectorStoreId);
      
      if (!vectorStore) {
        throw new Error('Vector store not found');
      }

      // Search using File Search tool
      const searchParams = {
        query,
        max_results: maxResults,
        similarity_threshold: similarityThreshold
      };

      // Add file filtering if specified
      if (fileIds && fileIds.length > 0) {
        searchParams.file_ids = fileIds;
      }

      // Perform the search
      const searchResults = await openai.vectorStores.files.search(
        this.vectorStoreId,
        searchParams
      );

      // Process results
      const results = searchResults.data.map(result => ({
        fileId: result.id,
        fileName: result.filename,
        similarityScore: result.similarity_score,
        content: result.content,
        metadata: result.metadata || {},
        source: 'OpenAI Vector Store'
      }));

      console.log(`✅ Found ${results.length} results for query: "${query}"`);
      
      return {
        query,
        results,
        totalResults: results.length,
        vectorStore: {
          id: this.vectorStoreId,
          name: this.vectorStoreName
        },
        searchParams: {
          maxResults,
          similarityThreshold,
          tags,
          fileIds
        }
      };

    } catch (error) {
      console.error('Error searching files:', error);
      throw new Error(`File search failed: ${error.message}`);
    }
  }

  // Search files by tags (as per documentation requirements)
  async searchFilesByTags(query, tags = []) {
    try {
      console.log(`🏷️ Searching files by tags: ${tags.join(', ')}`);
      
      // Get files from vector store
      const vectorStoreFiles = await openai.vectorStores.files.list(this.vectorStoreId);
      
      // Filter files by tags if specified
      let fileIds = null;
      if (tags.length > 0) {
        // This would require metadata filtering - for now, search all files
        // In a real implementation, you'd filter by metadata tags
        console.log(`📋 Filtering by tags: ${tags.join(', ')}`);
      }

      // Perform search with filtered file IDs
      return await this.searchFiles(query, {
        fileIds,
        tags
      });

    } catch (error) {
      console.error('Error searching files by tags:', error);
      throw new Error(`Tag-based file search failed: ${error.message}`);
    }
  }

  // Get file content by ID
  async getFileContent(fileId) {
    try {
      console.log(`📄 Getting content for file: ${fileId}`);
      
      const file = await openai.files.retrieve(fileId);
      const content = await openai.files.content(fileId);
      
      return {
        fileId: file.id,
        fileName: file.filename,
        content: content.text,
        metadata: file.metadata || {},
        size: file.bytes,
        createdAt: new Date(file.created_at * 1000)
      };

    } catch (error) {
      console.error('Error getting file content:', error);
      throw new Error(`Failed to get file content: ${error.message}`);
    }
  }

  // Get vector store status
  async getVectorStoreStatus() {
    try {
      console.log('📊 Getting vector store status...');
      
      const vectorStore = await openai.vectorStores.retrieve(this.vectorStoreId);
      const files = await openai.vectorStores.files.list(this.vectorStoreId);
      
      return {
        id: vectorStore.id,
        name: vectorStore.name,
        status: vectorStore.status,
        fileCount: files.data.length,
        createdAt: new Date(vectorStore.created_at * 1000),
        lastUpdated: new Date(vectorStore.updated_at * 1000),
        files: files.data.map(file => ({
          id: file.id,
          filename: file.filename,
          status: file.status,
          size: file.bytes,
          createdAt: new Date(file.created_at * 1000)
        }))
      };

    } catch (error) {
      console.error('Error getting vector store status:', error);
      throw new Error(`Failed to get vector store status: ${error.message}`);
    }
  }

  // Test search functionality
  async testSearch() {
    try {
      console.log('🧪 Testing file search functionality...');
      
      const testQueries = [
        'CBT policy requirements',
        'training course pricing',
        'safety equipment needed',
        'theory test information',
        'booking terms and conditions'
      ];

      const results = [];
      
      for (const query of testQueries) {
        try {
          const searchResult = await this.searchFiles(query, { maxResults: 2 });
          results.push({
            query,
            success: true,
            resultCount: searchResult.totalResults,
            results: searchResult.results
          });
        } catch (error) {
          results.push({
            query,
            success: false,
            error: error.message
          });
        }
      }

      return {
        testResults: results,
        totalTests: testQueries.length,
        successfulTests: results.filter(r => r.success).length,
        vectorStoreId: this.vectorStoreId
      };

    } catch (error) {
      console.error('Error testing search:', error);
      throw new Error(`Search test failed: ${error.message}`);
    }
  }
}

export default new FileSearchService();
