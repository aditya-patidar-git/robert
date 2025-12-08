/**
 * Fee Calculation Service
 * Calculates cancellation and reschedule fees based on T&Cs
 */

class FeeCalculationService {
  /**
   * Calculate working days between two dates (excluding weekends)
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {number} Number of working days
   */
  calculateWorkingDays(startDate, endDate) {
    let count = 0;
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    
    while (current < end) {
      const dayOfWeek = current.getDay();
      // Exclude weekends (Saturday = 6, Sunday = 0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  }
  
  /**
   * Calculate cancellation fee
   * Per T&Cs: 30% cancellation fee if cancelled more than 3 full working days before booking date
   * @param {string} bookingDate - Booking date (ISO format or date string)
   * @param {number} bookingPrice - Original booking price in GBP
   * @returns {Object} Fee calculation result
   */
  calculateCancellationFee(bookingDate, bookingPrice) {
    try {
      const booking = new Date(bookingDate);
      const now = new Date();
      
      // Calculate working days between now and booking date
      const workingDays = this.calculateWorkingDays(now, booking);
      
      console.log(`💰 [FEE CALC] Cancellation calculation:`);
      console.log(`   Booking Date: ${booking.toLocaleDateString('en-GB')}`);
      console.log(`   Current Date: ${now.toLocaleDateString('en-GB')}`);
      console.log(`   Working Days Until Booking: ${workingDays}`);
      console.log(`   Original Price: £${bookingPrice.toFixed(2)}`);
      
      // Per T&Cs: 30% fee if cancelled more than 3 full working days before
      if (workingDays > 3) {
        const cancellationFee = bookingPrice * 0.30;
        const refundAmount = bookingPrice - cancellationFee;
        
        console.log(`   Cancellation Fee (30%): £${cancellationFee.toFixed(2)}`);
        console.log(`   Refund Amount: £${refundAmount.toFixed(2)}`);
        
        return {
          fee: cancellationFee,
          feePercentage: 30,
          refundAmount: refundAmount,
          policy: '30% cancellation fee applies (cancelled more than 3 working days before booking)',
          workingDaysUntilBooking: workingDays,
          eligibleForRefund: true
        };
      } else {
        // Less than 3 working days - may have different policy
        // For now, assume full fee (no refund) if less than 3 working days
        const cancellationFee = bookingPrice;
        const refundAmount = 0;
        
        console.log(`   Cancellation Fee (100%): £${cancellationFee.toFixed(2)}`);
        console.log(`   Refund Amount: £${refundAmount.toFixed(2)}`);
        console.log(`   Policy: No refund (cancelled less than 3 working days before booking)`);
        
        return {
          fee: cancellationFee,
          feePercentage: 100,
          refundAmount: refundAmount,
          policy: 'No refund (cancelled less than 3 working days before booking)',
          workingDaysUntilBooking: workingDays,
          eligibleForRefund: false
        };
      }
    } catch (error) {
      console.error('❌ [FEE CALC] Error calculating cancellation fee:', error);
      throw new Error(`Failed to calculate cancellation fee: ${error.message}`);
    }
  }
  
  /**
   * Calculate reschedule fee
   * Note: Reschedule fees may vary by course type - check T&Cs for specific policies
   * @param {string} bookingDate - Original booking date
   * @param {string} newBookingDate - New booking date
   * @param {number} bookingPrice - Original booking price in GBP
   * @param {string} courseType - Course type (optional, for course-specific policies)
   * @returns {Object} Fee calculation result
   */
  calculateRescheduleFee(bookingDate, newBookingDate, bookingPrice, courseType = null) {
    try {
      const originalDate = new Date(bookingDate);
      const newDate = new Date(newBookingDate);
      const now = new Date();
      
      // Calculate working days between now and original booking
      const workingDaysUntilOriginal = this.calculateWorkingDays(now, originalDate);
      
      console.log(`💰 [FEE CALC] Reschedule calculation:`);
      console.log(`   Original Booking Date: ${originalDate.toLocaleDateString('en-GB')}`);
      console.log(`   New Booking Date: ${newDate.toLocaleDateString('en-GB')}`);
      console.log(`   Working Days Until Original Booking: ${workingDaysUntilOriginal}`);
      console.log(`   Original Price: £${bookingPrice.toFixed(2)}`);
      
      // Default policy: No reschedule fee if rescheduled more than 3 working days before original booking
      // Some courses may have different policies - this is a default implementation
      if (workingDaysUntilOriginal > 3) {
        console.log(`   Reschedule Fee: £0.00 (rescheduled more than 3 working days before)`);
        
        return {
          fee: 0,
          feePercentage: 0,
          policy: 'No reschedule fee (rescheduled more than 3 working days before original booking)',
          workingDaysUntilOriginalBooking: workingDaysUntilOriginal,
          note: 'Reschedule fees may vary by course type. Please check specific T&Cs.'
        };
      } else {
        // Less than 3 working days - may incur a fee
        // Default: 10% reschedule fee (this may need to be adjusted based on actual T&Cs)
        const rescheduleFee = bookingPrice * 0.10;
        
        console.log(`   Reschedule Fee (10%): £${rescheduleFee.toFixed(2)}`);
        console.log(`   Policy: 10% reschedule fee (rescheduled less than 3 working days before)`);
        
        return {
          fee: rescheduleFee,
          feePercentage: 10,
          policy: '10% reschedule fee (rescheduled less than 3 working days before original booking)',
          workingDaysUntilOriginalBooking: workingDaysUntilOriginal,
          note: 'Reschedule fees may vary by course type. Please check specific T&Cs.'
        };
      }
    } catch (error) {
      console.error('❌ [FEE CALC] Error calculating reschedule fee:', error);
      throw new Error(`Failed to calculate reschedule fee: ${error.message}`);
    }
  }
  
  /**
   * Extract price from booking details
   * @param {string|number} price - Price string (e.g., "£125.00") or number
   * @returns {number} Price as number
   */
  extractPrice(price) {
    if (typeof price === 'number') {
      return price;
    }
    
    if (typeof price === 'string') {
      // Remove currency symbols and extract number
      const match = price.match(/[\d,]+\.?\d*/);
      if (match) {
        return parseFloat(match[0].replace(/,/g, ''));
      }
    }
    
    return 0;
  }
}

export default new FeeCalculationService();

