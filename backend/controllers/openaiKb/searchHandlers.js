import openaiFilesService from '../../services/openaiFilesService.js';

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

