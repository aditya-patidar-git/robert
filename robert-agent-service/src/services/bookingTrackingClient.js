/**
 * Booking Tracking Client
 * Calls the backend API to track CRM bookings made via Playwright workflows
 * This allows the dashboard to display accurate booking counts
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3002';

/**
 * Track a successful CRM booking by calling the backend API
 * @param {Object} bookingData - The booking data to track
 * @returns {Promise<Object>} The API response
 */
export async function trackCRMBooking(bookingData) {
  try {
    const {
      callerName,
      callerEmail,
      callerPhone,
      serviceType,
      dateTime,
      callSid,
      crmBookingId,
      centre,
      bikeType,
      sessionDetails,
      paymentCompleted,
      paymentMethod,
      workflowType,
      notes
    } = bookingData;

    console.log(`📝 [BookingTracking] Tracking CRM booking for ${serviceType}...`);

    const response = await fetch(`${BACKEND_URL}/api/booking/track-crm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        callerName,
        callerEmail,
        callerPhone,
        serviceType,
        dateTime,
        callSid,
        crmBookingId,
        centre,
        bikeType,
        sessionDetails,
        paymentCompleted,
        paymentMethod,
        workflowType,
        notes
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`HTTP ${response.status}: ${errorData.message || 'Failed to track booking'}`);
    }

    const result = await response.json();
    console.log(`✅ [BookingTracking] Booking tracked successfully: ${result.bookingId}`);
    return result;

  } catch (error) {
    // Log the error but don't throw - booking tracking failure shouldn't break the main workflow
    console.error(`❌ [BookingTracking] Failed to track booking:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract centre name from session details or booking args
 * @param {Object} sessionDetails - The session details
 * @param {Object} bookingArgs - The booking arguments
 * @returns {string} The centre name
 */
export function extractCentreName(sessionDetails, bookingArgs) {
  // Try to extract from session details
  if (sessionDetails?.centre) {
    return sessionDetails.centre;
  }
  
  // Try to extract from location in session details
  if (sessionDetails?.location) {
    const location = sessionDetails.location.toLowerCase();
    if (location.includes('alperton')) return 'Alperton';
    if (location.includes('croydon')) return 'Croydon';
    if (location.includes('edgware')) return 'Edgware';
    if (location.includes('eltham')) return 'Eltham';
    if (location.includes('wimbledon')) return 'Wimbledon';
    if (location.includes('dagenham')) return 'Dagenham';
    if (location.includes('hoddesdon')) return 'Hoddesdon';
  }
  
  // Try from booking args
  if (bookingArgs?.centre) {
    return bookingArgs.centre;
  }
  
  if (bookingArgs?.preferredLocation) {
    return bookingArgs.preferredLocation;
  }
  
  return 'Unknown';
}

/**
 * Build booking data object from workflow context
 * @param {Object} params - Parameters from the workflow
 * @returns {Object} Formatted booking data for tracking
 */
export function buildBookingData(params) {
  const {
    bookingArgs = {},
    callContext = {},
    sessionDetails = {},
    paymentCompleted = false,
    workflowType = 'new',
    serviceType = 'ITM'
  } = params;

  // Extract caller details from various sources
  const callerName = bookingArgs.customerFullName || 
                     bookingArgs.fullName || 
                     callContext.clientDetails?.fullName ||
                     callContext.callerName ||
                     'Unknown';
                     
  const callerEmail = bookingArgs.customerEmail || 
                      bookingArgs.email ||
                      callContext.clientDetails?.email ||
                      callContext.callerEmail;
                      
  const callerPhone = bookingArgs.customerMobile || 
                      bookingArgs.mobile ||
                      bookingArgs.telephoneNumber ||
                      callContext.clientDetails?.mobile ||
                      callContext.callerPhone;

  // Extract date/time from session details
  let dateTime = sessionDetails.date;
  if (sessionDetails.startTime) {
    // Combine date and time if available
    dateTime = `${sessionDetails.date} ${sessionDetails.startTime}`;
  }

  return {
    callerName,
    callerEmail,
    callerPhone,
    serviceType,
    dateTime: dateTime || new Date().toISOString(),
    callSid: callContext.callSid,
    centre: extractCentreName(sessionDetails, bookingArgs),
    bikeType: bookingArgs.bikeType,
    sessionDetails: {
      startTime: sessionDetails.startTime,
      endTime: sessionDetails.endTime,
      instructor: sessionDetails.instructor,
      price: sessionDetails.price
    },
    paymentCompleted,
    paymentMethod: bookingArgs.paymentMethod,
    workflowType,
    notes: `Booked via CRM automation - ${serviceType} workflow`
  };
}

export default {
  trackCRMBooking,
  extractCentreName,
  buildBookingData
};
