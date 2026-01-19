// Export all task handlers
// DEPRECATED: createBooking removed - use booking_step_* tools instead
export { rescheduleBooking, dryRunRescheduleBooking } from './rescheduleBooking.js';
export { cancelBooking, dryRunCancelBooking } from './cancelBooking.js';
export { updateCustomer, dryRunUpdateCustomer } from './updateCustomer.js';
export { checkAvailability, dryRunCheckAvailability } from './checkAvailability.js';

