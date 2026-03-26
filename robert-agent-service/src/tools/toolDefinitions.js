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

STRICT: Do NOT mention any specific dates, times, locations, or slot options until this tool has RETURNED. Before the tool returns, say ONLY that you are checking (e.g. "Let me check availability for you" or "Checking now."). Never invent or list slots—only present what the tool result contains.

1. BEFORE calling: Ask preferences in order. Each "no preference" (or "show latest slots") is a valid answer—then call with what was collected (or omit nulls).
   - Date/time: "Do you have any preference for date or time?" If they say "I want to see the latest available slots", "show me the latest slots", or "no preference", treat as valid: we use the earliest date (topmost in table). Then ask location.
   - Location: "Do you have any location preference?" (Alperton, Croydon, Edgware, Eltham, Wimbledon, Dagenham, Hoddesdon). If no preference, we show all slots on the earliest date; if they give a location, we narrow down. If the caller gives their area/town (e.g. "I'm in Sutton"), use the nearest centre from the list and pass that name.
   - Instructor: "Do you have any instructor preference?" If no preference, no filter; if they give one, we narrow down further.
2. Call this tool with courseType and any preferences they gave; omit or pass null for "no preference". With no preferences the tool uses the earliest date and returns all slots on that date; with location or instructor it narrows options.

3. AFTER this tool returns: Present ONLY the slot(s) from the tool result message. Do not add or substitute any other slots.

4. If the tool listed MULTIPLE slots: do NOT call booking_step_authenticate until the caller clearly chooses one slot from that list. If only ONE slot was presented, caller confirmation ("yes", "proceed", etc.) is enough. agreedSlot must match the slot the caller chose (not a default). Do NOT ask for full name, email, or contact details—Step 2 is CRM system login only.

5. RE-CHECK: If the caller asks for other dates, locations, "earliest at [centre]", "show me Wimbledon", "check again", or any new criteria after a previous run, call this tool again with courseType and the updated preference fields—then present only the new result. Do not tell them you can only use the previous list or to use the website instead.`,
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
            description:
              'Preferred date or natural-language phrase (optional). Pass ISO dates (YYYY-MM-DD) or phrases such as "next week", "mid of this month", "Friday", "this Friday"—the backend resolves these in Europe/London before matching slots. Refinements after a prior availability result (e.g. "Friday instead") are resolved using conversation context when available.'
          },
          preferredTime: {
            type: 'string',
            description: 'Preferred time (optional, for slot matching/filtering)'
          },
          location: {
            type: 'string',
            description: 'Preferred location: one of the training centre names (Alperton, Croydon, Edgware, Eltham, Wimbledon, Dagenham, Hoddesdon). If the caller gave their area or town, use the nearest centre from this list and pass that name.'
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
      description: `Step 2: Log the system into the CRM (cookie-based browser login). This is NOT asking the caller for their name, email, or any contact details—it is a backend step. Call when the caller has agreed a specific slot from Step 1: if multiple slots were offered, they must have clearly chosen one before you call. Pass agreedSlot matching that choice.

CRITICAL: agreedSlot must match the slot the caller selected from the check_availability result (date, time, location). If multiple slots were listed, do not use a default—use the one they picked.`,
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
      description: `Step 5 (Existing workflow only): Search for existing client in Contacts tab. This happens BEFORE client verification. Use this ONLY for existing client workflow after navigate_contacts. DO NOT confuse this with booking_step_lookup_contact (Step 8) which happens later in the booking form. Your FIRST question must be to ask for their mobile number (UK format: 07 and 11 digits). Do NOT ask for "phone number and email" or offer both options; ask only for mobile number first. When the caller gives a phone number, pass it as customerMobile (11 digits, UK format, no spaces). Prefer customerMobile, customerEmail, or customerName — do not use a generic contactInfo field alone without courseType and workflowType. Only if the tool returns a retryPrompt (e.g. ask for email or full name) should you then ask for that and call again with customerEmail or customerName.`,
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
          contactInfo: {
            type: 'string',
            description: 'Optional alias: mobile or email the caller just gave (digits/spaces ok for phone). Prefer customerMobile or customerEmail when possible; server maps this automatically.'
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
      description: `Step 7 (Existing) / Step 5 (New): Select booking options. The tool name is exactly booking_step_select_booking_options. This step APPLIES the chosen options on the page (e.g. selects bike type).

