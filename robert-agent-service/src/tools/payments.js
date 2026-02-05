/**
 * Payments Tool
 * Delegates to booking payment tools or provides guidance for payment processing
 * 
 * Per project requirements:
 * - v1: Card payments in-agent are out-of-scope
 * - v1.1: Will use Twilio <Pay> (PCI Mode) when enabled
 * - Never collect card details directly
 * 
 * This tool is kept for backward compatibility. For booking payments,
 * use booking_step_process_payment or booking_step_send_payment_request.
 */

class PaymentsTool {
  async execute(parameters, callContext = {}) {
    const { action, amount, currency, customerId, bookingId } = parameters;
    
    // Process payment action - delegate to booking payment flow
    if (action === 'process_payment') {
      // Check if this is within a booking context
      if (!bookingId && !callContext.callSid) {
        return {
          success: false,
          error: 'Payment processing requires booking context',
          message: 'Direct payment processing is not available. Payment processing is integrated into the booking workflow. Please use booking_step_process_payment during an active booking session, or booking_step_send_payment_request to send a payment link.',
          requiresBookingContext: true,
          availableAlternatives: [
            'booking_step_process_payment - Process payment via Twilio Pay during booking',
            'booking_step_send_payment_request - Send payment request link via email/SMS'
          ]
        };
      }
      
      // If called during booking, provide guidance
      return {
        success: false,
        error: 'Use booking payment tools',
        message: 'For booking payments, use booking_step_process_payment (Twilio Pay) or booking_step_send_payment_request (payment link). Direct payment processing via this tool is not supported in v1.',
        redirectToBookingFlow: true,
        recommendedTool: 'booking_step_process_payment'
      };
    }
    
    // Refund action - must go through CRM browser agent
    if (action === 'refund') {
      return {
        success: false,
        error: 'Refund processing requires CRM access',
        message: 'Refunds must be processed through the CRM system with proper authorization and verification. Please follow the appropriate refund process (if permitted by policy) after completing identity verification.',
        requiresCRM: true,
        requiresVerification: true,
        recommendedTool: null,
        recommendedTask: 'issue_refund'
      };
    }
    
    throw new Error(`Unknown payment action: ${action}. Supported actions: process_payment, refund`);
  }
}

export default new PaymentsTool();

