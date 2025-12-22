import alertService from "../services/alertService.js";

/**
 * Send abuse alert
 * Called by agent service when abuse is detected
 */
export const sendAbuseAlert = async (req, res) => {
  try {
    const { callerId, reason, metadata } = req.body;

    if (!callerId || !reason) {
      return res.status(400).json({
        success: false,
        error: "callerId and reason are required"
      });
    }

    const result = await alertService.sendAbuseAlert(callerId, reason, metadata);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error("Error sending abuse alert:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Test alert configuration
 */
export const testAlertConfiguration = async (req, res) => {
  try {
    const config = await alertService.testAlertConfiguration();

    res.json({
      success: true,
      config
    });
  } catch (error) {
    console.error("Error testing alert configuration:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Send test alert
 */
export const sendTestAlert = async (req, res) => {
  try {
    const result = await alertService.sendTestAlert();

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error("Error sending test alert:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

