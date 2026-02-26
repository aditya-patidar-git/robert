import twilioPayService from '../services/twilioPayService.js';
import PaymentRecord from '../models/PaymentRecord.js';

/**
 * Handle Twilio Pay status callback
 * POST /api/payments/twilio-pay/status
 */
export const handleTwilioPayStatus = async (req, res) => {
  try {
    const paymentResult = await twilioPayService.processPaymentCallback(req.body);
    
    // Save payment record
    const paymentRecord = new PaymentRecord({
      callSid: paymentResult.callSid,
      paymentMethod: 'twilio_pay',
      status: paymentResult.status,
      amount: parseFloat(paymentResult.amount),
      currency: paymentResult.currency,
      cardType: paymentResult.cardType,
      cardLast4: paymentResult.cardLast4,
      errorCode: paymentResult.errorCode,
      errorMessage: paymentResult.errorMessage,
      metadata: {
        rawCallback: req.body
      }
    });

    await paymentRecord.save();

    // Generate TwiML response
    const twiml = twilioPayService.generateStatusTwiML(paymentResult);
    
    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('Error handling Twilio Pay status:', error);
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">An error occurred processing your payment. Please contact support.</Say>
  <Hangup />
</Response>`);
  }
};

/**
 * Handle Twilio Pay callback (webhook)
 * POST /api/payments/twilio-pay/callback
 */
export const handleTwilioPayCallback = async (req, res) => {
  try {
    const paymentResult = await twilioPayService.processPaymentCallback(req.body);
    
    // Update payment record if exists
    const paymentRecord = await PaymentRecord.findOne({ callSid: paymentResult.callSid });
    if (paymentRecord) {
      paymentRecord.status = paymentResult.status;
      paymentRecord.cardType = paymentResult.cardType;
      paymentRecord.cardLast4 = paymentResult.cardLast4;
      paymentRecord.errorCode = paymentResult.errorCode;
      paymentRecord.errorMessage = paymentResult.errorMessage;
      paymentRecord.updatedAt = new Date();
      await paymentRecord.save();
    }

    // TODO: Trigger booking confirmation if payment successful
    if (paymentResult.status === 'completed') {
      // Emit event or trigger booking completion
      console.log('✅ [PAYMENT] Payment completed, triggering booking confirmation');
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error handling Twilio Pay callback:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Create payment link
 * POST /api/payments/link
 */
export const createPaymentLink = async (req, res) => {
  try {
    const { amount, currency, description, customerEmail, customerPhone, bookingId } = req.body;
    const baseUrl = (process.env.FRONTEND_URL || process.env.BASE_URL || 'https://example.com').replace(/\/$/, '');
    const paymentLink = await twilioPayService.createPaymentLink({
      amount,
      currency,
      description,
      customerEmail,
      customerPhone,
      bookingId,
      returnUrl: `${baseUrl}/payment/success`,
      cancelUrl: `${baseUrl}/payment/cancel`
    });

    res.json({
      success: true,
      ...paymentLink
    });
  } catch (error) {
    console.error('Error creating payment link:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get payment status
 * GET /api/payments/status/:paymentId
 */
export const getPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    // Try to find by payment ID or call SID
    const paymentRecord = await PaymentRecord.findOne({
      $or: [
        { _id: paymentId },
        { callSid: paymentId },
        { bookingId: paymentId }
      ]
    });

    if (!paymentRecord) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    res.json({
      success: true,
      payment: paymentRecord
    });
  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

