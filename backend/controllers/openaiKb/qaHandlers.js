import openaiFilesService from '../../services/openaiFilesService.js';

// Add Q&A pair directly to vector store
export const addQAPair = async (req, res) => {
  try {
    const { question, answer } = req.body;

    // Validate required fields
    if (!question || !answer) {
      return res.status(400).json({
        status: "error",
        message: "Question and answer are required"
      });
    }

    // Format content as recommended
    const qaContent = `Question: ${question}\n\nAnswer: ${answer}`;

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const filename = `qa-${timestamp}.txt`;

    // Upload directly to vector store using uploadAndPoll
    const vectorStoreFile = await openaiFilesService.uploadTextToVectorStore(qaContent, filename);

    console.log(`✅ Q&A pair added to vector store: ${filename}, file ID: ${vectorStoreFile.id}`);

    res.json({
      status: "success",
      message: "Q&A pair added successfully to vector store",
      file: {
        id: vectorStoreFile.id,
        filename: filename,
        status: vectorStoreFile.status
      }
    });
  } catch (error) {
    console.error("Error adding Q&A pair:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to add Q&A pair to vector store",
      error: error.message
    });
  }
};

