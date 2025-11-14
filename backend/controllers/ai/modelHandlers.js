// Get available models from discovery service
export const getModels = async (req, res) => {
  try {
    const { forceRefresh = false } = req.query;
    
    // Import model discovery service
    const modelDiscoveryService = (await import('../../services/modelDiscoveryService.js')).default;
    
    // Force refresh if requested or if discovery is needed
    if (forceRefresh === 'true' || modelDiscoveryService.isDiscoveryNeeded()) {
      await modelDiscoveryService.discoverModels();
    }

    const models = modelDiscoveryService.getModelCapabilities();

    res.json({
      status: "success",
      models
    });
  } catch (err) {
    console.error("Error fetching models:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Get recommended fallback chain
export const getRecommendedFallbackChain = async (req, res) => {
  try {
    const modelDiscoveryService = (await import('../../services/modelDiscoveryService.js')).default;
    
    // Ensure models are discovered
    if (modelDiscoveryService.isDiscoveryNeeded()) {
      await modelDiscoveryService.discoverModels();
    }
    
    const fallbackChain = modelDiscoveryService.buildFallbackChain('realtime');
    
    res.json({
      status: "success",
      fallbackChain
    });
  } catch (err) {
    console.error("Error generating fallback chain:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Get model parameters for a specific model
export const getModelParameters = async (req, res) => {
  try {
    const { modelId } = req.query;
    if (!modelId) {
      return res.status(400).json({ 
        status: "error", 
        message: "modelId is required" 
      });
    }
    const modelDiscoveryService = (await import('../../services/modelDiscoveryService.js')).default;
    
    // Ensure models are discovered
    if (modelDiscoveryService.isDiscoveryNeeded()) {
      await modelDiscoveryService.discoverModels();
    }
    
    const parameters = modelDiscoveryService.getModelParameters(modelId);
    res.json({ status: "success", parameters });
  } catch (err) {
    console.error("Error getting model parameters:", err);
    res.status(500).json({ 
      status: "error", 
      message: err.message || "Internal server error" 
    });
  }
};

// Get all model capabilities and discovery status
export const getModelCapabilities = async (req, res) => {
  try {
    const modelDiscoveryService = (await import('../../services/modelDiscoveryService.js')).default;
    
    // Ensure models are discovered
    if (modelDiscoveryService.isDiscoveryNeeded()) {
      await modelDiscoveryService.discoverModels();
    }
    
    const capabilities = modelDiscoveryService.getModelCapabilities();
    const discoveryStatus = modelDiscoveryService.getDiscoveryStatus();
    
    res.json({
      status: "success",
      capabilities,
      discoveryStatus
    });
  } catch (error) {
    console.error("Error getting model capabilities:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Internal server error"
    });
  }
};

