import driftDetectionService from '../services/driftDetectionService.js';

// Get drift detection status
export const getDriftStatus = async (req, res) => {
  try {
    const status = await driftDetectionService.getDriftStatus();
    res.json({ status: "success", ...status });
  } catch (err) {
    console.error("Error getting drift status:", err);
    res.status(500).json({ status: "error", message: "Failed to get drift status" });
  }
};

// Start drift detection
export const startDriftDetection = async (req, res) => {
  try {
    const result = await driftDetectionService.detectDrift();
    res.json({ status: "success", ...result });
  } catch (err) {
    console.error("Error starting drift detection:", err);
    res.status(500).json({ status: "error", message: "Failed to start drift detection" });
  }
};

// Get files with drift
export const getFilesWithDrift = async (req, res) => {
  try {
    const files = await driftDetectionService.getFilesWithDrift();
    res.json({ status: "success", files });
  } catch (err) {
    console.error("Error getting files with drift:", err);
    res.status(500).json({ status: "error", message: "Failed to get files with drift" });
  }
};

// Clear drift flags
export const clearDriftFlags = async (req, res) => {
  try {
    const { fileIds } = req.body;
    const result = await driftDetectionService.clearDriftFlags(fileIds);
    res.json({ status: "success", ...result });
  } catch (err) {
    console.error("Error clearing drift flags:", err);
    res.status(500).json({ status: "error", message: "Failed to clear drift flags" });
  }
};





