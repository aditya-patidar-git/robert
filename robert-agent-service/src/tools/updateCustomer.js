import browserAgentService from '../services/browser/index.js';
import { formatUserFriendlyError, getErrorContext } from '../utils/errorFormatter.js';

class UpdateCustomerTool {
  async execute(parameters, callContext = {}, progressCallback = null) {
    const callSid = callContext.callSid || 'unknown';
    const {
      customerEmail,
      customerMobile,
      telephoneNumber,
      email,
      postcode,
      firstName,
      surname,
      address
    } = parameters;

    if (!customerEmail && !customerMobile) {
      return {
        success: false,
        error: 'Customer email or mobile number is required to locate the customer.'
      };
    }

    const hasUpdate = telephoneNumber || email || postcode || firstName || surname || address;
    if (!hasUpdate) {
      return {
        success: false,
        error: 'At least one field to update is required (telephoneNumber, email, postcode, firstName, surname, or address).'
      };
    }

    const args = {
      customerEmail: customerEmail || undefined,
      customerMobile: customerMobile || undefined,
      customerPhone: telephoneNumber || undefined,
      email: email || undefined,
      phone: telephoneNumber || undefined,
      mobile: customerMobile || telephoneNumber || undefined,
      postcode: postcode || undefined,
      firstName: firstName || undefined,
      surname: surname || undefined,
      address: address || undefined
    };

    try {
      const result = await browserAgentService.executeTask(
        'update_customer',
        args,
        { ...callContext, callSid },
        progressCallback || callContext.progressCallback
      );

      if (!result.success) {
        const errorContext = getErrorContext(new Error(result.error || 'Update failed'), 'update_customer');
        return {
          success: false,
          error: formatUserFriendlyError(new Error(result.error), errorContext),
          technicalError: result.error
        };
      }

      return {
        success: true,
        result: result.result,
        message: result.message
      };
    } catch (error) {
      console.error(`❌ [${callSid}] update_customer tool error:`, error);
      const errorContext = getErrorContext(error, 'update_customer');
      return {
        success: false,
        error: formatUserFriendlyError(error, errorContext),
        technicalError: error.message
      };
    }
  }
}

export default new UpdateCustomerTool();
