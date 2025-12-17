import { BaseService } from './baseService';

/**
 * Payment Gateway Service
 * Handles payment gateway configuration
 * @extends BaseService
 */
class PaymentGatewayService extends BaseService {
  constructor() {
    super('/api/system', {
      dataPath: null,
      normalizeResponse: true
    });
  }

  /**
   * Get payment gateway configuration
   * @returns {Promise<Object>} Payment gateway configuration
   */
  async getPaymentGatewayConfig() {
    return this.get('/payment-gateway/config');
  }

  /**
   * Update payment gateway configuration
   * @param {Object} config - Payment gateway configuration
   * @returns {Promise<Object>} Updated configuration
   */
  async updatePaymentGatewayConfig(config) {
    return this.put('/payment-gateway/config', config);
  }

  /**
   * Test gateway connection
   * @param {string} gatewayType - Gateway type
   * @param {Object} credentials - Gateway credentials (optional, uses saved config if not provided)
   * @returns {Promise<Object>} Test result
   */
  async testConnection(gatewayType, credentials = null) {
    return this.post('/payment-gateway/test-connection', {
      gatewayType,
      credentials
    });
  }

  /**
   * Get supported gateways
   * @returns {Promise<Array>} List of supported gateways
   */
  async getSupportedGateways() {
    return this.get('/payment-gateway/supported-gateways');
  }
}

// Export singleton instance
const paymentGatewayService = new PaymentGatewayService();
export default paymentGatewayService;

