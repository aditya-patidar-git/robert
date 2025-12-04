import webSearchTool from './webSearch.js';
import calendarTool from './calendar.js';
import emailTool from './email.js';
import crmTool from './crm.js';
import crmBrowserTool from './crmBrowserTool.js';
import paymentsTool from './payments.js';
import fileSearchTool from './fileSearch.js';
import transferCallTool from './transferCall.js';
import kbaVerificationTool from './kbaVerification.js';
import complaintSubmissionTool from './complaintSubmission.js';

/**
 * Tool Executor for OpenAI Realtime API
 * Manages tool registration, execution, and result formatting
 */
class ToolExecutor {
  constructor() {
    this.tools = new Map();
    this.defaultTimeout = 10000; // 10 seconds
    this.registerTools();
  }

  /**
   * Register all available tools
   */
  registerTools() {
    // Register tool implementations
    this.tools.set('web_search', webSearchTool);
    this.tools.set('calendar', calendarTool);
    this.tools.set('email', emailTool);
    this.tools.set('crm', crmTool);
    this.tools.set('crm_browser', crmBrowserTool);
    this.tools.set('payments', paymentsTool);
    this.tools.set('file_search', fileSearchTool);
    this.tools.set('transfer_call', transferCallTool);
    this.tools.set('kba_verification', kbaVerificationTool);
    this.tools.set('complaint_submission', complaintSubmissionTool);
    
    // Log registered tools
    console.log('📋 [TOOL EXECUTOR] Registered tools:', Array.from(this.tools.keys()).join(', '));
  }

  /**
   * Get tool definitions for OpenAI Realtime API session.update
   * @returns {Array} Array of tool definition objects
   */
  getToolDefinitions() {
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
        description: 'Perform CRM tasks using browser automation (bookings, changes, cancellations). For create_booking, courseType is required in args. This tool opens a browser and performs the actual CRM operations.',
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
                  enum: ['ITM', 'Introduction to Motorcycling', 'CBT', 'Compulsory Basic Training', 'CBT Executive', 'CBT Executive 1-2-1', 'Private Lesson', 'Gear Conversion'],
                  description: 'Required for create_booking: Type of course to book'
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
                bookingId: {
                  type: 'string',
                  description: 'Booking ID for reschedule or cancellation tasks'
                },
                newDate: {
                  type: 'string',
                  description: 'New date for rescheduling'
                },
                reason: {
                  type: 'string',
                  description: 'Reason for cancellation'
                },
                customerId: {
                  type: 'string',
                  description: 'Customer ID for updating customer records'
                },
                email: {
                  type: 'string',
                  description: 'Email for customer updates'
                },
                phone: {
                  type: 'string',
                  description: 'Phone for customer updates'
                },
                address: {
                  type: 'string',
                  description: 'Address for customer updates'
                },
                date: {
                  type: 'string',
                  description: 'Date for availability check'
                },
                time: {
                  type: 'string',
                  description: 'Time for availability check'
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
      }
    ];
  }

  /**
   * Execute a tool asynchronously with timeout protection
   * @param {string} toolName - Name of the tool to execute
   * @param {object} parameters - Tool parameters
   * @param {object} callContext - Call context (callSid, phoneNumber, etc.)
   * @param {number} timeout - Execution timeout in ms (optional)
   * @returns {Promise<object>} Tool execution result
   */
  async execute(toolName, parameters, callContext = {}, timeout = this.defaultTimeout) {
    const startTime = Date.now();
    const callSid = callContext.callSid || 'unknown';
    const phoneNumber = callContext.phoneNumber || 'unknown';
    
    if (!this.tools.has(toolName)) {
      console.error(`❌ [${callSid}] Tool not found: ${toolName}`);
      throw new Error(`Unknown tool: ${toolName}`);
    }

    // Increase timeout for browser automation tools - they need more time
    if (toolName === 'crm_browser') {
      timeout = 360000; // 360 seconds (6 minutes) for browser operations (launch, navigate, login, booking workflow, etc.) - extended for development
      console.log(`⏱️ [${callSid}] Extended timeout for ${toolName} to ${timeout}ms`);
    }

    const tool = this.tools.get(toolName);
    console.log(`🔧 [${callSid}] [TOOL EXECUTOR] Executing tool: ${toolName}`);
    console.log(`🔧 [${callSid}] [TOOL EXECUTOR] Parameters:`, JSON.stringify(parameters, null, 2));
    console.log(`🔧 [${callSid}] [TOOL EXECUTOR] Timeout: ${timeout}ms`);
    console.log(`🔧 [${callSid}] [TOOL EXECUTOR] Call Context:`, { callSid, phoneNumber });

    try {
      // Execute with timeout
      const executionPromise = tool.execute(parameters, callContext);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Tool execution timeout: ${toolName} (exceeded ${timeout}ms)`)), timeout);
      });

      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      const executionTime = Date.now() - startTime;
      console.log(`✅ [${callSid}] [TOOL EXECUTOR] Tool ${toolName} completed successfully`);
      console.log(`✅ [${callSid}] [TOOL EXECUTOR] Execution time: ${executionTime}ms`);
      console.log(`✅ [${callSid}] [TOOL EXECUTOR] Result preview:`, JSON.stringify(result, null, 2).substring(0, 300));

      return {
        success: true,
        result: result,
        executionTime: executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ [${callSid}] [TOOL EXECUTOR] Tool ${toolName} failed`);
      console.error(`❌ [${callSid}] [TOOL EXECUTOR] Execution time before failure: ${executionTime}ms`);
      console.error(`❌ [${callSid}] [TOOL EXECUTOR] Error:`, error.message || error);

      return {
        success: false,
        error: error.message || 'Tool execution failed',
        executionTime: executionTime
      };
    }
  }

  /**
   * Check if a tool is available
   * @param {string} toolName - Name of the tool
   * @returns {boolean} True if tool exists
   */
  hasTool(toolName) {
    return this.tools.has(toolName);
  }

  /**
   * Get list of available tool names
   * @returns {Array<string>} Array of tool names
   */
  getAvailableTools() {
    return Array.from(this.tools.keys());
  }
}

// Export singleton instance
export default new ToolExecutor();

