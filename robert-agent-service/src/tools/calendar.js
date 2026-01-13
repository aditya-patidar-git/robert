/**
 * Calendar Tool
 * Delegates to booking_step_check_availability for real-time availability checking
 * 
 * This tool is kept for backward compatibility. For new implementations,
 * use booking_step_check_availability directly.
 */

import { checkAvailabilityTool } from './bookingSteps/index.js';

class CalendarTool {
  async execute(parameters, callContext = {}) {
    const { action, date, time, duration, courseType } = parameters;
    
    // Delegate availability checking to booking_step_check_availability
    if (action === 'check_availability') {
      // Map calendar parameters to booking step parameters
      const bookingParams = {
        courseType: courseType || 'CBT', // Default to CBT if not specified
        preferredDate: date,
        preferredTime: time,
        duration: duration
      };
      
      try {
        // Delegate to the real availability check tool
        const result = await checkAvailabilityTool.execute(bookingParams, callContext);
        
        // Transform result to match calendar tool format for backward compatibility
        return {
          availableSlots: result.availableSlots || [],
          date: date,
          time: time,
          courseType: bookingParams.courseType,
          // Include full result for advanced use cases
          _delegatedResult: result
        };
      } catch (error) {
        // If courseType is missing, provide helpful error
        if (!courseType) {
          return {
            success: false,
            error: 'Course type is required for availability checking',
            message: 'Please specify a courseType parameter (e.g., "CBT", "ITM", "Private Lesson"). For better results, use booking_step_check_availability directly.',
            availableSlots: []
          };
        }
        throw error;
      }
    }
    
    // Book slot action is not supported - bookings must go through booking workflow
    if (action === 'book_slot') {
      return {
        success: false,
        error: 'Direct slot booking not supported',
        message: 'Slot booking must be done through the complete booking workflow. Please use the booking_step_* tools or crm_browser tool for creating bookings.',
        requiresBookingWorkflow: true
      };
    }
    
    throw new Error(`Unknown calendar action: ${action}. Supported actions: check_availability`);
  }
}

export default new CalendarTool();

