import { z } from 'zod';

/**
 * Tool Schema Validator
 * Validates tool parameters using Zod schemas
 */

// Web Search Schema
const webSearchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  domains: z.array(z.string()).optional(),
  maxResults: z.number().int().positive().max(20).optional().default(5)
});

// Calendar Schema
const calendarSchema = z.object({
  action: z.enum(['check_availability', 'book_slot']),
  date: z.string().optional(),
  time: z.string().optional(),
  duration: z.number().int().positive().optional()
});

// Email Schema
const emailSchema = z.object({
  to: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().optional(),
  template: z.string().optional()
});

// CRM Schema
const crmSchema = z.object({
  action: z.enum(['get_customer', 'update_customer', 'create_booking']),
  customerId: z.string().optional(),
  data: z.record(z.any()).optional()
});

// CRM Browser Schema - Complex nested schema
const agreedSlotSchema = z.object({
  date: z.string(),
  time: z.string(),
  location: z.string(),
  instructor: z.string().optional(),
  price: z.string().optional()
}).optional();

const crmBrowserArgsSchema = z.object({
  courseType: z.enum([
    'ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training',
    'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion',
    'TfL 1-2-1', 'TfL 1-2-1 Motorcycle Skills', 'TfL Beyond CBT',
    'TfL - Beyond CBT - Skills for Delivery Riders', 'Full Licence Assessment',
    'Full Motorcycle Licence Assessment'
  ]).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  customerMobile: z.string().optional(),
  preferredDate: z.string().optional(),
  preferredTime: z.string().optional(),
  location: z.string().optional(),
  bikeType: z.string().optional(),
  cbtType: z.enum(['standard', 'renewal']).optional(),
  duration: z.enum(['2', '3', '4']).optional(),
  bookingReference: z.string().optional(),
  newDate: z.string().optional(),
  newTime: z.string().optional(),
  newLocation: z.string().optional(),
  reason: z.string().optional(),
  email: z.string().email().optional(),
  mobile: z.string().optional(),
  postcode: z.string().optional(),
  firstName: z.string().optional(),
  surname: z.string().optional(),
  address: z.string().optional(),
  workflowType: z.enum(['existing', 'new']).optional(),
  agreedSlot: agreedSlotSchema,
  selectedSlot: agreedSlotSchema,
  termsAccepted: z.boolean().optional(),
  instructor: z.string().optional()
});

const crmBrowserSchema = z.object({
  task: z.enum(['create_booking', 'reschedule_booking', 'cancel_booking', 'update_customer', 'check_availability']),
  args: crmBrowserArgsSchema
});

// Payments Schema
const paymentsSchema = z.object({
  action: z.enum(['process_payment', 'refund']),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3).optional().default('GBP'),
  customerId: z.string().optional()
});

// File Search Schema
const fileSearchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  files: z.array(z.string()).optional()
});

// Transfer Call Schema
const transferCallSchema = z.object({
  target: z.string().min(1, 'Target is required'),
  reason: z.string().optional()
});

// KBA Verification Schema
const kbaVerificationSchema = z.object({
  email: z.string().email('Invalid email address'),
  postcode: z.string().min(1, 'Postcode is required'),
  bookingReference: z.string().optional(),
  otpCode: z.string().optional()
});

// Client Verification Schema
const clientVerificationSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  postcode: z.string().min(1, 'Postcode is required'),
  telephoneNumber: z.string().min(1, 'Telephone number is required')
});

// Complaint Submission Schema
const complaintSubmissionSchema = z.object({
  complaintType: z.enum([
    'service_quality', 'ai_understanding', 'response_time', 'technical_issue',
    'billing', 'booking', 'instructor_conduct', 'safety_concern', 'discrimination',
    'legal', 'media', 'other'
  ]).optional(),
  complaintText: z.string().min(1, 'Complaint text is required'),
  callerDetails: z.record(z.any()).optional()
});

// Common course type enum for booking steps
const courseTypeEnum = z.enum([
  'ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training',
  'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion',
  'TfL 1-2-1', 'TfL 1-2-1 Motorcycle Skills', 'TfL Beyond CBT',
  'TfL - Beyond CBT - Skills for Delivery Riders', 'Full Licence Assessment',
  'Full Motorcycle Licence Assessment'
]);

// Session details schema (used in select_session)
const sessionDetailsSchema = z.object({
  date: z.string().optional(),
  time: z.string().optional(),
  location: z.string().optional(),
  instructor: z.string().optional(),
  price: z.string().optional()
}).passthrough(); // Allow additional fields

// Booking Step Schemas
const bookingStepCheckAvailabilitySchema = z.object({
  courseType: courseTypeEnum,
  preferredDate: z.string().optional(),
  preferredTime: z.string().optional(),
  location: z.string().optional(),
  instructor: z.string().optional()
});

const bookingStepAuthenticateSchema = z.object({
  courseType: courseTypeEnum
});

const bookingStepNavigateContactsSchema = z.object({
  courseType: courseTypeEnum,
  workflowType: z.enum(['existing'])
});

