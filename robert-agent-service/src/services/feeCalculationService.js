/**
 * Fee Calculation Service
 * Calculates cancellation fees based on T&Cs
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

