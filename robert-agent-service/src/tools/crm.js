/**
 * CRM Tool
 * Delegates to crm_browser tool for all CRM operations
 * 
 * Per project requirements, all CRM operations must use browser automation
 * (Playwright) with dry-run → diff → confirmation → commit flow.
 * 
 * This tool is kept for backward compatibility. For new implementations,
 * use crm_browser tool directly.
 */

import crmBrowserTool from './crmBrowserTool.js';

class CRMTool {
  async execute(parameters, callContext = {}) {
    const { action, customerId, data } = parameters;
    
    // Map legacy CRM actions to crm_browser tasks
    const taskMap = {
      'get_customer': 'search_client', // Search for customer in CRM
      'update_customer': 'update_customer', // Update customer record
      'create_booking': 'create_booking' // Create new booking
    };
    
    const task = taskMap[action];
    
    if (!task) {
      throw new Error(
        `Unknown CRM action: ${action}. ` +
        `Supported actions: ${Object.keys(taskMap).join(', ')}. ` +
        `For better control and features, use crm_browser tool directly.`
      );
    }
    
    // Prepare arguments for crm_browser based on action
    let args = {};
    
    if (action === 'get_customer') {
      // For get_customer, we need search parameters
      if (customerId) {
        args = {
          searchType: 'id',
          searchValue: customerId
        };
      } else if (data) {
        // Use provided data as search criteria
        args = {
          searchType: data.searchType || 'mobile', // Default to mobile search
          searchValue: data.searchValue || data.mobile || data.email || data.phone
        };
      } else {
        return {
          success: false,
          error: 'Missing search parameters',
          message: 'To search for a customer, provide either customerId or data with searchType and searchValue (e.g., mobile, email). For better results, use crm_browser tool with task "search_client" directly.',
          requiresSearchParams: true
        };
      }
    } else if (action === 'update_customer') {
      // For update_customer, pass the data to update
      if (!customerId && !data?.customerId) {
        return {
          success: false,
          error: 'Missing customer identifier',
          message: 'To update a customer, provide customerId or data.customerId. For better results, use crm_browser tool with task "update_customer" directly.',
          requiresCustomerId: true
        };
      }
      args = {
        customerId: customerId || data?.customerId,
        updateData: data
      };
    } else if (action === 'create_booking') {
      // For create_booking, pass booking data
      if (!data) {
        return {
          success: false,
          error: 'Missing booking data',
          message: 'To create a booking, provide data with booking details. For better results, use the booking_step_* tools or crm_browser tool with task "create_booking" directly.',
          requiresBookingData: true
        };
      }
      args = data;
    }
    
    try {
      // Delegate to crm_browser tool
      const result = await crmBrowserTool.execute(
        {
          task: task,
          args: args
        },
        callContext
      );
      
      // Transform result to match legacy CRM tool format for backward compatibility
      if (action === 'get_customer') {
        return {
          customer: result.clientDetails || result.result?.customer || null,
          success: result.success,
          _delegatedResult: result
        };
      }
      
      // For update and create, return standard format
      return {
        success: result.success,
        result: result.result,
        customer: result.clientDetails || null,
        bookingId: result.result?.bookingId || result.result?.booking?.id || null,
        _delegatedResult: result
      };
    } catch (error) {
      // Re-throw with context
      throw new Error(
        `CRM operation failed: ${error.message}. ` +
        `Original action: ${action}. ` +
        `Consider using crm_browser tool directly for better error handling and features.`
      );
    }
  }
}

export default new CRMTool();

