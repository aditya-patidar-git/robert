import openaiFilesService from '../../services/openaiFilesService.js';

// Re-ingest a single file
export const reingestFile = async (req, res) => {
  try {
    const { id } = req.params;
    const reingestService = (await import('../../services/reingestService.js')).default;
    
    // Get file from OpenAI to find corresponding KnowledgeBase entry
    const file = await openaiFilesService.getFile(id);
    
    // Find KnowledgeBase entry by openaiFileId
    const KnowledgeBase = (await import('../../models/KnowledgeBase.js')).default;
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
    const driftDetectionService = (await import('../../services/driftDetectionService.js')).default;
    const openaiFilesService = (await import('../../services/openaiFilesService.js')).default;
    
    // Find KnowledgeBase entry by openaiFileId
    const KnowledgeBase = (await import('../../models/KnowledgeBase.js')).default;
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

