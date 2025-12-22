import ConversationContext from "../models/ConversationContext.js";
import tokenManagementService from "../services/tokenManagementService.js";
import modelDiscoveryService from "../services/modelDiscoveryService.js";
import CallRecord from "../models/CallRecord.js";

// Get token usage for a specific call
export const getTokenUsage = async (req, res) => {
  try {
    const { callSid } = req.params;
    
    const context = await ConversationContext.findOne({ callSid });
    if (!context) {
      return res.status(404).json({
        status: "error",
        message: "Conversation context not found for this call"
      });
    }

    const callRecord = await CallRecord.findOne({ callSid });
    
    res.json({
      status: "success",
      tokenUsage: {
        callSid: context.callSid,
        modelId: context.modelId,
        contextLimit: context.contextLimit,
        currentTokens: context.currentTokens,
        percentage: (context.currentTokens / context.contextLimit) * 100,
        warningLevel: tokenManagementService.getWarningLevel(context.currentTokens, context.contextLimit),
        truncationCount: context.truncationHistory?.length || 0,
        truncationHistory: context.truncationHistory || [],
        messageCount: context.messages?.length || 0,
        callRecordMetrics: callRecord?.metrics || null
      }
    });
  } catch (error) {
    console.error("Error getting token usage:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get aggregate token usage statistics
export const getTokenStats = async (req, res) => {
  try {
    const { startDate, endDate, modelId } = req.query;
    
    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (modelId) {
      query.modelId = modelId;
    }

    const contexts = await ConversationContext.find(query);
    
    // Build query for CallRecords with date filters
    const callRecordQuery = {};
    if (startDate || endDate) {
      callRecordQuery.createdAt = {};
      if (startDate) callRecordQuery.createdAt.$gte = new Date(startDate);
      if (endDate) callRecordQuery.createdAt.$lte = new Date(endDate);
    }
    
    // Get call records that have token metrics
    const callRecords = await CallRecord.find({
      ...callRecordQuery,
      $or: [
        { 'metrics.totalTokens': { $exists: true, $gt: 0 } },
        { 'metrics.maxTokensUsed': { $exists: true, $gt: 0 } }
      ]
    }).limit(1000);

    // Calculate statistics from ConversationContext
    const contextCalls = contexts.length;
    const contextTotalTokens = contexts.reduce((sum, ctx) => sum + (ctx.currentTokens || 0), 0);
    const contextTruncations = contexts.reduce((sum, ctx) => sum + (ctx.truncationHistory?.length || 0), 0);
    const contextCallsWithTruncation = contexts.filter(ctx => (ctx.truncationHistory?.length || 0) > 0).length;
    const contextMaxTokens = contexts.length > 0 ? Math.max(...contexts.map(ctx => ctx.currentTokens || 0), 0) : 0;
    
    // Calculate statistics from CallRecord metrics
    const callRecordCalls = callRecords.length;
    const callRecordTotalTokens = callRecords.reduce((sum, rec) => sum + (rec.metrics?.totalTokens || 0), 0);
    const callRecordMaxTokens = callRecords.length > 0 ? Math.max(...callRecords.map(rec => rec.metrics?.maxTokensUsed || 0), 0) : 0;
    const callRecordTruncations = callRecords.reduce((sum, rec) => sum + (rec.metrics?.truncationCount || 0), 0);
    const callRecordCallsWithTruncation = callRecords.filter(rec => (rec.metrics?.truncationCount || 0) > 0).length;
    
    // Merge statistics: combine data from both sources
    // For calls that exist in both, prefer ConversationContext (more accurate)
    // For calls that only exist in CallRecord, use CallRecord data
    const totalCalls = Math.max(contextCalls, callRecordCalls);
    const totalTokens = callRecordTotalTokens + contextTotalTokens;
    const maxTokens = Math.max(contextMaxTokens, callRecordMaxTokens);
    const totalTruncations = callRecordTruncations + contextTruncations;
    const callsWithTruncation = callRecordCallsWithTruncation + contextCallsWithTruncation;
    
    const avgTokensPerCall = totalCalls > 0 ? Math.round(totalTokens / totalCalls) : 0;
    const truncationRate = totalCalls > 0 ? (callsWithTruncation / totalCalls) * 100 : 0;

    res.json({
      status: "success",
      stats: {
        totalCalls,
        totalTokens,
        avgTokensPerCall,
        maxTokens,
        totalTruncations,
        callsWithTruncation,
        truncationRate
      }
    });
  } catch (error) {
    console.error("Error getting token stats:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message
    });
  }
};

// Manually trigger context optimization for a call
export const optimizeContext = async (req, res) => {
  try {
    const { callSid } = req.params;
    
    const context = await ConversationContext.findOne({ callSid });
    if (!context) {
      return res.status(404).json({
        status: "error",
        message: "Conversation context not found for this call"
      });
    }

    // Optimize context
    const optimizationResult = await tokenManagementService.optimizeContext(
      context.messages,
      context.modelId,
      context.contextLimit,
      {
        summarizationEnabled: process.env.SUMMARIZATION_ENABLED !== 'false'
      }
    );

    // Update context
    context.messages = optimizationResult.messages;
    context.currentTokens = optimizationResult.tokenCount;
    
    if (optimizationResult.optimized && optimizationResult.removedCount > 0) {
      context.truncationHistory.push({
        tokensBefore: optimizationResult.tokensBefore,
        tokensAfter: optimizationResult.tokenCount,
        messagesRemoved: optimizationResult.removedCount,
        strategy: optimizationResult.strategy
      });
    }
    
    await context.save();

    res.json({
      status: "success",
      message: "Context optimized successfully",
      optimization: {
        optimized: optimizationResult.optimized,
        tokensBefore: optimizationResult.tokensBefore,
        tokensAfter: optimizationResult.tokenCount,
        removedCount: optimizationResult.removedCount,
        strategy: optimizationResult.strategy,
        warningLevel: optimizationResult.warningLevel
      }
    });
  } catch (error) {
    console.error("Error optimizing context:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get context limit for a model
export const getContextLimit = async (req, res) => {
  try {
    const { modelId } = req.params;
    
    const limit = tokenManagementService.getContextLimit(modelId);
    
    res.json({
      status: "success",
      modelId,
      contextLimit: limit,
      warningThreshold: Math.floor(limit * 0.8),
      criticalThreshold: Math.floor(limit * 0.9),
      emergencyThreshold: Math.floor(limit * 0.95)
    });
  } catch (error) {
    console.error("Error getting context limit:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message
    });
  }
};

