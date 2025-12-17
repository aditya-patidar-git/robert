import modelDiscoveryService from "../services/modelDiscoveryService.js";

// Get model capabilities (existing)
export const getModelCapabilities = async (req, res) => {
  try {
    const capabilities = modelDiscoveryService.getModelCapabilities();
    
    res.json({
      status: "success",
      capabilities
    });
  } catch (err) {
    console.error("Error fetching model capabilities:", err);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Get model history
export const getModelHistory = async (req, res) => {
  try {
    const { modelId } = req.params;
    const history = await modelDiscoveryService.getModelHistory(modelId);
    
    res.json({
      status: "success",
      history
    });
  } catch (err) {
    console.error("Error fetching model history:", err);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Get all model history
export const getAllModelHistory = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      modelId: req.query.modelId
    };
    
    const history = await modelDiscoveryService.getAllModelHistory(filters);
    
    res.json({
      status: "success",
      history
    });
  } catch (err) {
    console.error("Error fetching all model history:", err);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Get model alerts
export const getModelAlerts = async (req, res) => {
  try {
    const alerts = await modelDiscoveryService.getModelAlerts();
    
    res.json({
      status: "success",
      alerts
    });
  } catch (err) {
    console.error("Error fetching model alerts:", err);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Manually trigger model discovery
export const refreshModels = async (req, res) => {
  try {
    const models = await modelDiscoveryService.discoverModels();
    
    res.json({
      status: "success",
      message: "Model discovery completed",
      models: models.length
    });
  } catch (err) {
    console.error("Error refreshing models:", err);
    res.status(500).json({
      status: "error",
      message: err.message || "Internal server error"
    });
  }
};

