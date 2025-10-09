import express from 'express';
import {
    getAllTools,
    getToolStatus,
    executeTool,
    enableTool,
    disableTool,
    updateRateLimit,
    updateDomainAllowlist,
    getToolMetrics
} from '../controllers/mcpToolsController.js';

const router = express.Router();

// Get all MCP tools
router.get('/', getAllTools);

// Get tool status
router.get('/:toolName/status', getToolStatus);

// Execute tool
router.post('/:toolName/execute', executeTool);

// Enable tool
router.post('/:toolName/enable', enableTool);

// Disable tool
router.post('/:toolName/disable', disableTool);

// Update rate limit
router.put('/:toolName/rate-limit', updateRateLimit);

// Update domain allowlist
router.put('/:toolName/domains', updateDomainAllowlist);

// Get tool metrics
router.get('/:toolName/metrics', getToolMetrics);

export default router;
