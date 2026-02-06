import PaymentGatewayConfig from "../models/PaymentGatewayConfig.js";
import paymentGatewayService from "../services/paymentGatewayService.js";
import configSyncService from "../services/configSyncService.js";
import { createAuditLog } from "./auditLogController.js";

// Get current payment gateway config
export const getPaymentGatewayConfig = async (req, res) => {
  try {
    let config = await PaymentGatewayConfig.findOne({ isActive: true });
    
    if (!config) {
      return res.json({
        status: "success",
        config: null
      });
    }

    // Prepare for display (mask sensitive fields)
    const displayConfig = paymentGatewayService.prepareForDisplay(config.toObject());

    res.json({
      status: "success",
      config: displayConfig
    });
  } catch (err) {
    console.error("Error fetching payment gateway config:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Update payment gateway config
export const updatePaymentGatewayConfig = async (req, res) => {
  try {
    const configData = req.body;

    if (!configData.gatewayType) {
      return res.status(400).json({
        status: "error",
        message: "Gateway type is required"
      });
    }

    // Deactivate any existing active configs
    await PaymentGatewayConfig.updateMany(
      { isActive: true },
      { isActive: false }
    );

    // Prepare for storage (encrypt sensitive fields)
    const preparedConfig = paymentGatewayService.prepareForStorage(configData);

    // Create or update config
    let config = await PaymentGatewayConfig.findOne({ gatewayType: configData.gatewayType });
    
    if (!config) {
      config = new PaymentGatewayConfig(preparedConfig);
    } else {
      Object.assign(config, preparedConfig);
    }

    config.isActive = true;
    config.createdBy = req.user?.id || "admin";
    await config.save();

    // Notify config change
    configSyncService.notifyConfigChange('payment-gateway', configData.gatewayType, {
      changedBy: req.user?.id || req.user?.username || 'admin',
      action: 'update'
    });

    // Prepare for response (mask sensitive fields)
    const displayConfig = paymentGatewayService.prepareForDisplay(config.toObject());

    res.json({
      status: "success",
      message: "Payment gateway configuration updated successfully",
      config: displayConfig
    });
  } catch (err) {
    console.error("Error updating payment gateway config:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error",
      error: err.message
    });
  }
};

// Test gateway connection
export const testGatewayConnection = async (req, res) => {
  try {
    const { gatewayType, credentials } = req.body;

    if (!gatewayType) {
      return res.status(400).json({
        status: "error",
        message: "Gateway type is required"
      });
    }

    // Get current config if credentials not provided
    let testCredentials = credentials;
    if (!testCredentials) {
      const config = await PaymentGatewayConfig.findOne({ 
        gatewayType,
        isActive: true 
      });
      
      if (!config || !config.credentials) {
        return res.status(404).json({
          status: "error",
          message: "Payment gateway configuration not found"
        });
      }

      // Decrypt credentials for testing
      testCredentials = paymentGatewayService.decryptCredentials(config.credentials.toObject());
    }

    // Test connection
    const testResult = await paymentGatewayService.testConnection(gatewayType, testCredentials);

    if (req.user) {
      await createAuditLog({
        actorId: req.user._id,
        action: 'secret.access_attempt',
        targetType: 'config',
        targetId: `payment_${gatewayType}`,
        diff: { operation: 'test_connection', success: testResult.success },
        req
      });
    }

    // Update config with test results if config exists
    const config = await PaymentGatewayConfig.findOne({ 
      gatewayType,
      isActive: true 
    });
    
    if (config) {
      config.testConnectionStatus = testResult.success ? 'success' : 'failed';
      config.testConnectionLastAttempt = new Date();
      config.testConnectionError = testResult.error || null;
      await config.save();
    }

    res.json({
      status: "success",
      testResult: {
        success: testResult.success,
        status: testResult.status,
        message: testResult.message,
        error: testResult.error,
        data: testResult.data
      }
    });
  } catch (err) {
    console.error("Error testing gateway connection:", err);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: err.message
    });
  }
};

// Get supported gateways
export const getSupportedGateways = async (req, res) => {
  try {
    const gateways = paymentGatewayService.getSupportedGateways();
    
    res.json({
      status: "success",
      gateways
    });
  } catch (err) {
    console.error("Error fetching supported gateways:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