CRITICAL WORKFLOW:
1. Call this tool first with ONLY courseType and workflowType to see what options are required on the page.
2. Ask the caller for those options (e.g. for ITM: "125cc automatic, 50cc automatic, 125cc manual").
3. Call this tool again with chosen options (bikeType, duration, etc.) as TOP-LEVEL parameters.
4. For Gear Conversion, duration is ALWAYS 2 hours by default - do NOT ask the caller about duration. ONLY ask for bike type.
5. DO NOT ask for contact details (Name, Email, Phone) yet. Only ask for options appearing on the "1. Price" page. Contact details (name, email, phone, postcode, etc.) may ONLY be collected after the contact details page is reached—i.e. after booking_step_fill_contact_details has been called and returned.`,

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
      description: `Step 8 (Existing workflow only): Lookup existing client contact in booking form iframe. This happens AFTER booking_step_select_booking_options and BEFORE booking_step_fill_contact_details. After this step, the next step is always step 9 (booking_step_fill_contact_details), then step 10 (process_payment). This is a silent step with periodic updates - do NOT ask questions. Use this ONLY for existing client workflow after booking_step_select_booking_options. DO NOT confuse this with booking_step_search_client (Step 5) which happens earlier in the Contacts tab before client verification.`,
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
            description: 'Customer mobile number from Step 4 (preferred for lookup; optional, can come from session)'
          },
          customerEmail: {
            type: 'string',
            description: 'Customer email address (optional fallback; can come from session)'
          },
          customerName: {
            type: 'string',
            description: 'Name fragment for lookup escalation (e.g. first 3 letters of first name + space + first 3 of surname; optional)'
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
      description: `Step 8 (Existing) / Step 7 (New): Fill contact details form.

