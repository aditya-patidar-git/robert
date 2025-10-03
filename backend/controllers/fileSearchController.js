import fileSearchService from '../services/fileSearchService.js';

// Search files using OpenAI File Search
export const searchFiles = async (req, res) => {
  try {
    const { 
      query, 
      maxResults = 5, 
      similarityThreshold = 0.7, 
      tags = [],
      fileIds = null 
    } = req.body;

    if (!query) {
      return res.status(400).json({
        status: "error",
        message: "Search query is required"
      });
    }

    const searchOptions = {
      maxResults: parseInt(maxResults),
      similarityThreshold: parseFloat(similarityThreshold),
      tags: Array.isArray(tags) ? tags : [],
      fileIds: fileIds ? (Array.isArray(fileIds) ? fileIds : [fileIds]) : null
    };

    const results = await fileSearchService.searchFiles(query, searchOptions);

    res.json({
      status: "success",
      data: results
    });

  } catch (error) {
    console.error("Error searching files:", error);
    res.status(500).json({
      status: "error",
      message: "File search failed",
      error: error.message
    });
  }
};

// Search files by tags (as per documentation)
export const searchFilesByTags = async (req, res) => {
  try {
    const { query, tags = [] } = req.body;

    if (!query) {
      return res.status(400).json({
        status: "error",
        message: "Search query is required"
      });
    }

    const results = await fileSearchService.searchFilesByTags(query, tags);

    res.json({
      status: "success",
      data: results
    });

  } catch (error) {
    console.error("Error searching files by tags:", error);
    res.status(500).json({
      status: "error",
      message: "Tag-based file search failed",
      error: error.message
    });
  }
};

// Get file content by ID
export const getFileContent = async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!fileId) {
      return res.status(400).json({
        status: "error",
        message: "File ID is required"
      });
    }

    const content = await fileSearchService.getFileContent(fileId);

    res.json({
      status: "success",
      data: content
    });

  } catch (error) {
    console.error("Error getting file content:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to get file content",
      error: error.message
    });
  }
};

// Get vector store status
export const getVectorStoreStatus = async (req, res) => {
  try {
    const status = await fileSearchService.getVectorStoreStatus();

    res.json({
      status: "success",
      data: status
    });

  } catch (error) {
    console.error("Error getting vector store status:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to get vector store status",
      error: error.message
    });
  }
};

// Test search functionality
export const testSearch = async (req, res) => {
  try {
    const testResults = await fileSearchService.testSearch();

    res.json({
      status: "success",
      data: testResults
    });

  } catch (error) {
    console.error("Error testing search:", error);
    res.status(500).json({
      status: "error",
      message: "Search test failed",
      error: error.message
    });
  }
};
