import { OpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

class OpenAIFilesService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;
  }

  // Upload file to OpenAI Files
  async uploadFile(fileBuffer, filename, purpose = 'assistants') {
    try {
      console.log(`📁 Uploading file to OpenAI: ${filename}`);
      
      const file = await this.openai.files.create({
        file: fileBuffer,
        purpose: purpose
      });

      console.log(`✅ File uploaded successfully: ${file.id}`);
      return {
        id: file.id,
        filename: filename,
        purpose: file.purpose,
        status: file.status,
        created_at: file.created_at,
        bytes: file.bytes
      };
    } catch (error) {
      console.error('Error uploading file to OpenAI:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  // Add file to vector store
  async addFileToVectorStore(fileId) {
    try {
      console.log(`🔗 Adding file ${fileId} to vector store ${this.vectorStoreId}`);
      
      const vectorStoreFile = await this.openai.vectorStores.files.create(
        this.vectorStoreId,
        { file_id: fileId }
      );

      console.log(`✅ File added to vector store: ${vectorStoreFile.id}`);
      return vectorStoreFile;
    } catch (error) {
      console.error('Error adding file to vector store:', error);
      throw new Error(`Failed to add file to vector store: ${error.message}`);
    }
  }

  // Get all files from OpenAI
  async getAllFiles() {
    try {
      console.log('📋 Fetching all files from OpenAI');
      
      const files = await this.openai.files.list();
      
      // Get vector store files to check which files are in the vector store
      const vectorStoreFiles = await this.openai.vectorStores.files.list(this.vectorStoreId);
      const vectorStoreFileIds = new Set(vectorStoreFiles.data.map(f => f.id));
      
      // Enrich files with vector store status
      const enrichedFiles = files.data.map(file => ({
        id: file.id,
        filename: file.filename,
        purpose: file.purpose,
        status: file.status,
        created_at: file.created_at,
        bytes: file.bytes,
        inVectorStore: vectorStoreFileIds.has(file.id)
      }));

      console.log(`✅ Found ${enrichedFiles.length} files`);
      return enrichedFiles;
    } catch (error) {
      console.error('Error fetching files from OpenAI:', error);
      throw new Error(`Failed to fetch files: ${error.message}`);
    }
  }

  // Get file by ID
  async getFile(fileId) {
    try {
      const file = await this.openai.files.retrieve(fileId);
      return {
        id: file.id,
        filename: file.filename,
        purpose: file.purpose,
        status: file.status,
        created_at: file.created_at,
        bytes: file.bytes
      };
    } catch (error) {
      console.error('Error fetching file from OpenAI:', error);
      throw new Error(`Failed to fetch file: ${error.message}`);
    }
  }

  // Delete file from OpenAI
  async deleteFile(fileId) {
    try {
      console.log(`🗑️ Deleting file from OpenAI: ${fileId}`);
      
      // First, remove from vector store if it exists there
      try {
        await this.openai.vectorStores.files.del(this.vectorStoreId, fileId);
        console.log(`✅ File removed from vector store: ${fileId}`);
      } catch (vectorError) {
        console.log(`ℹ️ File not in vector store: ${fileId}`);
      }

      // Then delete the file
      const result = await this.openai.files.del(fileId);
      console.log(`✅ File deleted: ${fileId}`);
      return result;
    } catch (error) {
      console.error('Error deleting file from OpenAI:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  // Search files using OpenAI File Search
  async searchFiles(query, fileIds = null) {
    try {
      console.log(`🔍 Searching files with query: "${query}"`);
      
      const searchParams = {
        query: query
      };

      if (fileIds && fileIds.length > 0) {
        searchParams.file_ids = fileIds;
      }

      const results = await this.openai.vectorStores.search(
        this.vectorStoreId,
        searchParams
      );

      console.log(`✅ Found ${results.data.length} results`);
      return {
        query,
        results: results.data,
        totalResults: results.data.length
      };
    } catch (error) {
      console.error('Error searching files:', error);
      throw new Error(`Failed to search files: ${error.message}`);
    }
  }

  // Get vector store status
  async getVectorStoreStatus() {
    try {
      const vectorStore = await this.openai.vectorStores.retrieve(this.vectorStoreId);
      const files = await this.openai.vectorStores.files.list(this.vectorStoreId);
      
      return {
        id: vectorStore.id,
        name: vectorStore.name,
        status: vectorStore.status,
        fileCount: files.data.length,
        created_at: vectorStore.created_at,
        files: files.data
      };
    } catch (error) {
      console.error('Error fetching vector store status:', error);
      throw new Error(`Failed to fetch vector store status: ${error.message}`);
    }
  }
}

export default new OpenAIFilesService();
