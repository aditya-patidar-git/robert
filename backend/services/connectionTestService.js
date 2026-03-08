import axios from 'axios';

/**
 * Connection Test Service
 * Provides reusable connection testing for various services
 * Used by SIP configuration, Payment Gateway configuration, etc.
 */
class ConnectionTestService {
  /**
   * Test a connection based on type
   * @param {string} type - Connection type ('sip', 'stripe', 'paypal', 'square')
   * @param {Object} config - Configuration object for the connection
   * @returns {Promise<Object>} Test result with status, message, and optional data
   */
  async testConnection(type, config) {
    switch (type) {
      case 'sip':
        return this.testSipConnection(config);
      case 'stripe':
        return this.testStripeConnection(config);
      case 'paypal':
        return this.testPayPalConnection(config);
      case 'square':
        return this.testSquareConnection(config);
      default:
        throw new Error(`Unsupported connection type: ${type}`);
    }
  }

  /**
   * Test SIP endpoint connection
   * @param {Object} config - SIP configuration
   * @param {string} config.openaiSipEndpoint - OpenAI SIP endpoint URL
   * @param {string} config.openaiSipWebhookUrl - Webhook URL for OpenAI
   * @returns {Promise<Object>} Test result
   */
  async testSipConnection(config) {
    try {
      const { openaiSipEndpoint, openaiSipWebhookUrl } = config;

      if (!openaiSipEndpoint) {
        return {
          success: false,
          status: 'failed',
          message: 'OpenAI SIP endpoint is required',
          error: 'Missing openaiSipEndpoint'
        };
      }

      // Validate endpoint format (SIP URI sip:user@host[;params] or sips:..., or HTTPS URL)
      const sipUriPattern = /^sips?:[^@]+@[^;?]+(?:;.+)?(?:\?.+)?$/i;
      const urlPattern = /^https?:\/\/.+/i;

      if (!sipUriPattern.test(openaiSipEndpoint) && !urlPattern.test(openaiSipEndpoint)) {
        return {
          success: false,
          status: 'failed',
          message: 'Invalid SIP endpoint format',
          error: 'Endpoint must be a valid SIP URI (sip:user@host or sip://...) or HTTPS URL'
        };
      }

      // If webhook URL is provided, validate it
      if (openaiSipWebhookUrl) {
        if (!urlPattern.test(openaiSipWebhookUrl)) {
          return {
            success: false,
            status: 'failed',
            message: 'Invalid webhook URL format',
            error: 'Webhook URL must be a valid HTTPS URL'
          };
        }

        // Test webhook URL is reachable (HEAD request)
        try {
          const response = await axios.head(openaiSipWebhookUrl, {
            timeout: 5000,
            validateStatus: (status) => status < 500 // Accept 2xx, 3xx, 4xx but not 5xx
          });
          
          return {
            success: true,
            status: 'success',
            message: 'SIP endpoint and webhook URL are valid',
            data: {
              endpoint: openaiSipEndpoint,
              webhookUrl: openaiSipWebhookUrl,
              webhookStatus: response.status
            }
          };
        } catch (error) {
          return {
            success: false,
            status: 'failed',
            message: 'Webhook URL is not reachable',
            error: error.message
          };
        }
      }

      // If no webhook URL, just validate endpoint format
      return {
        success: true,
        status: 'success',
        message: 'SIP endpoint format is valid',
        data: {
          endpoint: openaiSipEndpoint
        }
      };
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        message: 'Connection test failed',
        error: error.message
      };
    }
  }

  /**
   * Test Stripe API connection
   * @param {Object} config - Stripe configuration
   * @param {string} config.stripeSecretKey - Stripe secret key
   * @returns {Promise<Object>} Test result
   */
  async testStripeConnection(config) {
    try {
      const { stripeSecretKey } = config;

      if (!stripeSecretKey) {
        return {
          success: false,
          status: 'failed',
          message: 'Stripe secret key is required',
          error: 'Missing stripeSecretKey'
        };
      }

      // Validate key format (starts with sk_test_ or sk_live_)
      if (!stripeSecretKey.startsWith('sk_test_') && !stripeSecretKey.startsWith('sk_live_')) {
        return {
          success: false,
          status: 'failed',
          message: 'Invalid Stripe secret key format',
          error: 'Key must start with sk_test_ or sk_live_'
        };
      }

      // Test connection by making a simple API call
      try {
        const response = await axios.get('https://api.stripe.com/v1/account', {
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`
          },
          timeout: 10000
        });

        return {
          success: true,
          status: 'success',
          message: 'Stripe connection successful',
          data: {
            accountId: response.data.id,
            accountType: response.data.type,
            country: response.data.country
          }
        };
      } catch (error) {
        if (error.response) {
          return {
            success: false,
            status: 'failed',
            message: `Stripe API error: ${error.response.data?.error?.message || error.message}`,
            error: error.response.data?.error?.message || 'API request failed'
          };
        }
        throw error;
      }
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        message: 'Connection test failed',
        error: error.message
      };
    }
  }

  /**
   * Test PayPal API connection
   * @param {Object} config - PayPal configuration
   * @param {string} config.paypalClientId - PayPal client ID
   * @param {string} config.paypalClientSecret - PayPal client secret
   * @param {string} config.paypalMode - PayPal mode ('sandbox' or 'live')
   * @returns {Promise<Object>} Test result
   */
  async testPayPalConnection(config) {
    try {
      const { paypalClientId, paypalClientSecret, paypalMode = 'sandbox' } = config;

      if (!paypalClientId || !paypalClientSecret) {
        return {
          success: false,
          status: 'failed',
          message: 'PayPal client ID and secret are required',
          error: 'Missing credentials'
        };
      }

      // Get access token
      const baseUrl = paypalMode === 'live' 
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

      try {
        const authResponse = await axios.post(
          `${baseUrl}/v1/oauth2/token`,
          'grant_type=client_credentials',
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json'
            },
            auth: {
              username: paypalClientId,
              password: paypalClientSecret
            },
            timeout: 10000
          }
        );

        return {
          success: true,
          status: 'success',
          message: 'PayPal connection successful',
          data: {
            mode: paypalMode,
            tokenType: authResponse.data.token_type,
            expiresIn: authResponse.data.expires_in
          }
        };
      } catch (error) {
        if (error.response) {
          return {
            success: false,
            status: 'failed',
            message: `PayPal API error: ${error.response.data?.error_description || error.message}`,
            error: error.response.data?.error_description || 'API request failed'
          };
        }
        throw error;
      }
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        message: 'Connection test failed',
        error: error.message
      };
    }
  }

  /**
   * Test Square API connection
   * @param {Object} config - Square configuration
   * @param {string} config.squareAccessToken - Square access token
   * @param {string} config.squareLocationId - Square location ID
   * @returns {Promise<Object>} Test result
   */
  async testSquareConnection(config) {
    try {
      const { squareAccessToken, squareLocationId } = config;

      if (!squareAccessToken) {
        return {
          success: false,
          status: 'failed',
          message: 'Square access token is required',
          error: 'Missing squareAccessToken'
        };
      }

      // Test connection by making a simple API call
      try {
        const response = await axios.get('https://connect.squareup.com/v2/locations', {
          headers: {
            'Authorization': `Bearer ${squareAccessToken}`,
            'Square-Version': '2023-10-18'
          },
          timeout: 10000
        });

        const locations = response.data.locations || [];
        const locationExists = !squareLocationId || locations.some(loc => loc.id === squareLocationId);

        return {
          success: true,
          status: 'success',
          message: 'Square connection successful',
          data: {
            locationsCount: locations.length,
            locationId: squareLocationId,
            locationValid: locationExists
          }
        };
      } catch (error) {
        if (error.response) {
          return {
            success: false,
            status: 'failed',
            message: `Square API error: ${error.response.data?.errors?.[0]?.detail || error.message}`,
            error: error.response.data?.errors?.[0]?.detail || 'API request failed'
          };
        }
        throw error;
      }
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        message: 'Connection test failed',
        error: error.message
      };
    }
  }
}

export default new ConnectionTestService();

