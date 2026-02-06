import { OpenAI, toFile } from 'openai';
import { VECTOR_STORE_ID } from '../config/openaiVectorStore.js';

class OpenAIFilesService {
  constructor() {
    this._openai = null;
    this.vectorStoreId = VECTOR_STORE_ID;
  }

  get openai() {
    if (!this._openai) {
      this._openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
    return this._openai;
  }

  // Upload file to OpenAI Files
  async uploadFile(fileBuffer, filename, purpose = 'assistants') {
    try {
      console.log(`📁 Uploading file to OpenAI: ${filename}`);
      console.log(`📊 File size: ${fileBuffer.length} bytes`);
      
      // Ensure we have a proper Buffer instance
      const buffer = Buffer.isBuffer(fileBuffer) 
        ? fileBuffer 
        : Buffer.from(fileBuffer);
      
      // Use toFile() helper from OpenAI SDK to wrap the Buffer
      // This is the recommended approach for in-memory data
      // Direct Buffer is not supported - must use toFile() wrapper
      const fileObj = await toFile(buffer, filename);
      
      console.log(`📊 File object created via toFile():`, {
        name: fileObj.name,
        size: fileObj.size,
        type: fileObj.type
      });
      
      const uploadedFile = await this.openai.files.create({
        file: fileObj,
        purpose: purpose
      });

      console.log(`✅ File uploaded successfully: ${uploadedFile.id}`);
      return {
        id: uploadedFile.id,
        filename: filename,
        purpose: uploadedFile.purpose,
        status: uploadedFile.status,
        created_at: uploadedFile.created_at,
        bytes: uploadedFile.bytes
      };
    } catch (error) {
      console.error('Error uploading file to OpenAI:', error);
      console.error('Error details:', {
        status: error.status,
        message: error.message,
        errorType: error.constructor?.name,
        fileType: fileBuffer?.constructor?.name,
        fileSize: fileBuffer?.length,
        isBuffer: Buffer.isBuffer(fileBuffer),
        filename: filename,
        purpose: purpose,
        errorCode: error.code,
        errorParam: error.param
      });
      
      // Log the full error object for debugging
      if (error.response) {
        console.error('Error response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          headers: error.response.headers,
          data: error.response.data
        });
      }
      
      if (error.status === 413) {
        console.error(`❌ File too large - Buffer size: ${fileBuffer?.length || 'unknown'} bytes`);
        console.error(`❌ Filename: ${filename}`);
        throw new Error(`File size exceeds OpenAI's capacity limit. File size: ${fileBuffer?.length || 'unknown'} bytes`);
      }
      
      if (error.status === 400) {
        console.error(`❌ Bad request - The SDK may not recognize the file format`);
        console.error(`❌ Try checking OpenAI SDK version compatibility`);
      }
      
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
      
      // Get tags from KnowledgeBase model
      const KnowledgeBase = (await import('../models/KnowledgeBase.js')).default;
      const kbFiles = await KnowledgeBase.find({ openaiFileId: { $exists: true } });
      const tagsMap = new Map();
      const driftMap = new Map();
      
      kbFiles.forEach(kbFile => {
        if (kbFile.openaiFileId) {
          tagsMap.set(kbFile.openaiFileId, kbFile.tags || []);
          driftMap.set(kbFile.openaiFileId, {
            hasDrift: kbFile.hasDrift || false,
            driftScore: kbFile.driftScore || 0,
            lastIngested: kbFile.lastIngested,
            status: kbFile.status
          });
        }
      });
      
      // Enrich files with vector store status, tags, and drift info
      const enrichedFiles = files.data.map(file => {
        const metadata = driftMap.get(file.id) || {};
        return {
          id: file.id,
          filename: file.filename,
          purpose: file.purpose,
          status: file.status || metadata.status || 'processed',
          created_at: file.created_at,
          bytes: file.bytes,
          inVectorStore: vectorStoreFileIds.has(file.id),
          tags: tagsMap.get(file.id) || [],
          hasDrift: metadata.hasDrift || false,
          driftScore: metadata.driftScore || 0,
          lastIngested: metadata.lastIngested
        };
      });

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

  // Get file content for viewing (streaming approach)
  async getFileContent(fileId) {
    try {
      console.log(`📄 Fetching content for file: ${fileId}`);
      
      // Get file details
      const file = await this.openai.files.retrieve(fileId);
      
      // Check if file can be downloaded
      if (file.purpose === 'assistants') {
        return {
          id: file.id,
          filename: file.filename,
          purpose: file.purpose,
          status: file.status,
          created_at: file.created_at,
          bytes: file.bytes,
          content: `⚠️ File Access Restricted\n\nThis file was uploaded with purpose "assistants" and cannot be downloaded directly due to OpenAI security restrictions.\n\nFile: ${file.filename}\nSize: ${file.bytes} bytes\nStatus: ${file.status}\nPurpose: ${file.purpose}\n\nTo view file content, you would need to:\n1. Re-upload the file with purpose "fine-tune"\n2. Or implement a different file storage solution\n3. Or use the file search functionality to find relevant content`,
          contentType: 'restricted'
        };
      }
      
      // Download file content from OpenAI
      const fileContent = await this.openai.files.content(fileId);
      const buffer = Buffer.from(await fileContent.arrayBuffer());
      
      let extractedContent = '';
      let contentType = 'text';
      
      // Process based on file type
      if (file.filename.endsWith('.pdf')) {
        console.log('📄 Processing PDF file...');
        try {
          // Dynamic import for CommonJS module
          const pdfParse = await import('pdf-parse');
          const pdfData = await pdfParse.default(buffer);
          extractedContent = pdfData.text;
          contentType = 'pdf';
          console.log(`✅ PDF processed: ${extractedContent.length} characters extracted`);
        } catch (pdfError) {
          console.error('PDF parsing error:', pdfError);
          extractedContent = `Error processing PDF: ${pdfError.message}\n\nFile: ${file.filename}\nSize: ${file.bytes} bytes`;
        }
      } else if (file.filename.endsWith('.txt') || file.filename.endsWith('.md') || file.filename.endsWith('.html')) {
        console.log('📄 Processing text file...');
        extractedContent = buffer.toString('utf-8');
        contentType = 'text';
        console.log(`✅ Text file processed: ${extractedContent.length} characters`);
      } else if (file.filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        console.log('📄 Processing image file...');
        extractedContent = buffer.toString('base64');
        contentType = 'image';
        console.log(`✅ Image processed: ${extractedContent.length} characters (base64)`);
      } else {
        console.log('📄 Processing unknown file type...');
        extractedContent = `File: ${file.filename}\nSize: ${file.bytes} bytes\nType: ${file.purpose}\n\nContent preview (first 1000 characters):\n${buffer.toString('utf-8').substring(0, 1000)}${buffer.length > 1000 ? '...' : ''}`;
        contentType = 'unknown';
      }
      
      return {
        id: file.id,
        filename: file.filename,
        purpose: file.purpose,
        status: file.status,
        created_at: file.created_at,
        bytes: file.bytes,
        content: extractedContent,
        contentType: contentType
      };
    } catch (error) {
      console.error('Error fetching file content:', error);
      throw new Error(`Failed to fetch file content: ${error.message}`);
    }
  }

  // Update file tags (stored in KnowledgeBase model)
  async updateFileTags(fileId, tags) {
    try {
      console.log(`🏷️ Updating tags for file: ${fileId}`);
      
      const KnowledgeBase = (await import('../models/KnowledgeBase.js')).default;
      
      // Find or create KnowledgeBase entry for this OpenAI file
      let kbFile = await KnowledgeBase.findOne({ openaiFileId: fileId });
      
      if (!kbFile) {
        // Get file info from OpenAI to create a minimal KB entry
        const file = await this.getFile(fileId);
        
        // Determine file type from filename
        let fileType = 'text/plain';
        if (file.filename.endsWith('.pdf')) {
          fileType = 'application/pdf';
        } else if (file.filename.endsWith('.html')) {
          fileType = 'text/html';
        } else if (file.filename.endsWith('.md')) {
          fileType = 'text/markdown';
        }
        
        // Create minimal KB entry for metadata storage
        // Use placeholder values for required fields since this is metadata-only
        kbFile = new KnowledgeBase({
          title: file.filename,
          filename: file.filename,
          originalName: file.filename,
          fileType: fileType,
          fileSize: file.bytes || 0,
          content: `[Metadata-only entry] File stored in OpenAI. File ID: ${fileId}`,
          uploadPath: `openai://${fileId}`, // Placeholder path for OpenAI files
          openaiFileId: fileId,
          tags: tags,
          status: 'Active'
        });
      } else {
        // Update existing entry
        kbFile.tags = tags;
      }
      
      await kbFile.save();
      
      console.log(`✅ Tags updated for file: ${fileId}`);
      return {
        id: fileId,
        tags: tags
      };
    } catch (error) {
      console.error('Error updating file tags:', error);
      throw new Error(`Failed to update file tags: ${error.message}`);
    }
  }

  // Upload text content directly to vector store (for Q&A pairs)
  async uploadTextToVectorStore(content, filename) {
    try {
      console.log(`📝 Uploading text content directly to vector store: ${filename}`);
      const buffer = Buffer.from(content, 'utf-8');
      const fileObj = await toFile(buffer, filename);
      const result = await this.openai.vectorStores.files.uploadAndPoll(
        this.vectorStoreId,
        fileObj
      );
      console.log(`✅ Text content uploaded to vector store: ${result.id}, status: ${result.status}`);
      return result;
    } catch (error) {
      console.error('Error uploading text to vector store:', error);
      throw new Error(`Failed to upload text to vector store: ${error.message}`);
    }
  }
}

export default new OpenAIFilesService();
