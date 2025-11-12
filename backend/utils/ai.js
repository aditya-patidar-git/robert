import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Global system instructions for Robert
const ROBERT_SYSTEM_INSTRUCTIONS = `
You are "Robert", Universal Motorcycle Training's AI phone agent.

Objectives: greet, understand, help, and resolve tasks safely and efficiently.
Style: British English, warm, concise, professional. Adjust politeness and pacing to the caller.
Policy: never guess or invent facts; if a fact is not grounded by File Search or a tool, ask a short clarifying question or explain the limitation and offer human transfer.
Privacy: verify identity before disclosing/altering personal data. Do not store or repeat sensitive numbers aloud unless required and permitted.
Language: greet in English and ask the caller's preferred language; switch seamlessly and keep using that language.
Turn-taking: stop speaking immediately if caller begins to speak. Keep answers short; ask permission before long explanations.
Safety: before irreversible actions (payments/bookings/cancellations), summarise, ask for explicit confirmation, then act and verify success.
Citations: when using File Search, mention document/source title verbally in simple terms ("our CBT policy, April 2025 update").

You may call tools when needed:
- file_search(files: [...]) to retrieve authoritative passages from our knowledge base.
- web_search(query, domains_allowlist, max_time_ms) only for time-sensitive facts not in KB.
- crm_browser(task, args) to perform bookings/changes. Use dry-run first; present the diff; only commit after explicit caller confirmation; verify success.
- transfer_call(target) to escalate to a human when requested or when confidence is low.

If a tool fails, try once more with corrected parameters; otherwise apologise and offer alternatives.
`;

// Tool definitions for OpenAI
const TOOLS = [
  {
    type: "function",
    function: {
      name: "file_search",
      description: "Search the knowledge base for relevant information",
      parameters: {
        type: "object",
        properties: {
          files: {
            type: "array",
            items: { type: "string" },
            description: "Array of file IDs to search in"
          },
          query: {
            type: "string",
            description: "Search query"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for time-sensitive information not in knowledge base",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query"
          },
          domains_allowlist: {
            type: "array",
            items: { type: "string" },
            description: "Allowed domains for search"
          },
          max_time_ms: {
            type: "number",
            description: "Maximum time for search in milliseconds"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "crm_browser",
      description: "Perform CRM tasks like bookings, changes, cancellations",
      parameters: {
        type: "object",
        properties: {
          task: {
            type: "string",
            enum: ["create_booking", "reschedule_booking", "cancel_booking", "update_customer", "check_availability"],
            description: "Type of CRM task to perform"
          },
          args: {
            type: "object",
            description: "Task-specific arguments"
          }
        },
        required: ["task", "args"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "transfer_call",
      description: "Transfer call to human agent",
      parameters: {
        type: "object",
        properties: {
          target: {
            type: "string",
            description: "Target number or queue for transfer"
          },
          reason: {
            type: "string",
            description: "Reason for transfer"
          }
        },
        required: ["target"]
      }
    }
  }
];

export const getAIResponse = async (conversationText, tools = null, callContext = {}) => {
    try {
        // Import services for flow detection and parameter management
        const flowDetectionService = (await import('../services/flowDetectionService.js')).default;
        const flowParameterService = (await import('../services/flowParameterService.js')).default;
        const AIConfig = (await import('../models/AIConfig.js')).default;

        // Get global AI config
        let globalConfig = await AIConfig.findOne({ isActive: true });
        if (!globalConfig) {
            // Fallback to defaults if no config exists
            globalConfig = {
                parameters: { temperature: 0.4, topP: 1.0, maxTokens: 150 },
                model: { id: 'gpt-4o', name: 'GPT-4o' }
            };
        }

        // Detect flow type if not provided
        let flowType = callContext.flowType;
        if (!flowType) {
            const transcript = callContext.transcript || [];
            flowType = flowDetectionService.detectFlow(conversationText, transcript, callContext);
        }

        // Get effective parameters (flow-specific or global)
        const effectiveParams = await flowParameterService.getEffectiveParameters(flowType, globalConfig);

        const messages = [
            {
                role: "system",
                content: ROBERT_SYSTEM_INSTRUCTIONS
            },
            {
                role: "user",
                content: conversationText
            }
        ];

        const response = await openai.chat.completions.create({
            model: effectiveParams.model,
            messages: messages,
            tools: tools || TOOLS,
            tool_choice: "auto",
            temperature: effectiveParams.temperature,
            top_p: effectiveParams.top_p,
            max_tokens: effectiveParams.max_tokens
        });

        const message = response.choices[0].message;
        
        // Handle tool calls
        if (message.tool_calls && message.tool_calls.length > 0) {
            return {
                content: message.content,
                tool_calls: message.tool_calls,
                requires_tool_execution: true,
                flowType: flowType
            };
        }

        return {
            content: message.content || "Sorry, I didn't understand that.",
            requires_tool_execution: false,
            flowType: flowType
        };
    } catch (err) {
        console.error("AI error:", err.message);
        return {
            content: "Sorry, I couldn't understand that.",
            requires_tool_execution: false
        };
    }
};

// Tool execution functions
export const executeToolCall = async (toolCall, callContext = {}) => {
    const { name, arguments: args } = toolCall.function;
    
    try {
        switch (name) {
            case 'file_search':
                return await executeFileSearch(args, callContext);
            case 'web_search':
                return await executeWebSearch(args, callContext);
            case 'crm_browser':
                return await executeCRMBrowser(args, callContext);
            case 'transfer_call':
                return await executeTransferCall(args, callContext);
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error) {
        console.error(`Tool execution error for ${name}:`, error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Tool implementations
async function executeFileSearch(args, callContext) {
    // Import file search service
    const fileSearchService = (await import('../services/fileSearchService.js')).default;
    
    const results = await fileSearchService.searchFiles(args.query, {
        fileIds: args.files || null,
        maxResults: 5
    });
    
    return {
        success: true,
        results: results.results,
        citations: results.results.map(r => r.fileName)
    };
}

async function executeWebSearch(args, callContext) {
    // Import web search service
    const webSearchService = (await import('../services/webSearchService.js')).default;
    
    const results = await webSearchService.search(args.query, {
        domains: args.domains_allowlist || [],
        maxTime: args.max_time_ms || 5000
    });
    
    return {
        success: true,
        results: results.results,
        source: "web_search"
    };
}

async function executeCRMBrowser(args, callContext) {
    // Import browser agent service
    const browserAgentService = (await import('../services/browserAgentService.js')).default;
    
    const result = await browserAgentService.executeTask(args.task, args.args, callContext);
    
    return {
        success: result.success,
        result: result.result,
        dryRun: result.dryRun,
        requiresConfirmation: result.requiresConfirmation
    };
}

async function executeTransferCall(args, callContext) {
    // Import telephony service
    const telephonyService = (await import('../services/telephonyService.js')).default;
    
    const result = await telephonyService.transferCall(callContext.callSid, args.target, args.reason);
    
    return {
        success: result.success,
        transferInitiated: result.transferInitiated
    };
}