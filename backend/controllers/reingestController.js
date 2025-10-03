import reingestService from '../services/reingestService.js';

// Get reingest status
export const getReingestStatus = async (req, res) => {
  try {
    const status = reingestService.getReingestStatus();
    res.json({ status: "success", ...status });
  } catch (err) {
    console.error("Error getting reingest status:", err);
    res.status(500).json({ status: "error", message: "Failed to get reingest status" });
  }
};

// Start reingest process
export const startReingest = async (req, res) => {
  try {
    const { fileIds } = req.body;
    const result = await reingestService.reingestFiles(fileIds);
    res.json({ status: "success", ...result });
  } catch (err) {
    console.error("Error starting reingest:", err);
    res.status(500).json({ status: "error", message: "Failed to start reingest" });
  }
};

// Get files needing reingest
export const getFilesNeedingReingest = async (req, res) => {
  try {
    const files = await reingestService.getFilesNeedingReingest();
    res.json({ status: "success", files });
  } catch (err) {
    console.error("Error getting files needing reingest:", err);
    res.status(500).json({ status: "error", message: "Failed to get files needing reingest" });
  }
};

// Schedule reingest
export const scheduleReingest = async (req, res) => {
  try {
    const { fileIds, delay } = req.body;
    const result = await reingestService.scheduleReingest(fileIds, delay);
    res.json({ status: "success", ...result });
  } catch (err) {
    console.error("Error scheduling reingest:", err);
    res.status(500).json({ status: "error", message: "Failed to schedule reingest" });
  }
};