const bookingStepSearchClientSchema = z.object({
  courseType: courseTypeEnum,
  workflowType: z.enum(['existing']),
  customerMobile: z.string().optional(),
  customerEmail: z.string().email().optional()
});

const bookingStepSelectSessionSchema = z.object({
  courseType: courseTypeEnum,
  workflowType: z.enum(['existing', 'new']),
  sessionDetails: sessionDetailsSchema.optional() // Optional - can be retrieved from sessionState if not provided
});

const bookingStepSelectBookingOptionsSchema = z.object({
  courseType: courseTypeEnum,
  workflowType: z.enum(['existing', 'new']),
  bikeType: z.enum(['125cc automatic', '50cc automatic', '125cc manual']).optional(),
  cbtType: z.enum(['standard', 'renewal']).optional(),
  duration: z.enum(['2', '3', '4']).optional()
});

const bookingStepCreateNewContactSchema = z.object({
  courseType: courseTypeEnum,
  workflowType: z.enum(['new'])
});

const bookingStepFillContactDetailsSchema = z.object({
  courseType: courseTypeEnum,
  workflowType: z.enum(['existing', 'new']),
  customerEmail: z.string().email().optional(),
  customerMobile: z.string().optional(),
  customerName: z.string().optional(),
  postcode: z.string().optional(),
  houseNumber: z.string().optional(),
  nationalInsurance: z.string().optional(),
  drivingLicenceNumber: z.string().optional()
});

const bookingStepProcessPaymentSchema = z.object({
  courseType: courseTypeEnum,
  workflowType: z.enum(['existing', 'new']),
  termsAccepted: z.boolean(),
  confirmed: z.boolean().optional(), // Optional confirmation flag (for future use if needed)
  paymentMethod: z.string().optional(),
  cardNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  cvv: z.string().optional(),
  cardholderName: z.string().optional()
});

const bookingStepSendConfirmationSchema = z.object({
  courseType: courseTypeEnum,
  workflowType: z.enum(['existing', 'new']),
  customerEmail: z.string().email()
});

const bookingStepSendTermsSchema = z.object({
  courseType: courseTypeEnum,
  workflowType: z.enum(['existing', 'new']),
  customerEmail: z.string().email()
});

const bookingStepSendSMSSchema = z.object({
  courseType: courseTypeEnum,
  workflowType: z.enum(['existing', 'new']),
  customerMobile: z.string()
});

const bookingStepSendPaymentRequestSchema = z.object({
  courseType: courseTypeEnum,
  workflowType: z.enum(['existing', 'new']),
  deliveryMethod: z.enum(['email', 'sms']),
  clientEmail: z.string().email().optional(),
  clientMobile: z.string().optional()
});

// Schema map for all tools
const toolSchemas = {
  web_search: webSearchSchema,
  calendar: calendarSchema,
  email: emailSchema,
  crm: crmSchema,
  crm_browser: crmBrowserSchema,
  payments: paymentsSchema,
  file_search: fileSearchSchema,
  transfer_call: transferCallSchema,
  kba_verification: kbaVerificationSchema,
  client_verification: clientVerificationSchema,
  complaint_submission: complaintSubmissionSchema,
  // Booking step tools
  booking_step_check_availability: bookingStepCheckAvailabilitySchema,
  booking_step_authenticate: bookingStepAuthenticateSchema,
  booking_step_navigate_contacts: bookingStepNavigateContactsSchema,
  booking_step_search_client: bookingStepSearchClientSchema,
  booking_step_select_session: bookingStepSelectSessionSchema,
  booking_step_select_booking_options: bookingStepSelectBookingOptionsSchema,
  booking_step_create_new_contact: bookingStepCreateNewContactSchema,
  booking_step_fill_contact_details: bookingStepFillContactDetailsSchema,
  booking_step_process_payment: bookingStepProcessPaymentSchema,
  booking_step_send_payment_request: bookingStepSendPaymentRequestSchema,
  booking_step_send_confirmation: bookingStepSendConfirmationSchema,
  booking_step_send_terms: bookingStepSendTermsSchema,
  booking_step_send_sms: bookingStepSendSMSSchema
};

/**
 * Validate tool parameters
 * @param {string} toolName - Name of the tool
 * @param {object} parameters - Parameters to validate
 * @returns {object} Validation result with success flag and data/error
 */
export function validateToolParameters(toolName, parameters) {
  const schema = toolSchemas[toolName];
  
  if (!schema) {
    return {
      success: false,
      error: `No schema defined for tool: ${toolName}`
    };
  }

  try {
    const validatedData = schema.parse(parameters);
    return {
      success: true,
      data: validatedData
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format Zod errors into user-friendly messages
      const errors = error.errors.map(err => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
      });
      
      return {
        success: false,
        error: `Validation failed: ${errors.join('; ')}`,
        details: error.errors
      };
    }
    
    return {
      success: false,
      error: `Validation error: ${error.message}`
    };
  }
}

/**
 * Check if a tool has a schema defined
 * @param {string} toolName - Name of the tool
 * @returns {boolean} True if schema exists
 */
export function hasSchema(toolName) {
  return toolName in toolSchemas;
}

export default {
  validateToolParameters,
  hasSchema,
  toolSchemas
};

