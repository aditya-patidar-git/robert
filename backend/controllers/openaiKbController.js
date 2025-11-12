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
    let { tags } = req.body;

    // Parse tags if they come as JSON string
    if (typeof tags === 'string') {
      try {
        tags = JSON.parse(tags);
      } catch (e) {
        // If not JSON, treat as comma-separated string
        tags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      }
    }

    if (!Array.isArray(tags)) {
      tags = [];
    }

    // Upload file to OpenAI
    const uploadedFile = await openaiFilesService.uploadFile(
      buffer,
      originalname,
      'fine-tune' // Changed from 'assistants' to allow downloads
    );

    // Add file to vector store
    const vectorStoreFile = await openaiFilesService.addFileToVectorStore(uploadedFile.id);

    // Store tags in KnowledgeBase model
    if (tags.length > 0) {
      await openaiFilesService.updateFileTags(uploadedFile.id, tags);
    }

    res.json({
      status: "success",
      message: "File uploaded successfully",
      file: {
        ...uploadedFile,
        vectorStoreFileId: vectorStoreFile.id,
        tags: tags
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

// Get file content for viewing
export const getFileContent = async (req, res) => {
  try {
    const { id } = req.params;
    const content = await openaiFilesService.getFileContent(id);

    res.json({
      status: "success",
      content
    });
  } catch (error) {
    console.error("Error fetching file content:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch file content",
      error: error.message
    });
  }
};

// Update file tags
export const updateFileTags = async (req, res) => {
  try {
    const { id } = req.params;
    const { tags } = req.body;

    if (!Array.isArray(tags)) {
      return res.status(400).json({
        status: "error",
        message: "Tags must be an array"
      });
    }

    // Store tags in KnowledgeBase model
    const result = await openaiFilesService.updateFileTags(id, tags);

    res.json({
      status: "success",
      message: "File tags updated successfully",
      file: {
        id,
        tags: result.tags || tags
      }
    });
  } catch (error) {
    console.error("Error updating file tags:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update file tags",
      error: error.message
    });
  }
};

// Re-ingest a single file
export const reingestFile = async (req, res) => {
  try {
    const { id } = req.params;
    const reingestService = (await import('../services/reingestService.js')).default;
    
    // Get file from OpenAI to find corresponding KnowledgeBase entry
    const file = await openaiFilesService.getFile(id);
    
    // Find KnowledgeBase entry by openaiFileId
    const KnowledgeBase = (await import('../models/KnowledgeBase.js')).default;
    const kbFile = await KnowledgeBase.findOne({ openaiFileId: id });
    
    if (!kbFile) {
      // If no KB entry exists, create a minimal one or just re-upload to vector store
      // For now, we'll just re-add to vector store
      await openaiFilesService.addFileToVectorStore(id);
      return res.json({
        status: "success",
        message: "File re-added to vector store",
        file: { id }
      });
    }

    // Use reingest service to reingest the file
    await reingestService.reingestFile(kbFile);

    res.json({
      status: "success",
      message: "File reingested successfully",
      file: {
        id,
        status: 'Active'
      }
    });
  } catch (error) {
    console.error("Error reingesting file:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to reingest file",
      error: error.message
    });
  }
};

// Detect drift for a single file
export const detectFileDrift = async (req, res) => {
  try {
    const { id } = req.params;
    const driftDetectionService = (await import('../services/driftDetectionService.js')).default;
    const openaiFilesService = (await import('../services/openaiFilesService.js')).default;
    
    // Find KnowledgeBase entry by openaiFileId
    const KnowledgeBase = (await import('../models/KnowledgeBase.js')).default;
    let kbFile = await KnowledgeBase.findOne({ openaiFileId: id });
    
    if (!kbFile) {
      // If no KB entry exists, get file info from OpenAI
      const file = await openaiFilesService.getFile(id);
      
      // Determine file type from filename
      let fileType = 'text/plain';
      if (file.filename.endsWith('.pdf')) {
        fileType = 'application/pdf';
      } else if (file.filename.endsWith('.html')) {
        fileType = 'text/html';
      } else if (file.filename.endsWith('.md')) {
        fileType = 'text/markdown';
      }
      
      // Create a temporary file object for drift detection
      // This handles files that were uploaded directly to OpenAI without a KnowledgeBase entry
      const tempFile = {
        _id: null,
        title: file.filename,
        filename: file.filename,
        updatedAt: new Date(file.created_at * 1000),
        createdAt: new Date(file.created_at * 1000),
        hasDrift: false,
        driftScore: 0,
        status: 'Active'
      };
      
      // Perform drift check on the temporary file
      const driftResult = await driftDetectionService.checkFileDrift(tempFile);
      
      // IMPORTANT: If drift is detected, create a KnowledgeBase entry to persist the drift status
      // This ensures the UI can display the drift status after refresh and enables re-ingest functionality
      if (driftResult.hasDrift) {
        kbFile = new KnowledgeBase({
          title: file.filename,
          filename: file.filename,
          originalName: file.filename,
          fileType: fileType,
          fileSize: file.bytes || 0,
          content: `[Metadata-only entry] File stored in OpenAI. File ID: ${id}`,
          uploadPath: `openai://${id}`,
          openaiFileId: id,
          tags: [],
          status: 'Active',
          hasDrift: true,
          driftScore: driftResult.driftScore,
          lastDriftCheck: new Date()
        });
        await kbFile.save();
        
        // Update the driftResult to use the saved file ID for consistency
        driftResult.fileId = kbFile._id;
      }
      
      return res.json({
        status: "success",
        drift: driftResult,
        note: driftResult.hasDrift ? "Drift detected and saved to database" : "File metadata only - no KnowledgeBase entry found"
      });
    }

    // Check drift for existing file (this will update the database via checkFileDrift)
    const driftResult = await driftDetectionService.checkFileDrift(kbFile);

    res.json({
      status: "success",
      drift: driftResult
    });
  } catch (error) {
    console.error("Error detecting file drift:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to detect file drift",
      error: error.message
    });
  }
};

// Export multer middleware for use in routes
export { upload };
