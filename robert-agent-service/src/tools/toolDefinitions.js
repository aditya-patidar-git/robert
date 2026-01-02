/**
 * Tool Definitions for OpenAI Realtime API
 * Contains all tool schema definitions with descriptions
 */

/**
 * Get tool definitions for OpenAI Realtime API session.update
 * @returns {Array} Array of tool definition objects
 */
/**
 * Get step-based booking tool definitions
 * These tools execute individual steps of the booking workflow
 */
function getStepBookingToolDefinitions() {
  return [
    {
      type: 'function',
      name: 'booking_step_check_availability',
      description: `Step 1: Check availability for a course type. Returns all available slots with date, time, location, and instructor information. Use this FIRST before starting any booking flow.`,
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type (e.g., "ITM", "Introduction to Motorcycling", "CBT", "Compulsory Basic Training", etc.)',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion', 'TfL 1-2-1', 'TfL 1-2-1 Motorcycle Skills', 'TfL Beyond CBT', 'TfL - Beyond CBT - Skills for Delivery Riders', 'Full Licence Assessment', 'Full Motorcycle Licence Assessment']
          },
          preferredDate: {
            type: 'string',
            description: 'Preferred date (optional, for slot matching)'
          },
          preferredTime: {
            type: 'string',
            description: 'Preferred time (optional, for slot matching)'
          },
          location: {
            type: 'string',
            description: 'Preferred location (optional, for slot matching)'
          },
          instructor: {
            type: 'string',
            description: 'Preferred instructor (optional, for slot matching)'
          }
        },
        required: ['courseType']
      }
    },
    {
      type: 'function',
      name: 'booking_step_authenticate',
      description: `Step 2: Authenticate/login to CRM system. Reuses existing session if available. This step is typically automatic and doesn't require user input.`,
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type (required for session initialization)',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion', 'TfL 1-2-1', 'TfL 1-2-1 Motorcycle Skills', 'TfL Beyond CBT', 'TfL - Beyond CBT - Skills for Delivery Riders', 'Full Licence Assessment', 'Full Motorcycle Licence Assessment']
          }
        },
        required: ['courseType']
      }
    },
    {
      type: 'function',
      name: 'booking_step_navigate_contacts',
      description: `Step 4 (Existing workflow only): Navigate to Contacts tab in CRM. Use this ONLY for existing client workflow after authentication.`,
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion', 'TfL 1-2-1', 'TfL 1-2-1 Motorcycle Skills', 'TfL Beyond CBT', 'TfL - Beyond CBT - Skills for Delivery Riders', 'Full Licence Assessment', 'Full Motorcycle Licence Assessment']
          },
          workflowType: {
            type: 'string',
            enum: ['existing'],
            description: 'Must be "existing" for this step'
          }
        },
        required: ['courseType', 'workflowType']
      }
    },
    {
      type: 'function',
      name: 'booking_step_search_client',
      description: `Step 5 (Existing workflow only): Search for existing client by mobile number or email. Verifies client identity. Use this ONLY for existing client workflow.`,
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion', 'TfL 1-2-1', 'TfL 1-2-1 Motorcycle Skills', 'TfL Beyond CBT', 'TfL - Beyond CBT - Skills for Delivery Riders', 'Full Licence Assessment', 'Full Motorcycle Licence Assessment']
          },
          workflowType: {
            type: 'string',
            enum: ['existing'],
            description: 'Must be "existing" for this step'
          },
          customerMobile: {
            type: 'string',
            description: 'Customer mobile number (11 digits, UK format)'
          },
          customerEmail: {
            type: 'string',
            description: 'Customer email address (if mobile not found)'
          },
          customerName: {
            type: 'string',
            description: 'Customer name (first 3 letters of first name + space + first 3 letters of surname, if mobile/email not found)'
          }
        },
        required: ['courseType', 'workflowType']
      }
    },
    {
      type: 'function',
      name: 'booking_step_select_session',
      description: `Step 6 (Existing) / Step 4 (New): Navigate to Diaries tab and select the agreed session slot. Requires sessionDetails from availability check.`,
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion', 'TfL 1-2-1', 'TfL 1-2-1 Motorcycle Skills', 'TfL Beyond CBT', 'TfL - Beyond CBT - Skills for Delivery Riders', 'Full Licence Assessment', 'Full Motorcycle Licence Assessment']
          },
          workflowType: {
            type: 'string',
            enum: ['existing', 'new'],
            description: 'Workflow type: "existing" or "new"'
          },
          sessionDetails: {
            type: 'object',
            description: 'Session details from availability check (date, time, location, instructor)'
          }
        },
        required: ['courseType', 'workflowType', 'sessionDetails']
      }
    },
    {
      type: 'function',
      name: 'booking_step_select_booking_options',
      description: `Step 7 (Existing) / Step 5 (New): Select booking options (bike type, CBT type, duration, etc.). This step REQUIRES preferences to be collected BEFORE calling. For ITM/CBT: requires bikeType. For CBT: also requires cbtType. For Gear Conversion: requires duration and bikeType.`,
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion', 'TfL 1-2-1', 'TfL 1-2-1 Motorcycle Skills', 'TfL Beyond CBT', 'TfL - Beyond CBT - Skills for Delivery Riders', 'Full Licence Assessment', 'Full Motorcycle Licence Assessment']
          },
          workflowType: {
            type: 'string',
            enum: ['existing', 'new'],
            description: 'Workflow type: "existing" or "new"'
          },
          bikeType: {
            type: 'string',
            enum: ['125cc automatic', '50cc automatic', '125cc manual'],
            description: 'Bike type preference (REQUIRED for most courses)'
          },
          cbtType: {
            type: 'string',
            enum: ['standard', 'renewal'],
            description: 'CBT type: "standard" or "renewal" (REQUIRED for CBT courses only)'
          },
          duration: {
            type: 'string',
            enum: ['2', '3', '4'],
            description: 'Duration in hours: "2", "3", or "4" (REQUIRED for Gear Conversion only)'
          }
        },
        required: ['courseType', 'workflowType']
      }
    },
    {
      type: 'function',
      name: 'booking_step_create_new_contact',
      description: `Step 6 (New workflow only): Click "New contact" button to create a new client profile. Use this ONLY for new client workflow.`,
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion', 'TfL 1-2-1', 'TfL 1-2-1 Motorcycle Skills', 'TfL Beyond CBT', 'TfL - Beyond CBT - Skills for Delivery Riders', 'Full Licence Assessment', 'Full Motorcycle Licence Assessment']
          },
          workflowType: {
            type: 'string',
            enum: ['new'],
            description: 'Must be "new" for this step'
          }
        },
        required: ['courseType', 'workflowType']
      }
    },
    {
      type: 'function',
      name: 'booking_step_fill_contact_details',
      description: `Step 8 (Existing) / Step 7 (New): Fill contact details form. For existing clients: fills only missing fields. For new clients: fills all fields from scratch.`,
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion', 'TfL 1-2-1', 'TfL 1-2-1 Motorcycle Skills', 'TfL Beyond CBT', 'TfL - Beyond CBT - Skills for Delivery Riders', 'Full Licence Assessment', 'Full Motorcycle Licence Assessment']
          },
          workflowType: {
            type: 'string',
            enum: ['existing', 'new'],
            description: 'Workflow type: "existing" or "new"'
          },
          customerEmail: {
            type: 'string',
            description: 'Customer email address'
          },
          customerMobile: {
            type: 'string',
            description: 'Customer mobile number (11 digits, UK format)'
          },
          customerName: {
            type: 'string',
            description: 'Customer full name'
          },
          postcode: {
            type: 'string',
            description: 'Customer postcode'
          },
          houseNumber: {
            type: 'string',
            description: 'House number or name'
          },
          nationalInsurance: {
            type: 'string',
            description: 'National Insurance number (optional)'
          },
          drivingLicenceNumber: {
            type: 'string',
            description: 'Driving licence number (optional)'
          }
        },
        required: ['courseType', 'workflowType']
      }
    },
    {
      type: 'function',
      name: 'booking_step_process_payment',
      description: `Step 9 (Existing) / Step 8 (New): Process payment and complete booking. Requires card details and terms acceptance. CRITICAL: Only ask for terms acceptance AFTER card details are filled.`,
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion', 'TfL 1-2-1', 'TfL 1-2-1 Motorcycle Skills', 'TfL Beyond CBT', 'TfL - Beyond CBT - Skills for Delivery Riders', 'Full Licence Assessment', 'Full Motorcycle Licence Assessment']
          },
          workflowType: {
            type: 'string',
            enum: ['existing', 'new'],
            description: 'Workflow type: "existing" or "new"'
          },
          paymentMethod: {
            type: 'string',
            description: 'Payment method (e.g., "Visa Debit", "Mastercard", etc.)'
          },
          cardNumber: {
            type: 'string',
            description: 'Card number'
          },
          expiryDate: {
            type: 'string',
            description: 'Card expiry date (MM/YY format)'
          },
          cvv: {
            type: 'string',
            description: 'Card CVV/security code'
          },
          cardholderName: {
            type: 'string',
            description: 'Cardholder name as it appears on card'
          },
          termsAccepted: {
            type: 'boolean',
            description: 'Whether client accepted terms and conditions (REQUIRED - ask AFTER card details are filled)'
          }
        },
        required: ['courseType', 'workflowType', 'termsAccepted']
      }
    },
    {
      type: 'function',
      name: 'booking_step_send_confirmation',
      description: `Step 10 (Existing) / Step 9 (New): Send booking confirmation email to customer.`,
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion', 'TfL 1-2-1', 'TfL 1-2-1 Motorcycle Skills', 'TfL Beyond CBT', 'TfL - Beyond CBT - Skills for Delivery Riders', 'Full Licence Assessment', 'Full Motorcycle Licence Assessment']
          },
          workflowType: {
            type: 'string',
            enum: ['existing', 'new'],
            description: 'Workflow type: "existing" or "new"'
          },
          customerEmail: {
            type: 'string',
            description: 'Customer email address'
          }
        },
        required: ['courseType', 'workflowType', 'customerEmail']
      }
    },
    {
      type: 'function',
      name: 'booking_step_send_terms',
      description: `Step 11 (Existing) / Step 10 (New): Send Terms & Conditions email to customer.`,
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion', 'TfL 1-2-1', 'TfL 1-2-1 Motorcycle Skills', 'TfL Beyond CBT', 'TfL - Beyond CBT - Skills for Delivery Riders', 'Full Licence Assessment', 'Full Motorcycle Licence Assessment']
          },
          workflowType: {
            type: 'string',
            enum: ['existing', 'new'],
            description: 'Workflow type: "existing" or "new"'
          },
          customerEmail: {
            type: 'string',
            description: 'Customer email address'
          }
        },
        required: ['courseType', 'workflowType', 'customerEmail']
      }
    },
    {
      type: 'function',
      name: 'booking_step_send_sms',
      description: `Step 12 (Existing) / Step 11 (New): Send SMS confirmation to customer.`,
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion', 'TfL 1-2-1', 'TfL 1-2-1 Motorcycle Skills', 'TfL Beyond CBT', 'TfL - Beyond CBT - Skills for Delivery Riders', 'Full Licence Assessment', 'Full Motorcycle Licence Assessment']
          },
          workflowType: {
            type: 'string',
            enum: ['existing', 'new'],
            description: 'Workflow type: "existing" or "new"'
          },
          customerMobile: {
            type: 'string',
            description: 'Customer mobile number (11 digits, UK format)'
          }
        },
        required: ['courseType', 'workflowType', 'customerMobile']
      }
    }
  ];
}

