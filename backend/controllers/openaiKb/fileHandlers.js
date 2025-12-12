import openaiFilesService from '../../services/openaiFilesService.js';
import multer from 'multer';

// Configure multer for file uploads (temporary storage before OpenAI upload)
const storage = multer.memoryStorage();
export const upload = multer({
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
      'assistants' // Changed from 'assistants' to allow downloads
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

