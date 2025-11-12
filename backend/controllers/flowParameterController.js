import flowParameterService from "../services/flowParameterService.js";
import flowDetectionService from "../services/flowDetectionService.js";

// Get all flow parameter overrides
export const getAllFlowParameters = async (req, res) => {
  try {
    const overrides = await flowParameterService.getAllFlowOverrides();
    res.json({
      status: "success",
      overrides
    });
  } catch (error) {
    console.error("Error getting flow parameters:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get specific flow parameter override
export const getFlowParameter = async (req, res) => {
  try {
    const { flowType } = req.params;
    const override = await flowParameterService.getFlowParameters(flowType);
    
    if (!override) {
      // Return default parameters for this flow type
      const defaults = flowParameterService.getDefaultParametersForFlow(flowType);
      return res.json({
        status: "success",
        override: {
          flowType,
          enabled: false,
          parameters: defaults,
          model: null,
          priority: 0
        }
      });
    }

    res.json({
      status: "success",
      override
    });
  } catch (error) {
    console.error("Error getting flow parameter:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message
    });
  }
};

// Create or update flow parameter override
export const createOrUpdateFlowParameter = async (req, res) => {
  try {
    const { flowType } = req.params;
    const overrideData = req.body;

    // Validate flowType
    const validFlowTypes = ['information', 'booking', 'complaint', 'human_transfer', 'default'];
    if (!validFlowTypes.includes(flowType)) {
      return res.status(400).json({
        status: "error",
        message: `Invalid flow type. Must be one of: ${validFlowTypes.join(', ')}`
      });
    }

    const override = await flowParameterService.updateFlowOverride(flowType, overrideData);
    
    res.json({
      status: "success",
      message: `Flow parameter override for ${flowType} ${override._id ? 'updated' : 'created'} successfully`,
      override
    });
  } catch (error) {
    console.error("Error creating/updating flow parameter:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message
    });
  }
};

// Delete flow parameter override
export const deleteFlowParameter = async (req, res) => {
  try {
    const { flowType } = req.params;
    const deleted = await flowParameterService.deleteFlowOverride(flowType);
    
    if (!deleted) {
      return res.status(404).json({
        status: "error",
        message: `Flow parameter override for ${flowType} not found`
      });
    }

    res.json({
      status: "success",
      message: `Flow parameter override for ${flowType} deleted successfully`
    });
  } catch (error) {
    console.error("Error deleting flow parameter:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message
    });
  }
};

// Detect flow type from text (for testing)
export const detectFlowType = async (req, res) => {
  try {
    const { text, transcript, callContext } = req.body;
    
    if (!text) {
      return res.status(400).json({
        status: "error",
        message: "Text is required for flow detection"
      });
    }

    const flowType = flowDetectionService.detectFlow(
      text,
      transcript || [],
      callContext || {}
    );

    const intent = flowDetectionService.classifyIntent(text);

    res.json({
      status: "success",
      detectedFlow: flowType,
      intent,
      confidence: "medium" // Can be enhanced with actual confidence scoring
    });
  } catch (error) {
    console.error("Error detecting flow type:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message
    });
  }
};

