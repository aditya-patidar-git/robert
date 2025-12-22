import twilio from 'twilio';

/**
 * Twilio Pay Service
 * Handles payment processing via Twilio <Pay> for phone-based payments
 */
class TwilioPayService {
  constructor() {
    this.twilioClient = null;
    this.initializeTwilio();
  }

  /**
   * Initialize Twilio client
   */
  initializeTwilio() {
    try {
      const accountSid = process.env.TWILIO_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (!accountSid || !authToken) {
        console.warn('⚠️ Twilio credentials not configured');
        return;
      }

      this.twilioClient = twilio(accountSid, authToken);
      console.log('✅ Twilio Pay Service initialized');
    } catch (error) {
      console.error('❌ Error initializing Twilio Pay Service:', error);
    }
  }

  /**
   * Generate TwiML for payment collection
   * @param {Object} options - Payment options
   * @returns {string} TwiML XML string
   */
  generatePaymentTwiML(options = {}) {
    const {
      amount,
      currency = 'GBP',
      description = 'Course booking payment',
      paymentConnector = process.env.TWILIO_PAY_CONNECTOR || 'default',
      action = '/api/payments/twilio-pay/status',
      timeout = 30,
      maxAttempts = 3
    } = options;

    if (!amount) {
      throw new Error('Payment amount is required');
    }

    // Twilio <Pay> TwiML
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Please enter your payment details to complete your booking.</Say>
  <Pay 
    chargeAmount="${amount}"
    currency="${currency}"
    description="${description}"
    paymentConnector="${paymentConnector}"
    action="${action}"
    timeout="${timeout}"
    maxAttempts="${maxAttempts}"
    postalCode="true"
    securityCode="true"
    paymentMethod="credit-card"
  >
    <Prompt for="payment-card-number">
      <Say>Please enter your card number.</Say>
    </Prompt>
    <Prompt for="expiration-date">
      <Say>Please enter the expiration date on your card, two digits for the month and two digits for the year.</Say>
    </Prompt>
    <Prompt for="security-code">
      <Say>Please enter the security code on your card.</Say>
    </Prompt>
    <Prompt for="postal-code">
      <Say>Please enter your billing postal code.</Say>
    </Prompt>
  </Pay>
  <Say>Thank you for your payment. Your booking has been confirmed.</Say>
</Response>`;

    return twiml;
  }

  /**
   * Process payment status callback from Twilio
   * @param {Object} callbackData - Twilio callback data
   * @returns {Promise<Object>} Payment result
   */
  async processPaymentCallback(callbackData) {
    try {
      const {
        CallSid,
        PaymentStatus,
        PaymentAmount,
        PaymentCurrency,
        PaymentErrorCode,
        PaymentErrorMsg,
        PaymentCardType,
        PaymentCardLast4
      } = callbackData;

      const paymentResult = {
        callSid: CallSid,
        status: PaymentStatus, // 'completed', 'failed', 'canceled'
        amount: PaymentAmount,
        currency: PaymentCurrency,
        cardType: PaymentCardType,
        cardLast4: PaymentCardLast4,
        errorCode: PaymentErrorCode,
        errorMessage: PaymentErrorMsg,
        timestamp: new Date().toISOString()
      };

      // Log payment result
      console.log('💳 [TWILIO PAY] Payment callback received:', {
        callSid: CallSid,
        status: PaymentStatus,
        amount: PaymentAmount,
        currency: PaymentCurrency
      });

      return paymentResult;
    } catch (error) {
      console.error('❌ Error processing payment callback:', error);
      throw error;
    }
  }

  /**
   * Generate payment status TwiML response
   * @param {Object} paymentResult - Payment result
   * @returns {string} TwiML XML string
   */
  generateStatusTwiML(paymentResult) {
    const { status, errorMessage } = paymentResult;

    if (status === 'completed') {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Payment successful. Your booking has been confirmed. Thank you!</Say>
  <Hangup />
</Response>`;
    } else if (status === 'failed') {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Payment failed. ${errorMessage || 'Please try again or contact support.'}</Say>
  <Hangup />
</Response>`;
    } else {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Payment was canceled. Please call back if you would like to complete your booking.</Say>
  <Hangup />
</Response>`;
    }
  }

  /**
   * Verify payment status with Twilio
   * @param {string} callSid - Twilio Call SID
   * @returns {Promise<Object>} Payment status
   */
  async verifyPaymentStatus(callSid) {
    try {
      if (!this.twilioClient) {
        throw new Error('Twilio client not initialized');
      }

      // Fetch call details to check payment status
      const call = await this.twilioClient.calls(callSid).fetch();
      
      // Payment status is typically stored in call metadata or via webhook
      // For now, return call status
      return {
        callSid,
        callStatus: call.status,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error verifying payment status:', error);
      throw error;
    }
  }

  /**
   * Create payment request link (alternative to Twilio Pay)
   * This would integrate with a payment gateway to generate a payment link
   * @param {Object} options - Payment options
   * @returns {Promise<Object>} Payment link result
   */
  async createPaymentLink(options = {}) {
    const {
      amount,
      currency = 'GBP',
      description = 'Course booking payment',
      customerEmail,
      customerPhone,
      bookingId,
      returnUrl,
      cancelUrl
    } = options;

    if (!amount) {
      throw new Error('Payment amount is required');
    }

    // TODO: Integrate with payment gateway (Stripe, PayPal, etc.)
    // For now, return a placeholder
    const paymentLink = `${process.env.BASE_URL || 'https://example.com'}/pay/${bookingId || Date.now()}`;

    console.log('🔗 [PAYMENT LINK] Generated payment link:', paymentLink);

    return {
      success: true,
      paymentLink,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      amount,
      currency,
      description
    };
  }
}

export default new TwilioPayService();

