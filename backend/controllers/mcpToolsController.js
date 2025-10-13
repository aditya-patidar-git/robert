import mcpToolsService from '../services/mcpToolsService.js';
// import observabilityService from '../services/observabilityService.js';

// Get all MCP tools
export const getAllTools = async (req, res) => {
    try {
        const tools = mcpToolsService.getAllTools();
        res.json({ success: true, tools });
    } catch (error) {
        observabilityService.error('Get all tools error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get tool status
export const getToolStatus = async (req, res) => {
    try {
        const { toolName } = req.params;
        const status = mcpToolsService.getToolStatus(toolName);
        
        if (!status) {
            return res.status(404).json({ success: false, error: 'Tool not found' });
        }
        
        res.json({ success: true, tool: status });
    } catch (error) {
        observabilityService.error('Get tool status error', { toolName: req.params.toolName, error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

// Execute tool
export const executeTool = async (req, res) => {
    try {
        const { toolName } = req.params;
        const { parameters, callContext } = req.body;
        
        observabilityService.info('MCP tool execution started', { toolName, parameters });
        
        const result = await mcpToolsService.executeTool(toolName, parameters, callContext);
        
        observabilityService.info('MCP tool execution completed', { toolName, success: result.success });
        
        res.json(result);
    } catch (error) {
        observabilityService.error('MCP tool execution error', { toolName: req.params.toolName, error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

// Enable tool
export const enableTool = async (req, res) => {
    try {
        const { toolName } = req.params;
        const success = mcpToolsService.enableTool(toolName);
        
        if (!success) {
            return res.status(404).json({ success: false, error: 'Tool not found' });
        }
        
        observabilityService.info('MCP tool enabled', { toolName });
        res.json({ success: true, message: `Tool ${toolName} enabled` });
    } catch (error) {
        observabilityService.error('Enable tool error', { toolName: req.params.toolName, error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

// Disable tool
export const disableTool = async (req, res) => {
    try {
        const { toolName } = req.params;
        const success = mcpToolsService.disableTool(toolName);
        
        if (!success) {
            return res.status(404).json({ success: false, error: 'Tool not found' });
        }
        
        observabilityService.info('MCP tool disabled', { toolName });
        res.json({ success: true, message: `Tool ${toolName} disabled` });
    } catch (error) {
        observabilityService.error('Disable tool error', { toolName: req.params.toolName, error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

// Update rate limit
export const updateRateLimit = async (req, res) => {
    try {
        const { toolName } = req.params;
        const { newLimit } = req.body;
        
        if (!newLimit || newLimit < 1) {
            return res.status(400).json({ success: false, error: 'Invalid rate limit' });
        }
        
        const success = mcpToolsService.updateRateLimit(toolName, newLimit);
        
        if (!success) {
            return res.status(404).json({ success: false, error: 'Tool not found' });
        }
        
        observabilityService.info('MCP tool rate limit updated', { toolName, newLimit });
        res.json({ success: true, message: `Rate limit updated for ${toolName}` });
    } catch (error) {
        observabilityService.error('Update rate limit error', { toolName: req.params.toolName, error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

// Update domain allowlist
export const updateDomainAllowlist = async (req, res) => {
    try {
        const { toolName } = req.params;
        const { domains } = req.body;
        
        if (!Array.isArray(domains)) {
            return res.status(400).json({ success: false, error: 'Domains must be an array' });
        }
        
        const success = mcpToolsService.updateDomainAllowlist(toolName, domains);
        
        if (!success) {
            return res.status(404).json({ success: false, error: 'Tool not found' });
        }
        
        observabilityService.info('MCP tool domain allowlist updated', { toolName, domains });
        res.json({ success: true, message: `Domain allowlist updated for ${toolName}` });
    } catch (error) {
        observabilityService.error('Update domain allowlist error', { toolName: req.params.toolName, error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get tool metrics
export const getToolMetrics = async (req, res) => {
    try {
        const { toolName } = req.params;
        const status = mcpToolsService.getToolStatus(toolName);
        
        if (!status) {
            return res.status(404).json({ success: false, error: 'Tool not found' });
        }
        
        const metrics = {
            toolName: status.name,
            enabled: status.enabled,
            usageCount: status.usageCount,
            lastUsed: status.lastUsed,
            rateLimit: status.rateLimit,
            health: status.enabled ? 'healthy' : 'disabled'
        };
        
        res.json({ success: true, metrics });
    } catch (error) {
        observabilityService.error('Get tool metrics error', { toolName: req.params.toolName, error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};
