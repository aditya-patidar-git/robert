import configSyncService from "../services/configSyncService.js";
import websocketService from "../services/websocketService.js";

// Get sync status for all config types
export const getSyncStatus = async (req, res) => {
  try {
    const status = configSyncService.getSyncStatus();
    const clients = websocketService.getClients();
    
    res.json({
      status: "success",
      syncStatus: status,
      connectedClients: clients.length,
      clients: clients
    });
  } catch (err) {
    console.error("Error fetching sync status:", err);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Get sync status for specific config type
export const getConfigSyncStatus = async (req, res) => {
  try {
    const { configType } = req.params;
    const status = configSyncService.getConfigSyncStatus(configType);
    
    res.json({
      status: "success",
      configType,
      syncStatus: status
    });
  } catch (err) {
    console.error("Error fetching config sync status:", err);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Manually trigger config refresh
export const refreshConfig = async (req, res) => {
  try {
    const { configType } = req.body;
    
    if (!configType) {
      return res.status(400).json({
        status: "error",
        message: "Config type is required"
      });
    }

    // Notify all clients to refresh
    configSyncService.notifyConfigChange(configType, null, {
      changedBy: req.user?.id || req.user?.username || 'admin',
      action: 'refresh'
    });

    res.json({
      status: "success",
      message: `Config refresh triggered for ${configType}`
    });
  } catch (err) {
    console.error("Error refreshing config:", err);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

