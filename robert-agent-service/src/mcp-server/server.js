import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import webSearchTool from './tools/webSearch.js';
import calendarTool from './tools/calendar.js';
import emailTool from './tools/email.js';
import crmTool from './tools/crm.js';
import paymentsTool from './tools/payments.js';
import { getConfigResource } from './resources/config.js';

class MCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'robert-voice-agent-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'web_search',
          description: 'Search the web for information',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              domains: { type: 'array', items: { type: 'string' } },
              maxResults: { type: 'number', default: 5 }
            },
            required: ['query']
          }
        },
        {
          name: 'calendar',
          description: 'Manage calendar events and availability',
          inputSchema: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['check_availability', 'book_slot'] },
              date: { type: 'string' },
              time: { type: 'string' },
              duration: { type: 'number' }
            },
            required: ['action']
          }
        },
        {
          name: 'email',
          description: 'Send and manage emails',
          inputSchema: {
            type: 'object',
            properties: {
              to: { type: 'string' },
              subject: { type: 'string' },
              body: { type: 'string' },
              template: { type: 'string' }
            },
            required: ['to', 'subject']
          }
        },
        {
          name: 'crm',
          description: 'Access CRM system for customer management',
          inputSchema: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['get_customer', 'update_customer', 'create_booking'] },
              customerId: { type: 'string' },
              data: { type: 'object' }
            },
            required: ['action']
          }
        },
        {
          name: 'payments',
          description: 'Process payments and refunds',
          inputSchema: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['process_payment', 'refund'] },
              amount: { type: 'number' },
              currency: { type: 'string', default: 'GBP' },
              customerId: { type: 'string' }
            },
            required: ['action', 'amount']
          }
        }
      ]
    }));

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        let result;
        switch (name) {
          case 'web_search':
            result = await webSearchTool.execute(args);
            break;
          case 'calendar':
            result = await calendarTool.execute(args);
            break;
          case 'email':
            result = await emailTool.execute(args);
            break;
          case 'crm':
            result = await crmTool.execute(args);
            break;
          case 'payments':
            result = await paymentsTool.execute(args);
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // List resources (configurations)
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'config://ai',
          name: 'AI Configuration',
          description: 'Current AI agent configuration (voice, temperature, etc.)',
          mimeType: 'application/json'
        },
        {
          uri: 'config://audio',
          name: 'Audio Configuration',
          description: 'Audio processing settings (VAD, noise suppression, etc.)',
          mimeType: 'application/json'
        },
        {
          uri: 'config://telephony',
          name: 'Telephony Configuration',
          description: 'Telephony settings (numbers, routing, etc.)',
          mimeType: 'application/json'
        }
      ]
    }));

    // Read resource (fetch latest config from DB)
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      const config = await getConfigResource(uri);
      
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(config, null, 2)
          }
        ]
      };
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP Server started and ready');
  }
}

const server = new MCPServer();
server.start().catch(console.error);

