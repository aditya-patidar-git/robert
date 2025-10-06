import uncertaintyGateService from '../services/uncertaintyGateService.js';

// Validate search results
export const validateResults = async (req, res) => {
  try {
    const { searchResults, options } = req.body;
    const validation = await uncertaintyGateService.validateResults(searchResults, options);
    res.json({ status: "success", validation });
  } catch (err) {
    console.error("Error validating results:", err);
    res.status(500).json({ status: "error", message: "Failed to validate results" });
  }
};

// Generate uncertainty response
export const generateUncertaintyResponse = async (req, res) => {
  try {
    const { validation } = req.body;
    const response = uncertaintyGateService.generateUncertaintyResponse(validation);
    res.json({ status: "success", response });
  } catch (err) {
    console.error("Error generating uncertainty response:", err);
    res.status(500).json({ status: "error", message: "Failed to generate uncertainty response" });
  }
};

// Track uncertainty event
export const trackUncertaintyEvent = async (req, res) => {
  try {
    await uncertaintyGateService.trackUncertaintyEvent(req.body);
    res.json({ status: "success", message: "Uncertainty event tracked" });
  } catch (err) {
    console.error("Error tracking uncertainty event:", err);
    res.status(500).json({ status: "error", message: "Failed to track uncertainty event" });
  }
};

// Get uncertainty gate configuration
export const getConfiguration = async (req, res) => {
  try {
    const config = uncertaintyGateService.getConfiguration();
    res.json({ status: "success", config });
  } catch (err) {
    console.error("Error getting uncertainty gate configuration:", err);
    res.status(500).json({ status: "error", message: "Failed to get uncertainty gate configuration" });
  }
};

// Update uncertainty gate configuration
export const updateConfiguration = async (req, res) => {
  try {
    const { config } = req.body;
    uncertaintyGateService.updateConfiguration(config);
    res.json({ status: "success", message: "Uncertainty gate configuration updated" });
  } catch (err) {
    console.error("Error updating uncertainty gate configuration:", err);
    res.status(500).json({ status: "error", message: "Failed to update uncertainty gate configuration" });
  }
};





