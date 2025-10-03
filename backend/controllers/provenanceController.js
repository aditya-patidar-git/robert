import provenanceService from '../services/provenanceService.js';

// Track file usage
export const trackFileUsage = async (req, res) => {
  try {
    const result = await provenanceService.trackFileUsage(req.body);
    res.json({ status: "success", provenance: result });
  } catch (err) {
    console.error("Error tracking file usage:", err);
    res.status(500).json({ status: "error", message: "Failed to track file usage" });
  }
};

// Get call provenance
export const getCallProvenance = async (req, res) => {
  try {
    const { callId } = req.params;
    const provenance = await provenanceService.getCallProvenance(callId);
    res.json({ status: "success", provenance });
  } catch (err) {
    console.error("Error getting call provenance:", err);
    res.status(500).json({ status: "error", message: "Failed to get call provenance" });
  }
};

// Get file provenance
export const getFileProvenance = async (req, res) => {
  try {
    const { fileId } = req.params;
    const provenance = await provenanceService.getFileProvenance(fileId);
    res.json({ status: "success", provenance });
  } catch (err) {
    console.error("Error getting file provenance:", err);
    res.status(500).json({ status: "error", message: "Failed to get file provenance" });
  }
};

// Get provenance analytics
export const getProvenanceAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, fileId, callId, userId } = req.query;
    const analytics = await provenanceService.getProvenanceAnalytics({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      fileId,
      callId,
      userId
    });
    res.json({ status: "success", analytics });
  } catch (err) {
    console.error("Error getting provenance analytics:", err);
    res.status(500).json({ status: "error", message: "Failed to get provenance analytics" });
  }
};

// Get file usage stats
export const getFileUsageStats = async (req, res) => {
  try {
    const { fileId } = req.params;
    const stats = await provenanceService.getFileUsageStats(fileId);
    res.json({ status: "success", stats });
  } catch (err) {
    console.error("Error getting file usage stats:", err);
    res.status(500).json({ status: "error", message: "Failed to get file usage stats" });
  }
};

// Export provenance data
export const exportProvenanceData = async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    const data = await provenanceService.exportProvenanceData(
      userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );
    res.json({ status: "success", data });
  } catch (err) {
    console.error("Error exporting provenance data:", err);
    res.status(500).json({ status: "error", message: "Failed to export provenance data" });
  }
};

// Cleanup old records
export const cleanupOldRecords = async (req, res) => {
  try {
    const result = await provenanceService.cleanupOldRecords();
    res.json({ status: "success", ...result });
  } catch (err) {
    console.error("Error cleaning up old records:", err);
    res.status(500).json({ status: "error", message: "Failed to cleanup old records" });
  }
};
