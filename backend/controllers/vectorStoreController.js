import openaiService from '../services/openaiService.js';
import vectorMigrationService from '../services/vectorMigrationService.js';
import modelDiscoveryService from '../services/modelDiscoveryService.js';

// Get vector store status
export const getVectorStoreStatus = async (req, res) => {
  try {
    const vectorStore = await openaiService.getVectorStore();
    const files = await openaiService.listVectorStoreFiles();
    const migrationStatus = vectorMigrationService.getMigrationStatus();
    const discoveryStatus = modelDiscoveryService.getDiscoveryStatus();

    res.json({
      status: "success",
      vectorStore: {
        id: vectorStore.id,
        name: vectorStore.name,
        status: vectorStore.status,
        fileCounts: vectorStore.file_counts,
        created_at: vectorStore.created_at
      },
      files: files.length,
      migration: migrationStatus,
      discovery: discoveryStatus
    });
  } catch (err) {
    console.error("Error getting vector store status:", err);
    // Vector store not configured or not accessible - surface for UI
    res.status(200).json({
      status: "success",
      vectorStore: null,
      vectorStoreError: err.message || "Vector store not available. Set OPENAI_VECTOR_STORE_ID and ensure it is accessible.",
      files: 0,
      migration: vectorMigrationService.getMigrationStatus(),
      discovery: modelDiscoveryService.getDiscoveryStatus()
    });
  }
};

// Search files in vector store
export const searchVectorStore = async (req, res) => {
  try {
    const { query, fileIds, limit = 5 } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        status: "error", 
        message: "Search query is required" 
      });
    }

    const results = await openaiService.searchFiles(
      query, 
      fileIds ? fileIds.split(',') : null, 
      parseInt(limit)
    );

    res.json({
      status: "success",
      query,
      results: results.map(result => ({
        file_id: result.file_id,
        score: result.score,
        content: result.content,
        metadata: result.metadata
      })),
      total_results: results.length
    });
  } catch (err) {
    console.error("Error searching vector store:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Test file search
export const testFileSearch = async (req, res) => {
  try {
    const { query, fileIds } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        status: "error", 
        message: "Test query is required" 
      });
    }

    const results = await openaiService.testFileSearch(query, fileIds);

    res.json({
      status: "success",
      testResults: results
    });
  } catch (err) {
    console.error("Error testing file search:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Get model capabilities
export const getModelCapabilities = async (req, res) => {
  try {
    const { forceRefresh = false } = req.query;
    
    if (forceRefresh === 'true' || modelDiscoveryService.isDiscoveryNeeded()) {
      await modelDiscoveryService.discoverModels();
    }

    const capabilities = modelDiscoveryService.getModelCapabilities();
    const recommended = modelDiscoveryService.getRecommendedModels();

    res.json({
      status: "success",
      capabilities,
      recommended,
      discoveryStatus: modelDiscoveryService.getDiscoveryStatus()
    });
  } catch (err) {
    console.error("Error getting model capabilities:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Get specific model parameters
export const getModelParameters = async (req, res) => {
  try {
    const { modelId } = req.params;
    
    const parameters = modelDiscoveryService.getModelParameters(modelId);
    const capability = modelDiscoveryService.getModelCapability(modelId);

    if (!capability) {
      return res.status(404).json({ 
        status: "error", 
        message: "Model not found" 
      });
    }

    res.json({
      status: "success",
      modelId,
      parameters,
      capability
    });
  } catch (err) {
    console.error("Error getting model parameters:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Start migration
export const startMigration = async (req, res) => {
  try {
    const migrationStatus = vectorMigrationService.getMigrationStatus();
    
    if (migrationStatus.inProgress) {
      return res.status(400).json({ 
        status: "error", 
        message: "Migration already in progress" 
      });
    }

    // Start migration in background
    vectorMigrationService.migrateAllFiles()
      .then(() => {
        console.log('✅ Migration completed successfully');
      })
      .catch((error) => {
        console.error('❌ Migration failed:', error);
      });

    res.json({
      status: "success",
      message: "Migration started",
      migrationStatus: vectorMigrationService.getMigrationStatus()
    });
  } catch (err) {
    console.error("Error starting migration:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Get migration status
export const getMigrationStatus = async (req, res) => {
  try {
    const status = vectorMigrationService.getMigrationStatus();
    const filesNeedingMigration = await vectorMigrationService.getFilesNeedingMigration();
    const filesNeedingSync = await vectorMigrationService.getFilesNeedingSync();

    res.json({
      status: "success",
      migration: status,
      filesNeedingMigration: filesNeedingMigration.length,
      filesNeedingSync: filesNeedingSync.length,
      details: {
        filesNeedingMigration: filesNeedingMigration.map(f => ({
          id: f._id,
          title: f.title,
          status: f.status
        })),
        filesNeedingSync: filesNeedingSync.map(f => ({
          id: f._id,
          title: f.title,
          lastSynced: f.lastSynced
        }))
      }
    });
  } catch (err) {
    console.error("Error getting migration status:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Sync specific file
export const syncFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const result = await vectorMigrationService.syncFile(fileId);

    res.json({
      status: "success",
      message: "File synced successfully",
      file: {
        id: result._id,
        title: result.title,
        openaiFileId: result.openaiFileId,
        lastSynced: result.lastSynced
      }
    });
  } catch (err) {
    console.error("Error syncing file:", err);
    res.status(500).json({ 
      status: "error", 
      message: err.message || "Internal server error" 
    });
  }
};

// Validate vector store
export const validateVectorStore = async (req, res) => {
  try {
    const validation = await vectorMigrationService.validateVectorStore();

    res.json({
      status: "success",
      validation
    });
  } catch (err) {
    console.error("Error validating vector store:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Cleanup orphaned files
export const cleanupOrphanedFiles = async (req, res) => {
  try {
    const cleanup = await vectorMigrationService.cleanupOrphanedFiles();

    res.json({
      status: "success",
      message: "Cleanup completed",
      cleanup
    });
  } catch (err) {
    console.error("Error cleaning up orphaned files:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};