CRITICAL WORKFLOW:
1. ONLY call this tool AFTER you have reached the contact details page (Step 8 for existing, Step 7 for new).
2. DO NOT ask for Name, Email, Phone, Postcode, or any contact detail until you have called this tool at least once. The first call returns missingFields—only then ask for those specific missing fields. For sensitive fields use double confirmation (ask → ask them to repeat without YOU reading their value aloud—no "confirm it is…"). For hearAboutUs, ridingExperience, marketingConsent, and dataSharing use SINGLE ask only (not sensitive)—no repeat-verify.
3. Collect each missing field once: do not re-ask for a field already confirmed. When you have a value for every missing field, call this tool ONCE with ALL required parameters. New workflow requires: hearAboutUs (exact CRM option), ridingExperience (exact CRM option), marketingConsent and dataSharing (booleans), plus postcode, houseNumber, licenceHeld, nationalInsurance, customerEmail, customerMobile, customerName as needed. For the UK photocard driving licence number use ONLY drivingLicenceFirstHalf and drivingLicenceSecondHalf—do not call with only a subset or the form will not be fully filled.
4. DRIVING LICENCE (photocard): The number on the card is exactly 16 characters (not the separate 2-digit issue number). Structure: 5 characters (surname, padded with 9 if needed), 6 digits (encoded date of birth), 2 initials (second may be 9), 3 security characters. Always collect in two steps: (1) first 8 characters—ask, ask the caller to repeat to verify, call with drivingLicenceFirstHalf only; (2) second 8 characters—ask, repeat to verify, call with drivingLicenceFirstHalf and drivingLicenceSecondHalf. If the tool returns requiresDrivingLicenceSecondHalf, collect the second half. Do NOT pass drivingLicenceNumber as a single 16-character string.
5. HEAR ABOUT / RIDING EXPERIENCE: Pass the exact option text from the CRM lists in the parameter descriptions. Do not proceed to payment until these and the GDPR yes/no fields are filled.
6. After the tool fills successfully, the flow proceeds to payment.
7. AUTO-FILLED ADDRESS: If the tool returns requiresAddressConfirmation, you may briefly mention minimal identifying parts of the auto-filled address (street or building name, optionally town/area) so the caller knows what to confirm. Do not read the postcode aloud or recite the full multi-line address. This exception applies only to that confirmation turn; all other GDPR no-echo rules still apply.`,

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
            description: 'Customer email address (valid format, e.g. name@domain.co.uk)'
          },
          customerMobile: {
            type: 'string',
            description: 'Customer mobile number (UK format: 11 digits starting with 07, e.g. 07123456789)'
          },
          customerName: {
            type: 'string',
            description: 'Customer full name'
          },
          postcode: {
            type: 'string',
            description: 'Customer postcode (UK format, e.g. SW1A 1AA or HA8 6AG; space before last 3 characters)'
          },
          houseNumber: {
            type: 'string',
            description: 'House number or name'
          },
          nationalInsurance: {
            type: 'string',
            description: 'National Insurance number (UK format: 2 letters, 6 digits, 1 letter, e.g. AB123456C; spaces optional when spoken)'
          },
          drivingLicenceNumber: {
            type: 'string',
            description: 'Deprecated: do not use. Collect the photocard number only via drivingLicenceFirstHalf then drivingLicenceSecondHalf (two calls). Passing a single 16-character value is rejected.'
          },
          drivingLicenceFirstHalf: {
            type: 'string',
            description: 'First 8 characters of the UK photocard licence number: surname (5 letters or 9-padding) plus first 3 digits of the 6-digit date block. Ask caller to repeat to verify before calling.'
          },
          drivingLicenceSecondHalf: {
            type: 'string',
            description: 'Second 8 characters: last 3 digits of the date block, then 2 initials (second may be 9), then 3 security characters. Pass together with drivingLicenceFirstHalf on the second call. Ask caller to repeat to verify.'
          },
          licenceHeld: {
            type: 'string',
            description: 'Type of licence held. Use the EXACT option text the caller chose from this list: Prov licence with valid cat A, Prov licence cat P only, European license with D9 counterpart, Foreign licence, No licence, Full UK car licence, Full UK automatic bike licence, Full UK manual bike licence, Full EU Motorcycle Licence. List these options when asking; pass their choice verbatim in the tool. When asking the caller to repeat for verification, do not quote or read the option label aloud (GDPR).'
          },
          addressConfirmed: {
            type: 'boolean',
            description: 'Whether the client has confirmed the auto-populated address. Set false on the first pass until they confirm; set true after they confirm. For new clients, after a full fill returned requiresAddressConfirmation, the next call may use only courseType, workflowType, and addressConfirmed: true—the server merges saved contact fields, fills survey/GDPR dropdowns, clicks Next, then you chain to booking_step_process_payment. Default: false'
          },
          correctedAddress: {
            type: 'string',
            description: 'Corrected address if the client said the auto-populated address was incorrect. Only provide this if client said "no" to the address confirmation.'
          },
          hearAboutUs: {
            type: 'string',
            description:
              'How did they hear about us? Pass EXACT CRM option text. Options only: Friends, Google, Bing, Yahoo, Motorcycle Shop, Recommendation, Other websites, RideTo, Deliveroo, UberEATS. Single ask—no repeat-verify.'
          },
          ridingExperience: {
            type: 'string',
            description:
              'Riding experience. Pass EXACT CRM option text. Options: None; None but can ride a push bike; Some but a while ago; Some recently; Some/medium experience; Had a previous CBT; Experienced Rider. Single ask—no repeat-verify.'
          },
          marketingConsent: {
            type: 'boolean',
            description:
              'Keep you updated — Are you OK for us to contact you about further courses? true = Yes, false = No. Single ask—no repeat-verify.'
          },
          dataSharing: {
            type: 'boolean',
            description:
              'Send details to others — OK to share contact details with DVSA, MCIA, HSM, TfL etc. for QA? true = Yes, false = No. Single ask—no repeat-verify.'
          }
        },
        required: ['courseType', 'workflowType']
      }
    },
    {
      type: 'function',
      name: 'booking_step_process_payment',
      description: `Step 9 (Existing) / Step 8 (New): Process payment and complete booking. Call FIRST with only courseType and workflowType (omit termsAccepted) to get terms from the system. If the result includes requiresTermsBeforeSend and termsText, read the terms to the caller and ask "Do you accept the terms and conditions?" When they say yes, call this tool again with the same courseType and workflowType plus termsAccepted: true. CRITICAL: Do NOT collect card details directly - the system handles payment automatically.`,
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
          paymentSource: {
            type: 'string',
            enum: ['balance', 'payment_request'],
            description: 'Optional payment source choice when available balance exists. Use "balance" to apply existing balance, or "payment_request" to continue with normal email/SMS payment link flow.'
          },
          useAvailableBalance: {
            type: 'boolean',
            description: 'Alias for paymentSource: true means use available balance, false means continue with payment request link.'
          },
          termsAccepted: {
            type: 'boolean',
            description: 'Whether client accepted terms and conditions. Omit on first call to receive termsText; after reading terms and caller says yes, call again with termsAccepted: true.'
          }
        },
        required: ['courseType', 'workflowType']
      }
    },
    {
      type: 'function',
      name: 'booking_step_send_payment_request',
      description: `Step 9 (Existing) / Step 8 (New): Send payment request via email or SMS. Use this AFTER selecting "Send a payment request" option in payment dropdown. IMPORTANT: This is the ONLY tool for sending the payment link—there is no separate "confirm" tool. When the tool returns requiresConfirmation, ask the caller to confirm the email/phone, then call THIS SAME TOOL again (booking_step_send_payment_request) with the same parameters plus confirmed: true to click "Send by email now" / "Send by SMS" and send the link. Do NOT call any tool named booking_step_confirm_payment_request; use only this tool with confirmed: true. The system will poll for payment completion and click "Make booking" automatically.`,
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
            description: 'Set to false (or omit) on first call; when the tool returns requiresConfirmation, ask the caller to confirm the email/phone, then call THIS SAME TOOL (booking_step_send_payment_request) again with the SAME parameters plus confirmed: true. Only confirmed: true will click "Send by email now" / "Send by SMS". There is no other tool for confirmation—use only booking_step_send_payment_request with confirmed: true. Default: false'
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
            description: 'Customer email address (optional; recipient is taken from booking context)'
          }
        },
        required: ['courseType', 'workflowType']
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
            description: 'Customer email address (optional; recipient is taken from booking context)'
          }
        },
        required: ['courseType', 'workflowType']
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
            description: 'Customer mobile number (11 digits, UK format). Use stored client mobile when available; if missing and form is empty, the tool will ask you to collect it from the caller and call again.'
          }
        },
        required: ['courseType', 'workflowType']
      }
    }
  ];
}

export function getToolDefinitions() {
  return [
    {
      type: 'function',
      name: 'web_search',
      description: 'Search the web for live or external information (e.g. weather, news, facts not in training or the company KB). Use when the query strictly requires the web. For Universal Motorcycle Training policies, courses, or procedures, prefer answering or file_search first; do not use this for routine company questions.',
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
      name: 'file_search',
      description: 'Search the company knowledge base (vector store) for policies, GDPR, courses, pricing, procedures, and internal information. Use when the caller needs informational answers likely found in company documents—not to execute booking or cancellation (use booking_step_* / cancellation_step_*). Prefer answering yourself when sufficient; use this when grounded retrieval is needed or the caller is not satisfied with a general answer.',
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
      name: 'set_call_language',
      description: `REQUIRED (1) right after the caller answers "what language would you like?" and (2) MID-CALL as soon as you detect the caller is using a different language than this call's current language—infer from audio/transcript; pass language_code. Before any verbal workflow tool in the same turn (e.g. booking_step_* that shapes what you say), call this FIRST so the session language updates before TTS. You may invoke in parallel ONLY with non-verbal automation (e.g. browser/Playwright steps that do not determine spoken language). Do not wait for "please switch language". Examples: Hindi→hi; English→en; French→fr. Function calling only—never print JSON. After success, continue in that language (or consent flow if initial).`,
      parameters: {
        type: 'object',
        properties: {
          language_code: {
            type: 'string',
            description:
              'ISO 639-1 code: en, hi, fr, de, es, it, pt, nl, pl, ur, ta, bn, pa, gu, mr, si, etc. Must match a language the service supports.'
          }
        },
        required: ['language_code']
      }
    },
    {
      type: 'function',
      name: 'recording_consent_response',
      description: `REQUIRED when the caller has given a clear yes or no to the recording consent question. You hear their answer in any language (e.g. yes, no, ओके यस, हाँ, नहीं, oui, non). Call this tool ONCE with given: true if they consented, given: false if they declined. Do NOT call it if the response was unclear (e.g. "what?", "repeat", "I'll answer later")—instead repeat the consent question. Do NOT say the main follow-up question until you have called this tool with the caller's clear answer.`,
      parameters: {
        type: 'object',
        properties: {
          given: {
            type: 'boolean',
            description: 'true = caller consented to recording; false = caller declined'
          }
        },
        required: ['given']
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
   - If verified, verification is complete; if the tool returns offerUpdatePhone: true, later in the call you may ask "Would you like to change the telephone number we have on file to a different one? If so, I can transfer you to an agent." Only ask if relevant (e.g. they later give a different number). If yes, offer transfer (use transfer_call)
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
      description: 'Submit a formal complaint record and send email notification. Use only when the caller explicitly asks to file, lodge, or report a formal complaint—not for general grumbling or step errors unless they clearly want a formal complaint logged.',
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
      description: `Step 5: Search for client using smart search with fallback (mobile → email → name). Includes client verification. Reuses booking search logic. ALWAYS pass courseType and workflowType "existing" on every call (same as prior cancellation steps). When the caller gives a phone or email, pass customerMobile or customerEmail, or contactInfo as a single string — server maps contactInfo to mobile/email. If email search fails, ask "Could you please tell me your full name?" and call again with customerName; name search uses first 3 letters of first name + space + first 3 of last name (or middle 3 if no match). WARNING: Never disclose any personal information from our clients found in the system to the caller (GDPR).`,
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
          contactInfo: {
            type: 'string',
            description: 'Optional alias: phone or email the caller just gave. Prefer customerMobile or customerEmail; server maps contactInfo automatically.'
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