export function getToolDefinitions() {
  return [
    {
      type: 'function',
      name: 'web_search',
      description: 'Search the web for time-sensitive information not in knowledge base',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          },
          domains: {
            type: 'array',
            items: { type: 'string' },
            description: 'Allowed domains for search (optional)'
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of results to return (optional, default: 5)'
          }
        },
        required: ['query']
      }
    },
    {
      type: 'function',
      name: 'calendar',
      description: 'Manage calendar events and availability',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['check_availability', 'book_slot'],
            description: 'Action to perform'
          },
          date: {
            type: 'string',
            description: 'Date for the action (optional)'
          },
          time: {
            type: 'string',
            description: 'Time for the action (optional)'
          },
          duration: {
            type: 'number',
            description: 'Duration in minutes (optional)'
          }
        },
        required: ['action']
      }
    },
    {
      type: 'function',
      name: 'email',
      description: 'Send and manage emails',
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Recipient email address'
          },
          subject: {
            type: 'string',
            description: 'Email subject'
          },
          body: {
            type: 'string',
            description: 'Email body content (optional)'
          },
          template: {
            type: 'string',
            description: 'Email template name (optional)'
          }
        },
        required: ['to', 'subject']
      }
    },
    {
      type: 'function',
      name: 'crm',
      description: 'Access CRM system for customer management',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['get_customer', 'update_customer', 'create_booking'],
            description: 'CRM action to perform'
          },
          customerId: {
            type: 'string',
            description: 'Customer ID (optional)'
          },
          data: {
            type: 'object',
            description: 'Data for the action (optional)'
          }
        },
        required: ['action']
      }
    },
    {
      type: 'function',
      name: 'crm_browser',
      description: `Perform CRM tasks using browser automation (bookings, reschedules, cancellations, customer updates, availability checks).

CRITICAL ITM (Introduction to Motorcycling) BOOKING FLOW - MUST FOLLOW THIS ORDER:
1. FIRST: Call with task: "check_availability" and args: {courseType: "Introduction to Motorcycling"} to get available slots
2. Present all available slots to the caller and ask for preferences (date, time, location, instructor)
3. Agree on a specific slot with the caller
4. OPTIONAL: Ask "Have you done training with us before?" BEFORE calling create_booking. If you ask this question, you MUST include workflowType: "existing" or "new" in the create_booking call based on the caller's answer.
5. THEN: Call with task: "create_booking" and args: {courseType: "Introduction to Motorcycling", agreedSlot: <selected slot>, workflowType: "existing" or "new" (if you asked earlier), ...}
6. If you did NOT ask the question earlier AND the tool returns requiresWorkflowType: true, THEN ask "Have you done training with us before?" and call create_booking again with workflowType: "existing" or "new"
7. IMPORTANT: If you ask "Have you done training with us before?" at any point, you MUST include workflowType in the create_booking call. Do NOT call create_booking without workflowType if you already asked the question.

CRITICAL: TERMS AND CONDITIONS ACCEPTANCE (TIMING IS STRICT):
- 🚨 CRITICAL PROHIBITION: NEVER include termsAccepted in create_booking calls until AFTER card details are filled
- 🚨 NEVER include termsAccepted before navigating to Diaries tab
- 🚨 NEVER include termsAccepted before selecting booking options
- 🚨 NEVER include termsAccepted before contact lookup
- 🚨 NEVER include termsAccepted before payment step
- 🚨 NEVER include termsAccepted in continuation calls for preferences (bikeType, etc.)
- 🚨 NEVER include termsAccepted in continuation calls for verification
- 🚨 NEVER include termsAccepted in ANY create_booking call before the payment step

- CRITICAL TIMING: Ask for terms acceptance AFTER card details are filled, but BEFORE clicking "Make booking" button
- The booking flow order is STRICT: Availability → Login → Workflow Type → Find Client → Diaries Tab → Booking Options → Contact Details → Payment (fill card details) → TERMS ACCEPTANCE (ask here ONLY) → Click "Make booking"
- DO NOT ask for terms before Diaries tab
- DO NOT ask for terms before selecting booking options
- DO NOT ask for terms before contact lookup
- DO NOT ask for terms before payment step
- DO NOT ask for terms before card details are filled
- Read the terms from the system prompt (valid UK licence, appropriate footwear, denim jeans/motorcycle trousers, arrive on time, 30% cancellation fee, Terms & Conditions)
- Ask "Do you agree with the statements that I have just made?"
- If client says "yes" → Include termsAccepted: true in the FINAL create_booking call (ONLY after card details are filled, just before clicking "Make booking")
- If client says "no" → Address concerns, ask again. If still no, offer human transfer. If refused, terminate call.
- If no response → System defaults to termsAccepted: true to allow booking to proceed
- 🚨 CRITICAL: The ONLY time to include termsAccepted is in the FINAL create_booking call AFTER card details are filled, just before clicking "Make booking" button

For all other courses (CBT, Private Lesson, etc.):
- Follow standard booking flow
- For create_booking, courseType is required
- For reschedule_booking and cancel_booking, bookingReference and customerEmail/customerMobile are required
- For update_customer, customerEmail/customerMobile and at least one field to update are required
- For check_availability, courseType is required

This tool opens a browser and performs the actual CRM operations.`,
      parameters: {
        type: 'object',
        properties: {
          task: {
            type: 'string',
            enum: ['create_booking', 'reschedule_booking', 'cancel_booking', 'update_customer', 'check_availability'],
            description: 'Type of CRM task to perform'
          },
          args: {
            type: 'object',
            properties: {
              courseType: {
                type: 'string',
                enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion', 'TfL 1-2-1', 'TfL 1-2-1 Motorcycle Skills', 'TfL Beyond CBT', 'TfL - Beyond CBT - Skills for Delivery Riders', 'Full Licence Assessment', 'Full Motorcycle Licence Assessment'],
                description: 'Required for create_booking and check_availability: Type of course to book or check availability for'
              },
              customerEmail: {
                type: 'string',
                description: 'Customer email address (optional - will be collected during booking if not provided)'
              },
              customerPhone: {
                type: 'string',
                description: 'Customer phone number (optional - will be collected during booking if not provided)'
              },
              preferredDate: {
                type: 'string',
                description: 'Preferred booking date'
              },
              preferredTime: {
                type: 'string',
                description: 'Preferred booking time'
              },
              location: {
                type: 'string',
                description: 'Preferred training location'
              },
              bikeType: {
                type: 'string',
                description: 'Bike type preference (e.g., "125cc automatic", "50cc automatic", "125cc manual", "500cc restricted", "600cc")'
              },
              cbtType: {
                type: 'string',
                enum: ['standard', 'renewal'],
                description: 'For CBT courses: "standard" for new riders, "renewal" for existing CBT holders'
              },
              duration: {
                type: 'string',
                enum: ['2', '3', '4'],
                description: 'For Gear Conversion: duration in hours ("2", "3", or "4")'
              },
              bookingReference: {
                type: 'string',
                description: 'Booking reference (alphanumeric code like "BK-2025-ABC123") for reschedule or cancellation tasks. Required for reschedule_booking and cancel_booking.'
              },
              newDate: {
                type: 'string',
                description: 'New date for rescheduling (ISO format or DD/MM/YYYY). Required for reschedule_booking.'
              },
              newTime: {
                type: 'string',
                description: 'New time for rescheduling (HH:MM format). Optional for reschedule_booking.'
              },
              newLocation: {
                type: 'string',
                description: 'New location for rescheduling. Optional for reschedule_booking.'
              },
              reason: {
                type: 'string',
                description: 'Reason for cancellation. Optional for cancel_booking.'
              },
              customerMobile: {
                type: 'string',
                description: 'Customer mobile number. Used for finding customer for reschedule/cancel/update operations.'
              },
              email: {
                type: 'string',
                description: 'New email address for customer updates. Used for update_customer task.'
              },
              mobile: {
                type: 'string',
                description: 'New mobile number for customer updates. Used for update_customer task.'
              },
              postcode: {
                type: 'string',
                description: 'New postcode for customer updates. Used for update_customer task.'
              },
              firstName: {
                type: 'string',
                description: 'New first name for customer updates. Used for update_customer task.'
              },
              surname: {
                type: 'string',
                description: 'New surname for customer updates. Used for update_customer task.'
              },
              address: {
                type: 'string',
                description: 'New address for customer updates. Used for update_customer task.'
              },
              workflowType: {
                type: 'string',
                enum: ['existing', 'new'],
                description: 'Workflow type: "existing" for clients who have trained with us before, "new" for new clients. Required for ITM bookings after availability check.'
              },
              agreedSlot: {
                type: 'object',
                description: 'The specific slot that was agreed upon with the caller. Should include date, time, location, and optionally instructor. Used to skip availability check.',
                properties: {
                  date: { type: 'string', description: 'Date of the slot (ISO format or date string)' },
                  time: { type: 'string', description: 'Time of the slot (HH:MM format)' },
                  location: { type: 'string', description: 'Location of the slot' },
                  instructor: { type: 'string', description: 'Instructor name (optional)' },
                  price: { type: 'string', description: 'Price of the slot (optional)' }
                }
              },
              selectedSlot: {
                type: 'object',
                description: 'Alternative name for agreedSlot - the selected slot from availability check.',
                properties: {
                  date: { type: 'string', description: 'Date of the slot (ISO format or date string)' },
                  time: { type: 'string', description: 'Time of the slot (HH:MM format)' },
                  location: { type: 'string', description: 'Location of the slot' },
                  instructor: { type: 'string', description: 'Instructor name (optional)' },
                  price: { type: 'string', description: 'Price of the slot (optional)' }
                }
              },
              termsAccepted: {
                type: 'boolean',
                description: 'Whether the client has accepted the terms and conditions. You MUST ask the client to accept terms before payment. Read the terms: valid UK licence requirement, appropriate footwear, denim jeans/motorcycle trousers, arrive on time, 30% cancellation fee, and Terms & Conditions. Ask "Do you agree with the statements that I have just made?" If client says "yes", set this to true. If client says "no" or asks questions, address them and ask again. If still no agreement, offer human transfer. If no response is received, default to true to allow booking to proceed.'
              },
              instructor: {
                type: 'string',
                description: 'Preferred instructor name (optional)'
              }
            },
            required: []
          }
        },
        required: ['task', 'args']
      }
    },
    {
      type: 'function',
      name: 'payments',
      description: 'Process payments and refunds',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['process_payment', 'refund'],
            description: 'Payment action to perform'
          },
          amount: {
            type: 'number',
            description: 'Amount to process'
          },
          currency: {
            type: 'string',
            description: 'Currency code (optional, default: GBP)'
          },
          customerId: {
            type: 'string',
            description: 'Customer ID (optional)'
          }
        },
        required: ['action', 'amount']
      }
    },
    {
      type: 'function',
      name: 'file_search',
      description: 'Search the knowledge base for relevant information',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          },
          files: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of file IDs to search in (optional)'
          }
        },
        required: ['query']
      }
    },
    {
      type: 'function',
      name: 'transfer_call',
      description: 'Transfer call to human agent',
      parameters: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Target phone number or queue for transfer'
          },
          reason: {
            type: 'string',
            description: 'Reason for transfer (optional)'
          }
        },
        required: ['target']
      }
    },
    {
      type: 'function',
      name: 'kba_verification',
      description: 'Verify caller identity using Knowledge-Based Authentication (KBA). Required before accessing or changing personal booking data. Use email + postcode + booking reference (if available). If mobile number is registered, an OTP will be sent. Provide the OTP code in a subsequent call to complete verification.',
      parameters: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            description: 'Email address on the booking'
          },
          postcode: {
            type: 'string',
            description: 'Postcode associated with the booking'
          },
          bookingReference: {
            type: 'string',
            description: 'Booking reference number (optional but recommended)'
          },
          otpCode: {
            type: 'string',
            description: 'OTP verification code (if OTP was sent in previous verification step)'
          }
        },
        required: ['email', 'postcode']
      }
    },
    {
      type: 'function',
      name: 'client_verification',
      description: 'Verify caller identity by comparing their spoken details (full name, postcode, telephone number) against stored CRM client details. Use this after finding a client in the CRM system. The caller must verbally confirm these three pieces of information match what is on file. Allow up to 7 attempts per field before offering to create a new profile. CRITICAL: After successful verification during a booking process, you MUST continue with the booking by calling crm_browser with task: "create_booking" using the same parameters as before. Verification is just one step in the booking process - the booking is NOT complete until you receive a success confirmation from the crm_browser tool.',
      parameters: {
        type: 'object',
        properties: {
          fullName: {
            type: 'string',
            description: 'Full name as spoken by the caller (including title if provided, e.g., "Mr John Smith")'
          },
          postcode: {
            type: 'string',
            description: 'Postcode as spoken by the caller (UK format, e.g., "HA8 6AG")'
          },
          telephoneNumber: {
            type: 'string',
            description: 'Telephone number as spoken by the caller (UK mobile format, 11 digits starting with 07)'
          }
        },
        required: ['fullName', 'postcode', 'telephoneNumber']
      }
    },
    {
      type: 'function',
      name: 'complaint_submission',
      description: 'Submit a formal complaint. Use this when a customer expresses dissatisfaction, reports an issue, or requests to file a complaint. Automatically creates a complaint record and sends email notification.',
      parameters: {
        type: 'object',
        properties: {
          complaintType: {
            type: 'string',
            enum: ['service_quality', 'ai_understanding', 'response_time', 'technical_issue', 'billing', 'booking', 'instructor_conduct', 'safety_concern', 'discrimination', 'legal', 'media', 'other'],
            description: 'Type of complaint (optional, will be auto-detected if not provided)'
          },
          complaintText: {
            type: 'string',
            description: 'Details of the complaint'
          },
          callerDetails: {
            type: 'object',
            description: 'Additional caller details (optional)'
          }
        },
        required: ['complaintText']
      }
    },
    // Step-based booking tools (preferred over crm_browser.create_booking)
    ...getStepBookingToolDefinitions()
  ];
}

