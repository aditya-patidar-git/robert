import browserAgentService from '../services/browser/index.js';
import { formatUserFriendlyError, getErrorContext } from '../utils/errorFormatter.js';

class RescheduleBookingTool {
  async execute(parameters, callContext = {}, progressCallback = null) {
    const callSid = callContext.callSid || 'unknown';
    const {
      bookingReference,
      newDate,
      newTime,
      newLocation,
      customerEmail,
      customerMobile
    } = parameters;

    if (!bookingReference || !newDate) {
      return {
        success: false,
        error: 'bookingReference and newDate are required.'
      };
    }

    if (!customerEmail && !customerMobile) {
      return {
        success: false,
        error: 'Customer email or mobile number is required to locate the booking.'
      };
    }

    const args = {
      bookingReference,
      newDate,
      newTime: newTime || undefined,
      newLocation: newLocation || undefined,
      customerEmail: customerEmail || undefined,
      customerMobile: customerMobile || undefined
    };

    try {
      const result = await browserAgentService.executeTask(
        'reschedule_booking',
        args,
        { ...callContext, callSid },
        progressCallback || callContext.progressCallback
      );

      if (!result.success) {
        const errorContext = getErrorContext(new Error(result.error || 'Reschedule failed'), 'reschedule_booking');
        return {
          success: false,
          error: formatUserFriendlyError(new Error(result.error), errorContext),
          technicalError: result.error
        };
      }

      return {
        success: true,
        result: result.result,
        message: result.message,
        requiresConfirmation: result.requiresConfirmation,
        confirmationMessage: result.confirmationMessage
      };
    } catch (error) {
      console.error(`❌ [${callSid}] reschedule_booking tool error:`, error);
      const errorContext = getErrorContext(error, 'reschedule_booking');
      return {
        success: false,
        error: formatUserFriendlyError(error, errorContext),
        technicalError: error.message
      };
    }
  }
}

export default new RescheduleBookingTool();
