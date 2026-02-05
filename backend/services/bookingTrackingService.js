import Booking from '../models/Booking.js';

/**
 * Booking Tracking Service
 * Handles creation and management of booking records from CRM automation
 * Provides a centralized service for tracking bookings made via Playwright workflows
 */
class BookingTrackingService {
  /**
   * Create a new booking record from CRM automation
   * @param {Object} bookingData - The booking data
   * @returns {Promise<Object>} Created booking record
   */
  async createBookingRecord(bookingData) {
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
        notes,
        source = 'crm_automation'
      } = bookingData;

      // Validate required fields
      if (!callerName) {
        throw new Error('callerName is required');
      }
      if (!serviceType) {
        throw new Error('serviceType is required');
      }
      if (!dateTime) {
        throw new Error('dateTime is required');
      }

      // Create the booking record
      const booking = new Booking({
        caller_name: callerName,
        caller_email: callerEmail,
        caller_phone: callerPhone,
        service_type: serviceType,
        date_time: new Date(dateTime),
        status: 'confirmed',
        source,
        callSid,
        crmBookingId,
        centre,
        bikeType,
        sessionDetails,
        paymentCompleted: paymentCompleted || false,
        paymentMethod,
        workflowType: workflowType || 'new',
        notes
      });

      await booking.save();

      console.log(`✅ [BookingTracking] Booking record created: ${booking._id} for ${serviceType}`);

      return {
        success: true,
        bookingId: booking._id,
        booking: booking.toObject()
      };
    } catch (error) {
      console.error('❌ [BookingTracking] Error creating booking record:', error);
      throw error;
    }
  }

  /**
   * Get booking by callSid
   * @param {string} callSid - The call SID
   * @returns {Promise<Object|null>} Booking record or null
   */
  async getBookingByCallSid(callSid) {
    try {
      return await Booking.findOne({ callSid });
    } catch (error) {
      console.error('❌ [BookingTracking] Error finding booking by callSid:', error);
      throw error;
    }
  }

  /**
   * Get bookings by service type
   * @param {string} serviceType - The service type
   * @param {Object} options - Query options (limit, skip)
   * @returns {Promise<Array>} Array of bookings
   */
  async getBookingsByServiceType(serviceType, options = {}) {
    try {
      const { limit = 50, skip = 0 } = options;
      return await Booking.find({ service_type: serviceType })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    } catch (error) {
      console.error('❌ [BookingTracking] Error finding bookings by service type:', error);
      throw error;
    }
  }

  /**
   * Get booking statistics
   * @returns {Promise<Object>} Booking statistics
   */
  async getBookingStats() {
    try {
      const [total, bySource, byServiceType, recentBookings] = await Promise.all([
        Booking.countDocuments(),
        Booking.aggregate([
          { $group: { _id: '$source', count: { $sum: 1 } } }
        ]),
        Booking.aggregate([
          { $group: { _id: '$service_type', count: { $sum: 1 } } }
        ]),
        Booking.find()
          .sort({ createdAt: -1 })
          .limit(5)
          .select('caller_name service_type centre createdAt status')
      ]);

      return {
        total,
        bySource: bySource.reduce((acc, item) => {
          acc[item._id || 'unknown'] = item.count;
          return acc;
        }, {}),
        byServiceType: byServiceType.reduce((acc, item) => {
          acc[item._id || 'unknown'] = item.count;
          return acc;
        }, {}),
        recentBookings
      };
    } catch (error) {
      console.error('❌ [BookingTracking] Error getting booking stats:', error);
      throw error;
    }
  }

  /**
   * Update booking status
   * @param {string} bookingId - The booking ID
   * @param {string} status - The new status
   * @returns {Promise<Object>} Updated booking
   */
  async updateBookingStatus(bookingId, status) {
    try {
      const booking = await Booking.findByIdAndUpdate(
        bookingId,
        { status },
        { new: true }
      );

      if (!booking) {
        throw new Error('Booking not found');
      }

      console.log(`✅ [BookingTracking] Booking ${bookingId} status updated to: ${status}`);
      return booking;
    } catch (error) {
      console.error('❌ [BookingTracking] Error updating booking status:', error);
      throw error;
    }
  }
}

// Export singleton instance
const bookingTrackingService = new BookingTrackingService();
export default bookingTrackingService;
