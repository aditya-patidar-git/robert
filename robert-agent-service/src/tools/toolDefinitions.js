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
      description: `Step 1: Check availability for a course type. CRITICAL WORKFLOW:
      
1. BEFORE calling this tool: Ask the caller about their preferences:
   - "Do you have any preference for date or time?"
   - "Do you have any location preference?" (Alperton, Croydon, Edgware, Eltham, Wimbledon, Dagenham, Hoddesdon)
   - "Do you have any instructor preference?"
   
2. Call this tool with preferences (or omit if no preferences). The tool will use preferences to filter and prioritize slots when opening the availability table.

3. AFTER this tool returns: Present available slots to the caller

4. WHEN caller selects a slot: Extract the slot details (date, time, location) from their response and call the NEXT step (booking_step_authenticate) with agreedSlot parameter containing the selected slot object matching one of the returned slots.

The tool will use preferences to filter and prioritize slots, but will return all available slots for the caller to choose from.`,
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
            description: 'Preferred date (optional, for slot matching/filtering)'
          },
          preferredTime: {
            type: 'string',
            description: 'Preferred time (optional, for slot matching/filtering)'
          },
          location: {
            type: 'string',
            description: 'Preferred location (optional, for slot matching/filtering)'
          },
          instructor: {
            type: 'string',
            description: 'Preferred instructor (optional, for slot matching/filtering)'
          }
        },
        required: ['courseType']
      }
    },
    {
      type: 'function',
      name: 'booking_step_authenticate',
      description: `Step 2: Authenticate/login to CRM system. Reuses existing session if available. This step is typically automatic and doesn't require user input.

CRITICAL: If the caller has selected a slot from Step 1, pass agreedSlot parameter with the selected slot details (date, time, location, instructor if available). This ensures the slot is stored for later steps.`,
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type (required for session initialization)',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion', 'TfL 1-2-1', 'TfL 1-2-1 Motorcycle Skills', 'TfL Beyond CBT', 'TfL - Beyond CBT - Skills for Delivery Riders', 'Full Licence Assessment', 'Full Motorcycle Licence Assessment']
          },
          agreedSlot: {
            type: 'object',
            description: 'The slot that was selected by the caller in Step 1. Should match one of the slots returned by booking_step_check_availability.',
            properties: {
              date: { type: 'string', description: 'Date of the slot' },
              time: { type: 'string', description: 'Time of the slot' },
              location: { type: 'string', description: 'Location of the slot' },
              instructor: { type: 'string', description: 'Instructor name (optional)' },
              startDate: { type: 'string', description: 'ISO date string (optional)' }
            }
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
      description: `Step 5 (Existing workflow only): Search for existing client in Contacts tab by mobile number or email. This happens BEFORE client verification. After this step completes, client verification is required. Use this ONLY for existing client workflow after navigate_contacts. DO NOT confuse this with booking_step_lookup_contact (Step 7.5) which happens later in the booking form.`,
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
      description: `Step 6 (Existing) / Step 4 (New): Navigate to Diaries tab and select the agreed session slot. Session details are automatically retrieved from the availability check if not provided.`,
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
            description: 'Session details from availability check (date, time, location, instructor). Optional - will be retrieved from session state if not provided.'
          }
        },
        required: ['courseType', 'workflowType']
      }
    },
    {
      type: 'function',
      name: 'booking_step_select_booking_options',
      description: `Step 7 (Existing) / Step 5 (New): Select booking options. The tool name is exactly booking_step_select_booking_options (NOT booking_step_finalize_booking, booking_step_finalize_course_options, or booking_step_select_options). This step APPLIES the chosen options on the page (e.g. selects bike type). Call it first with courseType and workflowType; then ask the caller for options and LIST them (for ITM: "125cc automatic, 50cc automatic, 125cc manual"). After the caller chooses, call this tool again with courseType, workflowType, and bikeType (and cbtType/duration as needed)—pass these as TOP-LEVEL parameters, not inside a selectedOptions object. For CBT also pass cbtType; for Gear Conversion pass duration and bikeType. After options are set, use booking_step_lookup_contact or booking_step_create_new_contact, then booking_step_fill_contact_details.`,
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
            description: 'Bike type preference (REQUIRED for most courses). Pass as top-level parameter; do not nest under selectedOptions.'
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
      name: 'booking_step_lookup_contact',
      description: `Step 7.5 (Existing workflow only): Lookup existing client contact in booking form iframe. This happens AFTER booking_step_select_booking_options and BEFORE booking_step_fill_contact_details. This is a silent step with periodic updates - do NOT ask questions. Use this ONLY for existing client workflow after booking_step_select_booking_options. DO NOT confuse this with booking_step_search_client (Step 5) which happens earlier in the Contacts tab before client verification.`,
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
          customerEmail: {
            type: 'string',
            description: 'Customer email address (optional, can come from session)'
          },
          postcode: {
            type: 'string',
            description: 'Customer postcode (optional, for verification when multiple matches appear)'
          }
        },
        required: ['courseType', 'workflowType']
      }
    },
    {
      type: 'function',
      name: 'booking_step_fill_contact_details',
      description: `Step 8 (Existing) / Step 7 (New): Fill contact details form. For existing clients: runs AFTER booking_step_lookup_contact (Step 7.5); checks all required fields and returns a full list of missing ones (missingFields). Collect all missing details from the caller iteratively (one or more turns), then call this tool ONCE with all parameters to fill and proceed. For new clients: runs AFTER booking_step_create_new_contact (Step 6) and fills all fields from scratch.`,
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
          },
          addressConfirmed: {
            type: 'boolean',
            description: 'Whether the client has confirmed the auto-populated address. Set to false on first call to get confirmation, then set to true after client confirms. Default: false'
          },
          correctedAddress: {
            type: 'string',
            description: 'Corrected address if the client said the auto-populated address was incorrect. Only provide this if client said "no" to the address confirmation.'
          }
        },
        required: ['courseType', 'workflowType']
      }
    },
    {
      type: 'function',
      name: 'booking_step_process_payment',
      description: `Step 9 (Existing) / Step 8 (New): Process payment and complete booking. Uses updated payment procedure: payment link (sent via SMS/email) or Twilio Pay (DTMF-based phone payment). CRITICAL: Do NOT collect card details directly - the system handles payment automatically. Only ask for terms acceptance AFTER payment is confirmed.`,
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
            enum: ['payment_link', 'twilio_pay', 'phone_payment'],
            description: 'Payment method: "payment_link" (default, sends secure payment link via SMS/email) or "twilio_pay"/"phone_payment" (DTMF-based phone payment). If not provided, defaults to "payment_link".'
          },
          termsAccepted: {
            type: 'boolean',
            description: 'Whether client accepted terms and conditions (REQUIRED - ask AFTER payment is confirmed, just before clicking "Make booking" button)'
          }
        },
        required: ['courseType', 'workflowType', 'termsAccepted']
      }
    },
    {
      type: 'function',
      name: 'booking_step_send_payment_request',
      description: `Step 9 (Existing) / Step 8 (New): Send payment request via email or SMS. Use this AFTER selecting "Send a payment request" option in payment dropdown. The system will automatically poll every 30 seconds for up to 5 minutes to detect when the client completes payment and the "Make booking" button appears, then click it automatically.`,
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
          deliveryMethod: {
            type: 'string',
            enum: ['email', 'sms'],
            description: 'Delivery method: "email" to send payment request via email, or "sms" to send via SMS text message. Ask the client for their preference before calling this tool.'
          },
          clientEmail: {
            type: 'string',
            description: 'Client email address (optional, only needed if deliveryMethod is "email" and email is not pre-filled)'
          },
          clientMobile: {
            type: 'string',
            description: 'Client mobile number (optional, only needed if deliveryMethod is "sms" and mobile is not pre-filled)'
          },
          confirmed: {
            type: 'boolean',
            description: 'Whether the client has confirmed the email/phone number. Set to false on first call to get confirmation, then set to true after client confirms. Default: false'
          },
          termsAcceptedBeforeSend: {
            type: 'boolean',
            description: 'CRITICAL: Whether the client has accepted the terms and conditions BEFORE sending the payment request. This is MANDATORY - terms must be asked and accepted before sending payment request. Set to undefined/false on first call to ask terms, then set to true after client accepts. Default: undefined (terms will be asked)'
          }
        },
        required: ['courseType', 'workflowType', 'deliveryMethod']
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
      name: 'send_sms',
      description: 'Send SMS messages independently (for complaints, summaries, confirmations, etc.). This is a standalone tool separate from booking workflow. Use this for sending SMS outside of booking confirmations.',
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Recipient mobile number (UK format: 11 digits starting with 07, e.g., 07123456789)'
          },
          message: {
            type: 'string',
            description: 'SMS message body (required, max 1600 characters, best practice is 160 characters)'
          }
        },
        required: ['to', 'message']
      }
    },
    {
      type: 'function',
      name: 'generate_reference_id',
      description: 'Generate a tracking/reference ID for complaints, bookings, or general tracking. Use this whenever a caller needs a reference number to track their request or conversation. Returns a short, easy-to-share reference ID (e.g., REF-ABC123).',
      parameters: {
        type: 'object',
        properties: {
          prefix: {
            type: 'string',
            description: 'Optional prefix for the reference ID (default: "REF"). Examples: "REF", "TRACK", "COMP", "BOOK". Max 10 characters, alphanumeric only.'
          },
          purpose: {
            type: 'string',
            description: 'Optional purpose/context for the reference (e.g., "complaint", "booking", "tracking", "general"). Used for logging and caller messaging.'
          }
        },
        required: []
      }
    },
    {
      type: 'function',
      name: 'payments',
      description: `⚠️ LEGACY TOOL: Provides guidance for payment processing. Direct payment processing is not supported in v1.
      
Per project requirements:
- v1: Card payments in-agent are out-of-scope
- v1.1: Will use Twilio <Pay> (PCI Mode) when enabled
- Never collect card details directly

For booking payments:
- Use booking_step_process_payment (Twilio Pay during booking) OR
- Use booking_step_send_payment_request (send payment link via email/SMS)

For refunds:
- Follow the appropriate refund process after identity verification (if permitted by policy)

This tool returns guidance messages directing to the appropriate tools.`,
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
            description: 'Amount to process (optional, for informational purposes)'
          },
          currency: {
            type: 'string',
            description: 'Currency code (optional, default: GBP)'
          },
          customerId: {
            type: 'string',
            description: 'Customer ID (optional)'
          },
          bookingId: {
            type: 'string',
            description: 'Booking ID if payment is for a specific booking (optional)'
          }
        },
        required: ['action']
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
      description: 'Warm transfer to a human agent. Target is chosen from configured transfer numbers in Telephony Routing. If no agent is available, the caller will be told that all agents are occupied and offered to try again later or be contacted.',
      parameters: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Optional; target is resolved from configured transfer numbers'
          },
          reason: {
            type: 'string',
            description: 'Reason for transfer (optional)'
          }
        },
        required: []
      }
    },
    {
      type: 'function',
      name: 'start_workflow',
      description: 'Start a specific workflow when you understand the caller\'s intent. Call this as soon as the caller clearly indicates what they want (in any language). Then in the SAME response, speak a short acknowledgment and the first question of that workflow. Allowed workflows: cancellation (cancel a booking), booking (make a new booking or check availability), complaint (file a complaint). Do NOT ask for booking reference, email or phone before starting cancellation—start cancellation and ask "Do you have a current booking with us?" first.',
      parameters: {
        type: 'object',
        properties: {
          workflow: {
            type: 'string',
            enum: ['cancellation', 'booking', 'complaint'],
            description: 'Workflow to start: cancellation = cancel a booking; booking = make/check booking; complaint = file a complaint'
          }
        },
        required: ['workflow']
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
      description: `Verify caller identity by comparing their spoken details (full name, postcode, telephone number) against stored CRM client details. Use this after finding a client in the CRM system.

🚨 SEQUENTIAL VERIFICATION WORKFLOW:
1. FIRST: Ask for full name using: "Thanks for this; I believe that I have found your profile with us; However, for data protection purposes, could you please confirm your full name?"
   - Call this tool with ONLY fullName parameter
   - Wait for verification result
   - If verified, proceed to step 2
   - If mismatch, use the exact error message provided and ask again (up to 7 attempts)

2. SECOND: After full name is verified, ask for postcode using: "Thank you. Now, could you please confirm your post code?"
   - Call this tool with fullName (already verified) AND postcode parameter
   - Wait for verification result
   - If verified, proceed to step 3
   - If mismatch, use the exact error message provided and ask again (up to 7 attempts)

3. THIRD: After postcode is verified, ask for telephone number using: "Thank you. Finally, could you please confirm your telephone number?"
   - Call this tool with fullName, postcode (already verified) AND telephoneNumber parameter
   - Wait for verification result
   - If verified, verification is complete; if the tool returns offerUpdatePhone: true, ask "Would you like us to update your telephone number to the new one?" and if yes offer to transfer to an agent (use transfer_call)
   - If mismatch: when the tool returns a "last four digits" confirmation prompt, use that exact message to ask the caller to confirm the number on file; otherwise use the exact error message provided and ask again (up to 7 attempts)

🚨 CRITICAL SECURITY RULE: You MUST ONLY use values that the caller ACTUALLY SPOKE in this conversation. DO NOT use values from stored client details, CRM data, or conversation context. Extract ONLY what the caller says.

🚨 FIELD-SPECIFIC ERROR MESSAGES: When a field doesn't match, use the EXACT error message provided by the tool:
- Full name mismatch: "Unfortunately, the full name that you have provided does not match the one that we hold on file for you; have you changed your name, or have you perhaps previously provided a different spelling of your name to us?"
- Postcode mismatch: "Unfortunately, the post code that you have provided does not match the one that we hold on file for you; have you changed your address, or have you perhaps previously provided a different postcode to us?"
- Telephone mismatch: "Unfortunately, the telephone number that you have provided does not match the one that we hold on file for you; have you changed your telephone number or have you ever provided us with an alternative telephone number?"

After successful verification of all three fields, say: "You are successfully verified. Would you like to proceed with your booking? Please say yes or no." and wait for confirmation.

WARNING: Never disclose any personal information from our clients found in the system to the caller (GDPR).`,
      parameters: {
        type: 'object',
        properties: {
          fullName: {
            type: 'string',
            description: 'Full name as spoken by the caller (including title if provided, e.g., "Mr John Smith"). Required for first verification step. Extract ONLY from caller\'s spoken response. DO NOT use stored client details or CRM data. If caller did not speak their full name, omit this parameter.'
          },
          postcode: {
            type: 'string',
            description: 'Postcode as spoken by the caller (UK format, e.g., "HA8 6AG"). Required for second verification step (after fullName is verified). Extract ONLY from caller\'s spoken response. DO NOT use stored client details or CRM data. If caller did not speak their postcode, omit this parameter.'
          },
          telephoneNumber: {
            type: 'string',
            description: 'Telephone number as spoken by the caller (UK mobile format, 11 digits starting with 07). Required for third verification step (after fullName and postcode are verified). Extract ONLY from caller\'s spoken response. DO NOT use stored client details or CRM data. If caller did not speak their telephone number, omit this parameter.'
          }
        },
        required: [] // Fields are required sequentially, not all at once
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
    // Step-based booking tools
    ...getStepBookingToolDefinitions(),
    // Step-based cancellation tools
    ...getCancellationStepToolDefinitions()
  ];
}

/**
 * Get cancellation step tool definitions
 * @returns {Array} Array of cancellation step tool definition objects
 */
function getCancellationStepToolDefinitions() {
  return [
    {
      type: 'function',
      name: 'cancellation_step_verify_booking_intent',
      description: `Step 1: Verify caller has a current booking, collect course type, then explain cancellation policy. You MUST invoke this tool—do not output courseType or parameters as speech or JSON.

🚨 STRICT ORDER: (1) Ask "Do you have a current booking with us?" (2) If yes, ask "What type of course is your booking for?" (e.g. CBT, Introduction to Motorcycling, Private Lesson, Gear Conversion)—courseType is REQUIRED before the policy. (3) Only after you have courseType, explain the policy and ask "Would you like to proceed?" (4) If they say yes to proceed, call with verified: true, proceedToStep2: true, courseType: <the one they gave>; then immediately call cancellation_step_authenticate.

When to call (interpret caller response in context of the last question):
- After "Do you have a current booking with us?" and caller confirms (yes, I do, etc.): call with verified: true only. The tool will tell you to ask for course type—ask that question, then when they answer call with verified: true, courseType: <their answer>. Do NOT explain the policy until you have courseType.
- After you have courseType and have explained the policy and asked "Would you like to proceed?" and caller agrees (yes, proceed, etc.): call with verified: true, proceedToStep2: true, courseType: <same courseType>; then immediately call cancellation_step_authenticate with that courseType.
- If caller says they do not have a booking: call with verified: false.
- If caller has a booking but declines to proceed: call with verified: true, proceedToStep2: false, courseType: <same as before>.

Cancellation policy: minimum 3 full working days' notice, 30% admin fee; less than 3 days = entire fee. Full Terms on website.`,
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type being cancelled. REQUIRED after caller confirms they have a booking (ask before stating policy) and REQUIRED when proceedToStep2: true.',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion']
          },
          verified: {
            type: 'boolean',
            description: 'Whether caller confirmed they have a booking (set after asking caller)'
          },
          proceedToStep2: {
            type: 'boolean',
            description: 'Whether to proceed to Step 2 (true only when caller agreed to proceed after policy; requires courseType)'
          }
        },
        required: []
      }
    },
    {
      type: 'function',
      name: 'cancellation_step_authenticate',
      description: 'Step 2: Login to CRM system. You MUST invoke this tool when proceeding to Step 2—do not output courseType or JSON as speech. Call ONLY after the caller has agreed to proceed (after you explained the policy and asked "Would you like to proceed?") and after cancellation_step_verify_booking_intent was called with verified: true, proceedToStep2: true, and the same courseType. Say the exact message from the previous tool (e.g. "I\'ll now login to the system...") then call this tool immediately with that courseType.',
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion']
          }
        },
        required: ['courseType']
      }
    },
    {
      type: 'function',
      name: 'cancellation_step_determine_workflow',
      description: `Step 3: Determine workflow type. For cancellation workflows, this always returns 'existing' since cancellation requires an existing booking. This is a voice-only step.

Ask the caller: "Have you done training with us before?"
- Always set workflowType to 'existing' for cancellation workflows`,
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion']
          },
          workflowType: {
            type: 'string',
            description: 'Workflow type (always "existing" for cancellation)',
            enum: ['existing']
          }
        },
        required: ['courseType']
      }
    },
    {
      type: 'function',
      name: 'cancellation_step_navigate_contacts',
      description: 'Step 4: Navigate to Contacts tab in CRM. Reuses booking navigation logic.',
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion']
          },
          workflowType: {
            type: 'string',
            description: 'Workflow type (always "existing" for cancellation)',
            enum: ['existing']
          }
        },
        required: ['courseType', 'workflowType']
      }
    },
    {
      type: 'function',
      name: 'cancellation_step_search_client',
      description: `Step 5: Search for client using smart search with fallback (mobile → email → name). Includes client verification. Reuses booking search logic. If email search fails, ask "Could you please tell me your full name?" and call again with customerName; name search uses first 3 letters of first name + space + first 3 of last name (or middle 3 if no match). WARNING: Never disclose any personal information from our clients found in the system to the caller (GDPR).`,
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion']
          },
          workflowType: {
            type: 'string',
            description: 'Workflow type (always "existing" for cancellation)',
            enum: ['existing']
          },
          customerMobile: {
            type: 'string',
            description: 'Customer mobile number (11 digits, UK format starting with 07)'
          },
          customerEmail: {
            type: 'string',
            description: 'Customer email address (used as fallback if mobile search fails)'
          },
          customerName: {
            type: 'string',
            description: 'Customer name (used as fallback if mobile and email searches fail)'
          }
        },
        required: ['courseType', 'workflowType']
      }
    },
    {
      type: 'function',
      name: 'cancellation_step_select_client',
      description: 'Step 6: Click on verified client name in search results to open their profile.',
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion']
          },
          workflowType: {
            type: 'string',
            description: 'Workflow type (always "existing" for cancellation)',
            enum: ['existing']
          },
          clientName: {
            type: 'string',
            description: 'Verified client name (from Step 5)'
          }
        },
        required: ['courseType', 'workflowType']
      }
    },
    {
      type: 'function',
      name: 'cancellation_step_locate_booking',
      description: `Step 7: Find booking in "Bookings, credits, and debits" section of client profile. Validates booking date (must be in future) and course type, then calculates cancellation fee.

Always use the course type the caller stated (e.g. "Introduction to Motorcycling" or "ITM", or "CBT")—do not default to CBT. Ask the caller: "What date is your course booked for?" then call this tool with courseDate (DD/MM/YYYY) and the same courseType the caller gave earlier.`,
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type as stated by the caller (required). Use exactly what they said, e.g. Introduction to Motorcycling, ITM, CBT—do not substitute a default.',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion']
          },
          workflowType: {
            type: 'string',
            description: 'Workflow type (always "existing" for cancellation)',
            enum: ['existing']
          },
          courseDate: {
            type: 'string',
            description: 'Date of the course booking to cancel. Use DD/MM/YYYY format (e.g. 27/03/2026).'
          }
        },
        required: ['courseType', 'workflowType', 'courseDate']
      }
    },
    {
      type: 'function',
      name: 'cancellation_step_confirm_cancellation',
      description: `Step 8: Confirm cancellation with caller and explain fees. This is a voice-only step that requires caller confirmation.

Mention the Terms URL when explaining the policy (Full Terms & Conditions are available on our website). Explain the cancellation policy and fees from Step 7, then ask: "Would you like to proceed with the cancellation?"
- If they say "Yes": Set confirmed: true. Say the exact message returned by this tool ("I'll now cancel your booking. Please bear with me a moment.") and IMMEDIATELY call cancellation_step_initiate_cancellation—do not ask for yes/no; next steps are automatic.
- If they say "No": Set confirmed: false and do not proceed`,
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion']
          },
          workflowType: {
            type: 'string',
            description: 'Workflow type (always "existing" for cancellation)',
            enum: ['existing']
          },
          bookingDetails: {
            type: 'object',
            description: 'Booking details from Step 7'
          },
          cancellationFee: {
            type: 'number',
            description: 'Cancellation fee amount from Step 7'
          },
          refundAmount: {
            type: 'number',
            description: 'Refund amount from Step 7'
          },
          confirmed: {
            type: 'boolean',
            description: 'Whether caller confirmed cancellation (set after asking caller)'
          }
        },
        required: ['courseType', 'workflowType']
      }
    },
    {
      type: 'function',
      name: 'cancellation_step_initiate_cancellation',
      description: 'Step 9: Click on booking row and select "Cancel booking" from context menu to open cancellation form.',
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion']
          },
          workflowType: {
            type: 'string',
            description: 'Workflow type (always "existing" for cancellation)',
            enum: ['existing']
          },
          courseDate: {
            type: 'string',
            description: 'Course date (from Step 7)'
          }
        },
        required: ['courseType', 'workflowType', 'courseDate']
      }
    },
    {
      type: 'function',
      name: 'cancellation_step_fill_cancellation_form',
      description: `Step 10: Fill cancellation form with reason, notes, fee amount, and submit.

Fee amounts by course type:
- CBT: £58.50
- Executive CBT: £165.00
- ITM/Gear Conversion/Private Lesson: £37.50`,
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion']
          },
          workflowType: {
            type: 'string',
            description: 'Workflow type (always "existing" for cancellation)',
            enum: ['existing']
          },
          cancellationFee: {
            type: 'number',
            description: 'Cancellation fee amount (from Step 7)'
          },
          cancellationReason: {
            type: 'string',
            description: 'Reason for cancellation (default: "No longer needed")'
          }
        },
        required: ['courseType', 'workflowType', 'cancellationFee']
      }
    },
    {
      type: 'function',
      name: 'cancellation_step_navigate_communication',
      description: 'Step 11: Navigate to Communication tab in client profile.',
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion']
          },
          workflowType: {
            type: 'string',
            description: 'Workflow type (always "existing" for cancellation)',
            enum: ['existing']
          }
        },
        required: ['courseType', 'workflowType']
      }
    },
    {
      type: 'function',
      name: 'cancellation_step_select_template',
      description: 'Step 12: Select "Cancellation confirmation of course/session" template and click Preview.',
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion']
          },
          workflowType: {
            type: 'string',
            description: 'Workflow type (always "existing" for cancellation)',
            enum: ['existing']
          }
        },
        required: ['courseType', 'workflowType']
      }
    },
    {
      type: 'function',
      name: 'cancellation_step_send_confirmation',
      description: 'Step 13: Send cancellation confirmation email to client.',
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion']
          },
          workflowType: {
            type: 'string',
            description: 'Workflow type (always "existing" for cancellation)',
            enum: ['existing']
          }
        },
        required: ['courseType', 'workflowType']
      }
    },
    {
      type: 'function',
      name: 'cancellation_step_voice_confirmation',
      description: `Step 14: Confirm cancellation completion to caller. This is a voice-only step.

Say to the caller: "Your booking has now been cancelled, and I have now sent you an email confirmation. Is there anything else that I can help you with?"
- If they say "No": Say exactly: "Thank you for calling Universal Motorcycle Training, we look forward to hearing from you again soon."
- If they say "Yes": Assist with additional queries`,
      parameters: {
        type: 'object',
        properties: {
          courseType: {
            type: 'string',
            description: 'Course type',
            enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion']
          },
          workflowType: {
            type: 'string',
            description: 'Workflow type (always "existing" for cancellation)',
            enum: ['existing']
          }
        },
        required: ['courseType', 'workflowType']
      }
    }
  ];
}

