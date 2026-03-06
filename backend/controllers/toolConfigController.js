import ToolConfig from '../models/ToolConfig.js';
import axios from 'axios';
import observabilityService from '../services/observabilityService.js';
import configSyncService from '../services/configSyncService.js';

// Get agent service URL from environment
const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:3002';

/**
 * Get all tools with definitions from agent service and config from database
 */
export const getAllTools = async (req, res) => {
  try {
    console.log('🔍 [TOOLS] getAllTools endpoint called');
    
    // Fetch tool definitions from robert-agent-service
    let toolDefinitions = [];
    try {
      const response = await axios.get(`${AGENT_SERVICE_URL}/api/tools/definitions`, {
        timeout: 5000
      });
      if (response.data.success && response.data.tools) {
        toolDefinitions = response.data.tools;
        console.log(`✅ Fetched ${toolDefinitions.length} tool definitions from agent service`);
      } else {
        console.log(`⚠️ Agent service returned unexpected format:`, response.data);
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch tool definitions from agent service:', error.message);
      // Continue with database configs only
    }

    // Fetch tool configurations from database
    const toolConfigs = await ToolConfig.find({}).lean();
    console.log(`📊 Found ${toolConfigs.length} tool configs in database`);
    
    if (toolConfigs.length === 0) {
      console.warn('⚠️ No tool configs found in database!');
      return res.json({ success: true, tools: [], total: 0 });
    }
    
    // Create a map of tool configs by toolName
    const configMap = new Map();
    toolConfigs.forEach(config => {
      configMap.set(config.toolName, config);
    });

    // Start with empty array - will populate from definitions OR database
    const tools = [];

    // If we have definitions, merge them with configs
    if (toolDefinitions.length > 0) {
      toolDefinitions.forEach(def => {
        const config = configMap.get(def.name) || {
          toolName: def.name,
          enabled: true,
          rateLimit: { limit: 100, windowMs: 60000 },
          domains: [],
          maxTime: null,
          usageCount: 0,
          lastUsed: null
        };

        tools.push({
          name: def.name,
          description: def.description || config.description || '',
          enabled: config.enabled,
          usageCount: config.usageCount || 0,
          lastUsed: config.lastUsed,
          rateLimit: {
            current: 0,
            limit: config.rateLimit?.limit || 100,
            windowStart: Date.now()
          },
          domains: config.domains || [],
          maxTime: config.maxTime || null
        });
      });
      console.log(`🔧 After merging definitions: ${tools.length} tools`);
    } else {
      console.log('⚠️ No tool definitions from agent service, using database configs only');
    }

    // Add ALL database configs that don't have definitions (or all if no definitions)
    toolConfigs.forEach(config => {
      if (!tools.find(t => t.name === config.toolName)) {
        tools.push({
          name: config.toolName,
          description: config.description || '',
          enabled: config.enabled,
          usageCount: config.usageCount || 0,
          lastUsed: config.lastUsed,
          rateLimit: {
            current: 0,
            limit: config.rateLimit?.limit || 100,
            windowStart: Date.now()
          },
          domains: config.domains || [],
          maxTime: config.maxTime || null
        });
      }
    });

    // Filter out booking_step_* tools (not shown in MCP Tools UI)
    const filteredTools = tools.filter(t => !t.name?.startsWith('booking_step_'));
    const total = filteredTools.length;

    // Pagination when offset or limit query params are present
    const hasPagination = req.query.offset !== undefined || req.query.limit !== undefined;
    const offset = hasPagination ? Math.max(0, parseInt(req.query.offset, 10) || 0) : 0;
    const limit = hasPagination ? Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25)) : total;
    const paginatedTools = hasPagination ? filteredTools.slice(offset, offset + limit) : filteredTools;

    console.log(`✅ Returning ${paginatedTools.length} tools${hasPagination ? ` (offset=${offset}, limit=${limit}, total=${total})` : ''}`);
    res.json({ success: true, tools: paginatedTools, total });
  } catch (error) {
    console.error('❌ Error fetching tools:', error);
    console.error('❌ Error stack:', error.stack);
    observabilityService.error('Get all tools error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get specific tool status
 */
export const getToolStatus = async (req, res) => {
  try {
    const { toolName } = req.params;
    const config = await ToolConfig.findOne({ toolName });
    
    if (!config) {
      return res.status(404).json({ success: false, error: 'Tool not found' });
    }
    
    res.json({ 
      success: true, 
      tool: {
        name: config.toolName,
        enabled: config.enabled,
        usageCount: config.usageCount,
        lastUsed: config.lastUsed,
        rateLimit: {
          current: 0,
          limit: config.rateLimit?.limit || 100,
          windowStart: Date.now()
        }
      }
    });
  } catch (error) {
    observabilityService.error('Get tool status error', { toolName: req.params.toolName, error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Update tool configuration
 */
export const updateToolConfig = async (req, res) => {
  try {
    const { toolName } = req.params;
    const { enabled, rateLimit, domains, maxTime, description } = req.body;
    
    const updateData = {};
    if (enabled !== undefined) updateData.enabled = enabled;
    if (rateLimit !== undefined) updateData.rateLimit = rateLimit;
    if (domains !== undefined) updateData.domains = domains;
    if (maxTime !== undefined) updateData.maxTime = maxTime;
    if (description !== undefined) updateData.description = description;
    updateData.updatedBy = req.user?.id || req.user?.email || 'admin';

    const config = await ToolConfig.findOneAndUpdate(
      { toolName },
      updateData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    configSyncService.notifyConfigChange('tools', null, {
      changedBy: req.user?.id || req.user?.email || 'admin'
    });
    observabilityService.info('Tool config updated', { toolName, updates: updateData });
    res.json({ success: true, tool: config });
  } catch (error) {
    observabilityService.error('Update tool config error', { toolName: req.params.toolName, error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Enable a tool
 */
export const enableTool = async (req, res) => {
  try {
    const { toolName } = req.params;
    const config = await ToolConfig.findOneAndUpdate(
      { toolName },
      { enabled: true, updatedBy: req.user?.id || req.user?.email || 'admin' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    configSyncService.notifyConfigChange('tools', null, {
      changedBy: req.user?.id || req.user?.email || 'admin'
    });
    observabilityService.info('Tool enabled', { toolName });
    res.json({ success: true, message: `Tool ${toolName} enabled`, tool: config });
  } catch (error) {
    observabilityService.error('Enable tool error', { toolName: req.params.toolName, error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Disable a tool
 */
export const disableTool = async (req, res) => {
  try {
    const { toolName } = req.params;
    const config = await ToolConfig.findOneAndUpdate(
      { toolName },
      { enabled: false, updatedBy: req.user?.id || req.user?.email || 'admin' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    configSyncService.notifyConfigChange('tools', null, {
      changedBy: req.user?.id || req.user?.email || 'admin'
    });
    observabilityService.info('Tool disabled', { toolName });
    res.json({ success: true, message: `Tool ${toolName} disabled`, tool: config });
  } catch (error) {
    observabilityService.error('Disable tool error', { toolName: req.params.toolName, error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Update rate limit for a tool
 */
export const updateRateLimit = async (req, res) => {
  try {
    const { toolName } = req.params;
    const { newLimit } = req.body;
    
    if (!newLimit || newLimit < 1 || newLimit > 1000) {
      return res.status(400).json({ success: false, error: 'Rate limit must be between 1 and 1000' });
    }
    
    const config = await ToolConfig.findOneAndUpdate(
      { toolName },
      { 
        'rateLimit.limit': newLimit,
        updatedBy: req.user?.id || req.user?.email || 'admin'
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    configSyncService.notifyConfigChange('tools', null, {
      changedBy: req.user?.id || req.user?.email || 'admin'
    });
    observabilityService.info('Tool rate limit updated', { toolName, newLimit });
    res.json({ success: true, message: `Rate limit updated for ${toolName}`, tool: config });
  } catch (error) {
    observabilityService.error('Update rate limit error', { toolName: req.params.toolName, error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Update domain allowlist for a tool
 */
export const updateDomainAllowlist = async (req, res) => {
  try {
    const { toolName } = req.params;
    const { domains } = req.body;
    
    if (!Array.isArray(domains)) {
      return res.status(400).json({ success: false, error: 'Domains must be an array' });
    }
    
    const config = await ToolConfig.findOneAndUpdate(
      { toolName },
      { 
        domains: domains,
        updatedBy: req.user?.id || req.user?.email || 'admin'
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    configSyncService.notifyConfigChange('tools', null, {
      changedBy: req.user?.id || req.user?.email || 'admin'
    });
    observabilityService.info('Tool domain allowlist updated', { toolName, domains });
    res.json({ success: true, message: `Domain allowlist updated for ${toolName}`, tool: config });
  } catch (error) {
    observabilityService.error('Update domain allowlist error', { toolName: req.params.toolName, error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get tool metrics
 */
export const getToolMetrics = async (req, res) => {
  try {
    const { toolName } = req.params;
    const config = await ToolConfig.findOne({ toolName });
    
    if (!config) {
      return res.status(404).json({ success: false, error: 'Tool not found' });
    }
    
    const metrics = {
      toolName: config.toolName,
      enabled: config.enabled,
      usageCount: config.usageCount,
      lastUsed: config.lastUsed,
      rateLimit: {
        current: 0,
        limit: config.rateLimit?.limit || 100,
        windowStart: Date.now()
      },
      health: config.enabled ? 'healthy' : 'disabled'
    };
    
    res.json({ success: true, metrics });
  } catch (error) {
    observabilityService.error('Get tool metrics error', { toolName: req.params.toolName, error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Initialize default tool configs
 */
export const initializeDefaults = async (req, res) => {
  try {
    await ToolConfig.initializeDefaults();
    configSyncService.notifyConfigChange('tools', null, {
      changedBy: req.user?.id || req.user?.email || 'admin'
    });
    res.json({ success: true, message: 'Default tool configs initialized' });
  } catch (error) {
    observabilityService.error('Initialize tool configs error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

