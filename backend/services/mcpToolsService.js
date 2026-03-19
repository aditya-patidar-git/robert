class MCPToolsService {
  constructor() {
    this.tools = new Map();
    this.rateLimits = new Map();
    this.domainAllowlists = new Map();
    this.initializeTools();
  }

  initializeTools() {
    // Web Search Tool
    this.registerTool('web_search', {
      name: 'web_search',
      description: 'Search the web for information',
      rateLimit: 100, // requests per minute
      domains: ['universalmct.co.uk', 'dvsa.gov.uk', 'gov.uk'],
      maxTime: 5000
    });

    // Calendar Tool
    this.registerTool('calendar', {
      name: 'calendar',
      description: 'Manage calendar events and availability',
      rateLimit: 50,
      domains: [],
      maxTime: 3000
    });

    // Email Tool
    this.registerTool('email', {
      name: 'email',
      description: 'Send and manage emails',
      rateLimit: 30,
      domains: [],
      maxTime: 10000
    });

    // CRM Tool
    this.registerTool('crm', {
      name: 'crm',
      description: 'Access CRM system for customer management',
      rateLimit: 20,
      domains: ['takeabyte.co.uk'],
      maxTime: 15000
    });

  }

  registerTool(toolName, config) {
    this.tools.set(toolName, {
      ...config,
      enabled: true,
      lastUsed: null,
      usageCount: 0
    });
    
    this.rateLimits.set(toolName, {
      requests: 0,
      windowStart: Date.now(),
      limit: config.rateLimit
    });
    
    this.domainAllowlists.set(toolName, config.domains || []);
  }

  async executeTool(toolName, parameters, callContext = {}) {
    try {
      // Check if tool exists and is enabled
      if (!this.tools.has(toolName)) {
        throw new Error(`Tool ${toolName} not found`);
      }

      const tool = this.tools.get(toolName);
      if (!tool.enabled) {
        throw new Error(`Tool ${toolName} is disabled`);
      }

      // Check rate limit
      if (!this.checkRateLimit(toolName)) {
        throw new Error(`Rate limit exceeded for tool ${toolName}`);
      }

      // Check domain allowlist if applicable
      if (parameters.url && !this.checkDomainAllowlist(toolName, parameters.url)) {
        throw new Error(`Domain not allowed for tool ${toolName}`);
      }

      console.log(`🔧 Executing MCP tool: ${toolName}`);

      // Execute the specific tool
      let result;
      switch (toolName) {
        case 'web_search':
          result = await this.executeWebSearch(parameters, callContext);
          break;
        case 'calendar':
          result = await this.executeCalendar(parameters, callContext);
          break;
        case 'email':
          result = await this.executeEmail(parameters, callContext);
          break;
        case 'crm':
          result = await this.executeCRM(parameters, callContext);
          break;
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

      // Update usage statistics
      this.updateUsage(toolName);

      return {
        success: true,
        tool: toolName,
        result: result,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`MCP tool ${toolName} error:`, error);
      return {
        success: false,
        tool: toolName,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async executeWebSearch(parameters, callContext) {
    const { query, domains, maxTime } = parameters;
    
    // Import web search service
    const webSearchService = (await import('./webSearchService.js')).default;
    
    const results = await webSearchService.search(query, {
      domains: domains || [],
      maxTime: maxTime || 5000,
      maxResults: 5
    });

    return {
      query: query,
      results: results.results,
      totalResults: results.totalResults,
      source: 'web_search'
    };
  }

  async executeCalendar(parameters, callContext) {
    const { action, date, time, duration } = parameters;
    
    // Mock calendar implementation
    const calendarEvents = [
      {
        id: 'evt_001',
        title: 'CBT Session',
        date: '2025-01-15',
        time: '10:00',
        duration: 60,
        instructor: 'John Smith',
        status: 'available'
      },
      {
        id: 'evt_002',
        title: 'Theory Test',
        date: '2025-01-16',
        time: '14:00',
        duration: 45,
        instructor: 'Jane Doe',
        status: 'available'
      }
    ];

    switch (action) {
      case 'check_availability':
        return {
          availableSlots: calendarEvents.filter(evt => evt.status === 'available'),
          date: date,
          time: time
        };
      case 'book_slot':
        return {
          success: true,
          bookingId: 'book_' + Date.now(),
          event: calendarEvents[0]
        };
      default:
        throw new Error(`Unknown calendar action: ${action}`);
    }
  }

  async executeEmail(parameters, callContext) {
    try {
      const { to, subject, body, template, templateData = {} } = parameters;
      
      // Import email service
      const emailService = (await import('./emailService.js')).default;

      // Validate recipient
      if (!to) {
        return {
          success: false,
          error: 'Recipient email address (to) is required'
        };
      }

      if (!emailService.validateEmailAddress(to)) {
        return {
          success: false,
          error: `Invalid email address: ${to}`
        };
      }

      // Simple template definitions (can be enhanced with full templates later)
      const emailTemplates = {
        'booking_confirmation': {
          subject: `Booking Confirmation - Universal Motorcycle Training${templateData.bookingReference ? ` - ${templateData.bookingReference}` : ''}`,
          body: templateData.customerName 
            ? `Dear ${templateData.customerName},\n\nYour booking has been confirmed with Universal Motorcycle Training.\n\n`
            : 'Your booking has been confirmed with Universal Motorcycle Training.\n\n' +
              (templateData.bookingReference ? `Booking Reference: ${templateData.bookingReference}\n` : '') +
              (templateData.date ? `Date: ${templateData.date}\n` : '') +
              (templateData.time ? `Time: ${templateData.time}\n` : '') +
              (templateData.centre ? `Centre: ${templateData.centre}\n` : '') +
              '\nPlease arrive 15 minutes before your scheduled time.\n\n' +
              'If you need to make any changes to your booking, please contact us as soon as possible.\n\n' +
              'Best regards,\nUniversal Motorcycle Training'
        },
        'booking_reminder': {
          subject: 'Reminder: Your Booking Tomorrow - Universal Motorcycle Training',
          body: templateData.customerName
            ? `Dear ${templateData.customerName},\n\nThis is a reminder about your upcoming booking with Universal Motorcycle Training.\n\n`
            : 'This is a reminder about your upcoming booking with Universal Motorcycle Training.\n\n' +
              (templateData.bookingReference ? `Booking Reference: ${templateData.bookingReference}\n` : '') +
              (templateData.date ? `Date: ${templateData.date}\n` : '') +
              (templateData.time ? `Time: ${templateData.time}\n` : '') +
              (templateData.centre ? `Centre: ${templateData.centre}\n` : '') +
              '\nPlease remember to arrive 15 minutes before your scheduled time.\n\n' +
              'Best regards,\nUniversal Motorcycle Training'
        },
        'cancellation': {
          subject: `Booking Cancelled - Universal Motorcycle Training${templateData.bookingReference ? ` - ${templateData.bookingReference}` : ''}`,
          body: templateData.customerName
            ? `Dear ${templateData.customerName},\n\nYour booking has been cancelled as requested.\n\n`
            : 'Your booking has been cancelled as requested.\n\n' +
              (templateData.bookingReference ? `Booking Reference: ${templateData.bookingReference}\n` : '') +
              (templateData.date ? `Original Date: ${templateData.date}\n` : '') +
              (templateData.refundInfo ? `\nRefund Information:\n${templateData.refundInfo}\n` : '') +
              '\nIf you have any questions or would like to make a new booking, please contact us.\n\n' +
              'Best regards,\nUniversal Motorcycle Training'
        }
      };

      let finalSubject = subject;
      let finalBody = body;

      // If template is provided, use it
      if (template) {
        const templateDef = emailTemplates[template];
        
        if (!templateDef) {
          return {
            success: false,
            error: `Template "${template}" not found. Available templates: booking_confirmation, booking_reminder, cancellation`
          };
        }

        finalSubject = templateDef.subject;
        finalBody = templateDef.body;
      } else {
        // Use provided subject and body
        if (!subject || !body) {
          return {
            success: false,
            error: 'Either template or both subject and body are required'
          };
        }
      }

      // Send email via SMTP
      const result = await emailService.sendEmail({
        to,
        subject: finalSubject,
        text: finalBody
      });

      if (result.success) {
        console.log(`✅ MCP email sent: ${result.messageId || 'logged'}`);
        return {
          success: true,
          messageId: result.messageId,
          to,
          subject: finalSubject,
          body: finalBody,
          sentAt: new Date().toISOString(),
          logged: result.logged || false
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to send email'
        };
      }
    } catch (error) {
      console.error('❌ Error in MCP email tool:', error);
      return {
        success: false,
        error: error.message || 'Unknown error sending email'
      };
    }
  }

  async executeCRM(parameters, callContext) {
    const { action, customerId, data } = parameters;
    
    // Mock CRM implementation
    const customerData = {
      id: customerId,
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+44123456789',
      bookings: [
        {
          id: 'book_001',
          date: '2025-01-15',
          course: 'CBT',
          status: 'confirmed'
        }
      ]
    };

    switch (action) {
      case 'get_customer':
        return {
          customer: customerData
        };
      case 'update_customer':
        return {
          success: true,
          customer: { ...customerData, ...data },
          updatedAt: new Date().toISOString()
        };
      case 'create_booking':
        return {
          success: true,
          bookingId: 'book_' + Date.now(),
          customer: customerData
        };
      default:
        throw new Error(`Unknown CRM action: ${action}`);
    }
  }

  checkRateLimit(toolName) {
    const rateLimit = this.rateLimits.get(toolName);
    const now = Date.now();
    
    // Reset window if more than a minute has passed
    if (now - rateLimit.windowStart > 60000) {
      rateLimit.requests = 0;
      rateLimit.windowStart = now;
    }
    
    // Check if under limit
    if (rateLimit.requests >= rateLimit.limit) {
      return false;
    }
    
    rateLimit.requests++;
    return true;
  }

  checkDomainAllowlist(toolName, url) {
    const allowlist = this.domainAllowlists.get(toolName);
    if (allowlist.length === 0) return true; // No restrictions
    
    try {
      const domain = new URL(url).hostname;
      return allowlist.some(allowedDomain => 
        domain === allowedDomain || domain.endsWith('.' + allowedDomain)
      );
    } catch (error) {
      return false;
    }
  }

  updateUsage(toolName) {
    const tool = this.tools.get(toolName);
    tool.usageCount++;
    tool.lastUsed = new Date().toISOString();
  }

  getToolStatus(toolName) {
    const tool = this.tools.get(toolName);
    if (!tool) return null;
    
    const rateLimit = this.rateLimits.get(toolName);
    
    return {
      name: tool.name,
      enabled: tool.enabled,
      usageCount: tool.usageCount,
      lastUsed: tool.lastUsed,
      rateLimit: {
        current: rateLimit.requests,
        limit: rateLimit.limit,
        windowStart: rateLimit.windowStart
      }
    };
  }

  getAllTools() {
    return Array.from(this.tools.keys()).map(toolName => {
      const tool = this.tools.get(toolName);
      const rateLimit = this.rateLimits.get(toolName);
      const domains = this.domainAllowlists.get(toolName) || [];
      
      return {
        name: tool.name,
        description: tool.description || '',
        enabled: tool.enabled,
        usageCount: tool.usageCount,
        lastUsed: tool.lastUsed,
        rateLimit: {
          current: rateLimit.requests,
          limit: rateLimit.limit,
          windowStart: rateLimit.windowStart
        },
        domains: domains,
        maxTime: tool.maxTime || null
      };
    });
  }

  enableTool(toolName) {
    if (this.tools.has(toolName)) {
      this.tools.get(toolName).enabled = true;
      return true;
    }
    return false;
  }

  disableTool(toolName) {
    if (this.tools.has(toolName)) {
      this.tools.get(toolName).enabled = false;
      return true;
    }
    return false;
  }

  updateRateLimit(toolName, newLimit) {
    if (this.tools.has(toolName)) {
      this.rateLimits.get(toolName).limit = newLimit;
      return true;
    }
    return false;
  }

  updateDomainAllowlist(toolName, domains) {
    if (this.tools.has(toolName)) {
      this.domainAllowlists.set(toolName, domains);
      return true;
    }
    return false;
  }
}

export default new MCPToolsService();
