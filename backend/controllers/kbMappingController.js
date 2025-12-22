import kbMappingService from "../services/kbMappingService.js";

/**
 * Get all mappings
 */
export const getAllMappings = async (req, res) => {
  try {
    const mappings = await kbMappingService.getAllMappings();
    res.json({
      success: true,
      mappings
    });
  } catch (error) {
    console.error("Error getting mappings:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get mapping by file ID
 */
export const getMappingByFileId = async (req, res) => {
  try {
    const { fileId } = req.params;
    const mapping = await kbMappingService.getMappingByFileId(fileId);
    
    if (!mapping) {
      return res.status(404).json({
        success: false,
        error: "Mapping not found"
      });
    }

    res.json({
      success: true,
      mapping
    });
  } catch (error) {
    console.error("Error getting mapping:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Save mapping (create or update)
 */
export const saveMapping = async (req, res) => {
  try {
    const { fileId } = req.params || req.body;
    const { url, selector } = req.body;

    const mapping = await kbMappingService.saveMapping({
      fileId: fileId || req.body.fileId,
      url,
      selector
    });

    res.json({
      success: true,
      mapping
    });
  } catch (error) {
    console.error("Error saving mapping:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Delete mapping
 */
export const deleteMapping = async (req, res) => {
  try {
    const { fileId } = req.params;
    await kbMappingService.deleteMapping(fileId);

    res.json({
      success: true,
      message: "Mapping deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting mapping:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Bulk import mappings
 */
export const bulkImportMappings = async (req, res) => {
  try {
    const { mappings } = req.body;

    if (!Array.isArray(mappings)) {
      return res.status(400).json({
        success: false,
        error: "Mappings must be an array"
      });
    }

    const result = await kbMappingService.bulkImportMappings(mappings);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error("Error in bulk import:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Export mappings
 */
export const exportMappings = async (req, res) => {
  try {
    const mappings = await kbMappingService.exportMappings();

    res.json({
      success: true,
      mappings
    });
  } catch (error) {
    console.error("Error exporting mappings:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Sync mappings with database
 */
export const syncWithDatabase = async (req, res) => {
  try {
    const result = await kbMappingService.syncWithDatabase();

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error("Error syncing mappings:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Validate URL
 */
export const validateUrl = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: "URL is required"
      });
    }

    const result = await kbMappingService.validateUrl(url);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error("Error validating URL:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Test mapping
 */
export const testMapping = async (req, res) => {
  try {
    const { fileId } = req.params;
    const result = await kbMappingService.testMapping(fileId);

    res.json({
      success: result.success,
      ...result
    });
  } catch (error) {
    console.error("Error testing mapping:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

