import openaiFilesService from '../services/openaiFilesService.js';
import multer from 'multer';
import path from 'path';

// Configure multer for file uploads (temporary storage before OpenAI upload)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit (OpenAI's limit)
  },
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/html',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, TXT, MD, HTML, DOC, DOCX files are allowed.'), false);
    }
  }
});

// Get all files from OpenAI
export const getAllFiles = async (req, res) => {
  try {
    const files = await openaiFilesService.getAllFiles();
    
    res.json({
      status: "success",
      files,
      total: files.length
    });
  } catch (error) {
    console.error("Error fetching files:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch files",
      error: error.message
    });
  }
};

// Get file by ID
export const getFile = async (req, res) => {
  try {
    const { id } = req.params;
    const file = await openaiFilesService.getFile(id);
    
    res.json({
      status: "success",
      file
    });
  } catch (error) {
    console.error("Error fetching file:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch file",
      error: error.message
    });
  }
};

// Upload file to OpenAI
export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "No file provided"
      });
    }

    const { originalname, buffer, mimetype } = req.file;
    const { tags = [] } = req.body;

    // Upload file to OpenAI
    const uploadedFile = await openaiFilesService.uploadFile(
      buffer,
      originalname,
      'assistants'
    );

    // Add file to vector store
    const vectorStoreFile = await openaiFilesService.addFileToVectorStore(uploadedFile.id);

    res.json({
      status: "success",
      message: "File uploaded successfully",
      file: {
        ...uploadedFile,
        vectorStoreFileId: vectorStoreFile.id,
        tags: Array.isArray(tags) ? tags : []
      }
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to upload file",
      error: error.message
    });
  }
};

// Delete file from OpenAI
export const deleteFile = async (req, res) => {
  try {
    const { id } = req.params;
    
    await openaiFilesService.deleteFile(id);
    
    res.json({
      status: "success",
      message: "File deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to delete file",
      error: error.message
    });
  }
};

// Search files using OpenAI File Search
export const searchFiles = async (req, res) => {
  try {
    const { query, fileIds } = req.body;
    
    if (!query) {
      return res.status(400).json({
        status: "error",
        message: "Search query is required"
      });
    }

    const results = await openaiFilesService.searchFiles(query, fileIds);
    
    res.json({
      status: "success",
      ...results
    });
  } catch (error) {
    console.error("Error searching files:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to search files",
      error: error.message
    });
  }
};

// Get vector store status
export const getVectorStoreStatus = async (req, res) => {
  try {
    const status = await openaiFilesService.getVectorStoreStatus();
    
    res.json({
      status: "success",
      vectorStore: status
    });
  } catch (error) {
    console.error("Error fetching vector store status:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch vector store status",
      error: error.message
    });
  }
};

// Export multer middleware for use in routes
export { upload };
