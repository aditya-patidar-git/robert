/**
 * Utility functions for formatting errors into user-friendly messages
 */

/**
 * Formats technical errors into user-friendly messages for the AI agent
 * @param {Error} error - The error object
 * @param {string} context - Context about where the error occurred (e.g., "booking", "availability check")
 * @returns {string} User-friendly error message
 */
export function formatUserFriendlyError(error, context = 'operation') {
  const errorMessage = error.message || String(error);
  
  // Map common technical errors to user-friendly messages
  const errorMappings = {
    // Booking-related errors
    'No diary entries found with booking allowed': 
      'Unfortunately, I couldn\'t find any available sessions for the selected date. This might be due to a temporary issue with the booking system. Please try again later or contact support.',
    
    'Could not find matching diary entry': 
      'I couldn\'t find a matching session in the system. The session may have been booked by someone else, or there might be a temporary issue. Please try selecting a different date or time.',
    
    'Failed to select session': 
      'I encountered an issue while trying to select the session. This could be due to a temporary problem with the booking system. Please try again in a moment.',
    
    'Could not find "New Booking" option': 
      'I had trouble accessing the booking form. This might be a temporary issue with the system. Please try again or contact support for assistance.',
    
    'Could not find any visible Diaries tab': 
      'I couldn\'t access the booking calendar. This might be due to a temporary system issue. Please try again later.',
    
    'Login failed': 
      'I encountered an authentication issue. This might be a temporary problem with the system. Please try again in a moment.',
    
    'Could not find client': 
      'I couldn\'t locate your account in the system. Please verify your email address or contact support for assistance.',
    
    'Tool execution timeout': 
      'The operation took longer than expected. This might be due to high system load. Please try again.',
    
    'Network': 
      'I encountered a network issue while processing your request. Please check your connection and try again.',
    
    'timeout': 
      'The operation timed out. This might be due to high system load or a temporary issue. Please try again.',
  };
  
  // Check for specific error patterns
  for (const [pattern, friendlyMessage] of Object.entries(errorMappings)) {
    if (errorMessage.includes(pattern)) {
      return friendlyMessage;
    }
  }
  
  // Generic fallback messages based on context
  const contextMessages = {
    'booking': 'I encountered an issue while processing your booking. This might be due to a temporary problem with the booking system. Please try again in a moment, or contact support if the issue persists.',
    'availability check': 'I had trouble checking availability. This might be due to a temporary issue with the system. Please try again in a moment.',
    'operation': 'I encountered an unexpected issue while processing your request. Please try again, or contact support if the problem continues.',
  };
  
  // Return context-specific message or generic fallback
  const contextMessage = contextMessages[context] || contextMessages['operation'];
  
  // If it's a known technical error, provide a more specific message
  if (errorMessage.includes('Error:') || errorMessage.includes('Failed')) {
    return `${contextMessage} (Technical details: ${errorMessage.substring(0, 100)})`;
  }
  
  return contextMessage;
}

/**
 * Determines the context from error message or operation type
 * @param {Error} error - The error object
 * @param {string} operationType - Type of operation (e.g., 'create_booking', 'check_availability')
 * @returns {string} Context string
 */
export function getErrorContext(error, operationType) {
  const errorMessage = error.message || String(error);
  
  if (operationType === 'create_booking') {
    return 'booking';
  } else if (operationType === 'check_availability') {
    return 'availability check';
  }
  
  // Infer from error message
  if (errorMessage.includes('booking') || errorMessage.includes('session') || errorMessage.includes('diary')) {
    return 'booking';
  } else if (errorMessage.includes('availability') || errorMessage.includes('check')) {
    return 'availability check';
  }
  
  return 'operation';
}

