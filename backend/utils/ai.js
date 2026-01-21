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
Policy: never guess or invent facts; if a fact is not grounded by File Search or a tool, use tools proactively to find accurate information, or ask a short clarifying question or explain the limitation and offer human transfer.
Privacy: verify identity before disclosing/altering personal data. Do not store or repeat sensitive numbers aloud unless required and permitted.
Language: greet in English and ask the caller's preferred language; switch seamlessly and keep using that language.
Turn-taking: stop speaking immediately if caller begins to speak. Keep answers short; ask permission before long explanations.
Safety: before irreversible actions (payments/bookings/cancellations), summarise, ask for explicit confirmation, then act and verify success.
Citations: when using File Search, mention document/source title verbally in simple terms ("our CBT policy, April 2025 update").

🚨 CRITICAL: PROACTIVE TOOL USAGE
Use tools automatically whenever they're needed to provide accurate answers, even if the caller doesn't explicitly ask you to use them:
- Policy/price/course questions → IMMEDIATELY use file_search (don't wait for caller to ask you to check)
- Availability questions → IMMEDIATELY use booking_step_check_availability
- Current/external information → IMMEDIATELY use web_search
- Complaints/dissatisfaction → IMMEDIATELY use complaint_submission
- Need to send confirmation/summary → IMMEDIATELY use email or send_sms
- Booking/reschedule/cancel requests → IMMEDIATELY use appropriate booking_step_* or crm_browser tools
- Identity verification needed → IMMEDIATELY use kba_verification or client_verification

DO NOT hesitate or ask "Would you like me to check?" - just use the appropriate tool immediately to provide accurate information.

Available tools:
- file_search(files: [...]) to retrieve authoritative passages from our knowledge base. Use proactively for policy/price/course questions.
- web_search(query, domains_allowlist, max_time_ms) for time-sensitive facts not in KB. Use proactively when needed.
- crm_browser(task, args) to perform bookings/changes. Use dry-run first; present the diff; only commit after explicit caller confirmation; verify success.
- booking_step_* tools for step-based booking workflows (preferred method).
- email and send_sms for sending confirmations, summaries, or links.
- complaint_submission for formal complaints.
- kba_verification and client_verification for identity verification.
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
      description: "Perform CRM tasks like bookings, changes, cancellations. For create_booking, courseType is required in args.",
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
            properties: {
              courseType: {
                type: "string",
                enum: [
                  "ITM", "Introduction to Motorcycling",
                  "CBT", "Compulsory Basic Training",
                  "CBT Executive", "CBT Executive 1-2-1",
                  "Private Lesson",
                  "Gear Conversion",
                  "TfL 1-2-1", "TfL 1-2-1 Motorcycle Skills",
                  "TfL Beyond CBT", "TfL - Beyond CBT - Skills for Delivery Riders",
                  "Full Licence Assessment", "Full Motorcycle Licence Assessment"
                ],
                description: "Required for create_booking: Type of course to book. Valid options: ITM/Introduction to Motorcycling, CBT/Compulsory Basic Training, CBT Executive/CBT Executive 1-2-1, Private Lesson, Gear Conversion, TfL 1-2-1/TfL 1-2-1 Motorcycle Skills, TfL Beyond CBT/TfL - Beyond CBT - Skills for Delivery Riders, Full Licence Assessment/Full Motorcycle Licence Assessment"
              },
              customerEmail: {
                type: "string",
                description: "Customer email address (required for bookings)"
              },
              customerPhone: {
                type: "string",
                description: "Customer phone number"
              },
              preferredDate: {
                type: "string",
                description: "Preferred booking date"
              },
              preferredTime: {
                type: "string",
                description: "Preferred booking time"
              },
              location: {
                type: "string",
                description: "Preferred training location"
              },
              bikeType: {
                type: "string",
                description: "Bike type preference (e.g., '125cc automatic', '50cc automatic', '125cc manual', '500cc restricted', '600cc')"
              },
              cbtType: {
                type: "string",
                enum: ["standard", "renewal"],
                description: "For CBT bookings: 'standard' for new riders or 'renewal' for experienced riders"
              },
              duration: {
                type: "string",
                enum: ["2", "3", "4"],
                description: "For Gear Conversion bookings: Training duration in hours ('2', '3', or '4')"
              }
            },
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
        // Import services
        const flowDetectionService = (await import('../services/flowDetectionService.js')).default;
        const flowParameterService = (await import('../services/flowParameterService.js')).default;
        const tokenManagementService = (await import('../services/tokenManagementService.js')).default;
        const messagePriorityService = (await import('../services/messagePriorityService.js')).default;
        const AIConfig = (await import('../models/AIConfig.js')).default;
        const ConversationContext = (await import('../models/ConversationContext.js')).default;

        // Get global AI config
        let globalConfig = await AIConfig.findOne({ isActive: true });
        if (!globalConfig) {
            // Fallback to defaults if no config exists
            globalConfig = {
                parameters: { temperature: 0.4, topP: 1.0, maxTokens: 150 },
                model: { id: 'gpt-4o', name: 'GPT-4o' }
            };
        }

        const modelId = globalConfig.model?.id || 'gpt-4o';

        // Detect flow type if not provided
        let flowType = callContext.flowType;
        if (!flowType) {
            const transcript = callContext.transcript || [];
            flowType = flowDetectionService.detectFlow(conversationText, transcript, callContext);
        }

        // Get effective parameters (flow-specific or global)
        const effectiveParams = await flowParameterService.getEffectiveParameters(flowType, globalConfig);

        // Build messages array - support both string and structured messages
        let messages = [];
        if (Array.isArray(conversationText)) {
            // If conversationText is already an array of messages, use it
            messages = conversationText;
        } else if (callContext.messages && Array.isArray(callContext.messages)) {
            // Use messages from call context if available
            messages = callContext.messages;
        } else {
            // Convert conversationText string to messages array
            messages = [
                {
                    role: "system",
                    content: ROBERT_SYSTEM_INSTRUCTIONS
                },
                {
                    role: "user",
                    content: conversationText
                }
            ];
        }

        // Ensure system message is first
        if (messages[0]?.role !== 'system') {
            messages.unshift({
                role: "system",
                content: ROBERT_SYSTEM_INSTRUCTIONS
            });
        }

        // Count tokens and check if truncation is needed
        const contextLimit = tokenManagementService.getContextLimit(modelId);
        const tokenCheck = tokenManagementService.shouldTruncate(messages, modelId, contextLimit);
        
        let optimizedMessages = messages;
        let tokenUsage = {
            before: tokenCheck.currentTokens,
            after: tokenCheck.currentTokens,
            optimized: false,
            warningLevel: tokenCheck.warningLevel
        };

        // Apply optimization if needed
        if (tokenCheck.shouldTruncate) {
            const optimizationResult = await tokenManagementService.optimizeContext(
                messages,
                modelId,
                contextLimit,
                {
                    summarizationEnabled: process.env.SUMMARIZATION_ENABLED !== 'false',
                    callContext
                }
            );

            optimizedMessages = optimizationResult.messages;
            tokenUsage = {
                before: optimizationResult.tokensBefore || tokenCheck.currentTokens,
                after: optimizationResult.tokenCount,
                optimized: optimizationResult.optimized,
                removedCount: optimizationResult.removedCount || 0,
                strategy: optimizationResult.strategy || 'none',
                warningLevel: optimizationResult.warningLevel || tokenCheck.warningLevel
            };

            // Log truncation event
            if (tokenUsage.optimized && callContext.callSid) {
                try {
                    let contextDoc = await ConversationContext.findOne({ callSid: callContext.callSid });
                    if (!contextDoc) {
                        contextDoc = new ConversationContext({
                            callSid: callContext.callSid,
                            modelId,
                            contextLimit,
                            currentTokens: tokenUsage.after,
                            messages: optimizedMessages
                        });
                    } else {
                        contextDoc.currentTokens = tokenUsage.after;
                        contextDoc.messages = optimizedMessages;
                    }

                    // Add truncation history entry
                    if (tokenUsage.removedCount > 0) {
                        contextDoc.truncationHistory.push({
                            tokensBefore: tokenUsage.before,
                            tokensAfter: tokenUsage.after,
                            messagesRemoved: tokenUsage.removedCount,
                            strategy: tokenUsage.strategy
                        });
                    }

                    await contextDoc.save();
                } catch (contextError) {
                    console.error('Error saving conversation context:', contextError);
                }
            }

            // Log warnings
            if (tokenUsage.warningLevel === 'warning') {
                console.warn(`Token usage warning (${tokenCheck.percentage.toFixed(1)}%) for call ${callContext.callSid || 'unknown'}`);
            } else if (tokenUsage.warningLevel === 'critical') {
                console.error(`Token usage critical (${tokenCheck.percentage.toFixed(1)}%) for call ${callContext.callSid || 'unknown'}`);
            } else if (tokenUsage.warningLevel === 'emergency') {
                console.error(`Token usage emergency (${tokenCheck.percentage.toFixed(1)}%) for call ${callContext.callSid || 'unknown'}`);
            }
        }

        const response = await openai.chat.completions.create({
            model: effectiveParams.model,
            messages: optimizedMessages,
            tools: tools || TOOLS,
            tool_choice: "auto",
            temperature: effectiveParams.temperature,
            top_p: effectiveParams.top_p,
            max_tokens: effectiveParams.max_tokens
        });

        // Track response tokens
        const responseMessage = response.choices[0].message;
        const responseTokens = response.usage?.total_tokens || 0;
        
        // Update conversation context with response
        if (callContext.callSid) {
            try {
                let contextDoc = await ConversationContext.findOne({ callSid: callContext.callSid });
                if (contextDoc) {
                    // Add assistant response to messages
                    const assistantMessage = {
                        role: 'assistant',
                        content: responseMessage.content || '',
                        timestamp: new Date(),
                        tokenCount: tokenManagementService.countMessageTokens(responseMessage, modelId)
                    };
                    
                    if (responseMessage.tool_calls) {
                        assistantMessage.toolCalls = responseMessage.tool_calls;
                    }

                    contextDoc.messages.push(assistantMessage);
                    contextDoc.currentTokens = tokenUsage.after + (response.usage?.prompt_tokens || 0);
                    await contextDoc.save();
                }
            } catch (contextError) {
                console.error('Error updating conversation context with response:', contextError);
            }
        }

        const message = response.choices[0].message;
        
        // Handle tool calls
        if (message.tool_calls && message.tool_calls.length > 0) {
            return {
                content: message.content,
                tool_calls: message.tool_calls,
                requires_tool_execution: true,
                flowType: flowType,
                tokenUsage: {
                    ...tokenUsage,
                    responseTokens: responseTokens,
                    totalTokens: tokenUsage.after + responseTokens
                }
            };
        }

        return {
            content: message.content || "Sorry, I didn't understand that.",
            requires_tool_execution: false,
            flowType: flowType,
            tokenUsage: {
                ...tokenUsage,
                responseTokens: responseTokens,
                totalTokens: tokenUsage.after + responseTokens
            }
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
    // Use API call instead of direct import (production-ready approach)
    const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:3002';
    
    // Log tool invocation
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔧 [CRM BROWSER TOOL] Executing at ${new Date().toISOString()}`);
    console.log(`📞 Call SID: ${callContext.callSid || 'unknown'}`);
    console.log(`📋 Task: ${args.task}`);
    console.log(`📋 Course Type: ${args.args?.courseType || 'not specified'}`);
    console.log(`📋 Customer Email: ${args.args?.customerEmail || 'not specified'}`);
    console.log(`${'='.repeat(80)}\n`);
    
    try {
        const axios = (await import('axios')).default;
        const response = await axios.post(
            `${AGENT_SERVICE_URL}/api/tools/browser/execute`,
            {
                task: args.task,
                args: args.args || {},
                callContext: callContext || {}
            },
            {
                timeout: 300000, // 5 minutes timeout for browser operations
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const result = response.data.result;
        
        return {
            success: result.success,
            result: result.result,
            dryRun: result.dryRun,
            requiresConfirmation: result.requiresConfirmation,
            courseType: args.args?.courseType || null
        };
    } catch (error) {
        console.error('❌ Error calling browser agent service:', error);
        return {
            success: false,
            result: `Failed to execute browser task: ${error.message}`,
            dryRun: false,
            requiresConfirmation: false,
            courseType: args.args?.courseType || null
        };
    }
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