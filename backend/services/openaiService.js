import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Existing vector store ID from documentation
const VECTOR_STORE_ID = process.env.OPENAI_VECTOR_STORE_ID || 'vs_68b70556ca1081918dd5dbe56042a419';
const VECTOR_STORE_NAME = process.env.OPENAI_VECTOR_STORE_NAME || 'UNIVERSALAIDATABASE';

class OpenAIService {
  constructor() {
    this.vectorStoreId = VECTOR_STORE_ID;
    this.vectorStoreName = VECTOR_STORE_NAME;
  }

  // Get or create vector store
  async getVectorStore() {
    try {
      // First, try to get the existing vector store
      const vectorStores = await openai.vectorStores.list();
      const existingStore = vectorStores.data.find(store => store.id === this.vectorStoreId);
      
      if (existingStore) {
        console.log(`✅ Found existing vector store: ${existingStore.name}`);
        return existingStore;
      }

      // If not found, create a new one
      console.log(`⚠️ Vector store ${this.vectorStoreId} not found. Creating new one...`);
      const newStore = await openai.vectorStores.create({
        name: this.vectorStoreName,
        description: 'Universal Motorcycle Training Knowledge Base'
      });
      
      console.log(`✅ Created new vector store: ${newStore.id}`);
      return newStore;
    } catch (error) {
      console.error('Error getting vector store:', error);
      throw new Error(`Failed to get vector store: ${error.message}`);
    }
  }

  // Upload file to OpenAI
  async uploadFile(filePath, fileName, fileType = 'text/plain') {
    try {
      const fs = await import('fs');
      const fileContent = fs.readFileSync(filePath);
      
      const file = await openai.files.create({
        file: new File([fileContent], fileName, { type: fileType }),
        purpose: 'assistants'
      });

      console.log(`✅ File uploaded to OpenAI: ${file.id}`);
      return file;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  // Add file to vector store
  async addFileToVectorStore(fileId, metadata = {}) {
    try {
      const vectorStoreFile = await openai.vectorStores.files.create(this.vectorStoreId, {
        file_id: fileId
      });

      console.log(`✅ File ${fileId} added to vector store`);
      return vectorStoreFile;
    } catch (error) {
      console.error('Error adding file to vector store:', error);
      throw new Error(`Failed to add file to vector store: ${error.message}`);
    }
  }

  // Search files in vector store
  async searchFiles(query, fileIds = null, limit = 5) {
    try {
      const searchParams = {
        query
      };

      if (fileIds && fileIds.length > 0) {
        searchParams.file_ids = fileIds;
      }

      const results = await openai.vectorStores.search(this.vectorStoreId, searchParams);
      
      console.log(`✅ Found ${results.data.length} results for query: "${query}"`);
      return results.data;
    } catch (error) {
      console.error('Error searching files:', error);
      throw new Error(`Failed to search files: ${error.message}`);
    }
  }

  // Get file content by ID
  async getFileContent(fileId) {
    try {
      const file = await openai.files.retrieve(fileId);
      const content = await openai.files.content(fileId);
      
      return {
        id: file.id,
        filename: file.filename,
        purpose: file.purpose,
        created_at: file.created_at,
        content: await content.text()
      };
    } catch (error) {
      console.error('Error getting file content:', error);
      throw new Error(`Failed to get file content: ${error.message}`);
    }
  }

  // List files in vector store
  async listVectorStoreFiles() {
    try {
      const files = await openai.vectorStores.files.list(this.vectorStoreId);
      return files.data;
    } catch (error) {
      console.error('Error listing vector store files:', error);
      throw new Error(`Failed to list vector store files: ${error.message}`);
    }
  }

  // Remove file from vector store
  async removeFileFromVectorStore(fileId) {
    try {
      await openai.vectorStores.files.del(this.vectorStoreId, fileId);
      console.log(`✅ File ${fileId} removed from vector store`);
      return true;
    } catch (error) {
      console.error('Error removing file from vector store:', error);
      throw new Error(`Failed to remove file from vector store: ${error.message}`);
    }
  }

  // Get model capabilities
  async getModelCapabilities() {
    try {
      const models = await openai.models.list();
      const capabilities = [];

      for (const model of models.data) {
        const capabilities_entry = {
          id: model.id,
          name: model.id,
          created: model.created,
          owned_by: model.owned_by,
          capabilities: {
            audio: model.id.includes('realtime') || model.id.includes('tts') || model.id.includes('whisper'),
            tools: model.id.includes('gpt-4') || model.id.includes('realtime'),
            streaming: true,
            realtime: model.id.includes('realtime'),
            file_search: model.id.includes('gpt-4') || model.id.includes('realtime')
          },
          context_limit: this.getContextLimit(model.id),
          default_temperature: this.getDefaultTemperature(model.id),
          default_top_p: this.getDefaultTopP(model.id)
        };

        capabilities.push(capabilities_entry);
      }

      return capabilities;
    } catch (error) {
      console.error('Error getting model capabilities:', error);
      throw new Error(`Failed to get model capabilities: ${error.message}`);
    }
  }

  // Helper methods for model capabilities
  getContextLimit(modelId) {
    if (modelId.includes('gpt-4o')) return 128000;
    if (modelId.includes('gpt-4')) return 128000;
    if (modelId.includes('gpt-3.5')) return 16385;
    if (modelId.includes('realtime')) return 128000;
    return 4096;
  }

  getDefaultTemperature(modelId) {
    if (modelId.includes('realtime')) return 0.4;
    if (modelId.includes('gpt-4')) return 0.7;
    return 0.7;
  }

  getDefaultTopP(modelId) {
    if (modelId.includes('realtime')) return 1.0;
    if (modelId.includes('gpt-4')) return 0.9;
    return 0.9;
  }

  // Create File Search tool for Realtime API
  createFileSearchTool(fileIds = null) {
    return {
      type: 'file_search',
      file_search: {
        vector_store_ids: [this.vectorStoreId],
        ...(fileIds && { file_ids: fileIds })
      }
    };
  }

  // Test File Search functionality
  async testFileSearch(query, fileIds = null) {
    try {
      const results = await this.searchFiles(query, fileIds, 3);
      
      const testResults = {
        query,
        results: results.map(result => ({
          file_id: result.file_id,
          score: result.score,
          content: result.content?.substring(0, 200) + '...'
        })),
        total_results: results.length,
        vector_store_id: this.vectorStoreId
      };

      return testResults;
    } catch (error) {
      console.error('Error testing file search:', error);
      throw new Error(`Failed to test file search: ${error.message}`);
    }
  }
}

export default new OpenAIService();
