import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  LinearProgress,
  TextField,
  Switch,
  Tooltip
} from '@mui/material';
import {
  Refresh
} from '@mui/icons-material';
import { useToast } from '../common/ToastProvider';
import { formatDateTime } from '../../utils/formatters';
import mcpToolsService from '../../services/mcpToolsService';

const MCPToolsConfig = forwardRef(({ 
  showSystemControls = true, // Show MCP System Controls section
  readOnly = false // If true, disable all editing
}, ref) => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  
  const [editingDomains, setEditingDomains] = useState({});
  const [newDomainInputs, setNewDomainInputs] = useState({});
  const [rateLimitValues, setRateLimitValues] = useState({});

  // Fetch MCP tools
  const { data: fetchedMcpTools = [], isLoading: mcpLoading, refetch: refetchMcpTools } = useQuery({
    queryKey: ['mcp-tools'],
    queryFn: () => mcpToolsService.getAllTools()
  });

  // Filter out booking step tools (not relevant for MCP Tools section)
  const filteredMcpTools = React.useMemo(() => {
    const toolsArray = Array.isArray(fetchedMcpTools) 
      ? fetchedMcpTools 
      : (fetchedMcpTools.tools || fetchedMcpTools.data || []);
    
    // Filter out booking_step_* tools
    return toolsArray.filter(tool => !tool.name?.startsWith('booking_step_'));
  }, [fetchedMcpTools]);

  // Update local state when MCP tools are fetched
  useEffect(() => {
    if (filteredMcpTools && filteredMcpTools.length > 0) {
      const domainsState = {};
      const rateLimitState = {};
      filteredMcpTools.forEach(tool => {
        domainsState[tool.name] = [...(tool.domains || [])];
        rateLimitState[tool.name] = tool.rateLimit?.limit || 100;
      });
      setEditingDomains(domainsState);
      setRateLimitValues(rateLimitState);
    }
  }, [filteredMcpTools]);

  // MCP Tools Handlers
  const handleToggleTool = async (toolName, enabled) => {
    if (readOnly) return;
    try {
      if (enabled) {
        await mcpToolsService.enableTool(toolName);
      } else {
        await mcpToolsService.disableTool(toolName);
      }
      showSuccess(`Tool ${toolName} ${enabled ? 'enabled' : 'disabled'}`);
      queryClient.invalidateQueries(['mcp-tools']);
    } catch (error) {
      showError(`Failed to ${enabled ? 'enable' : 'disable'} tool ${toolName}`);
    }
  };

  const handleUpdateRateLimit = async (toolName, newLimit) => {
    if (readOnly) return;
    try {
      if (newLimit < 1 || newLimit > 1000) {
        showError('Rate limit must be between 1 and 1000');
        return;
      }
      await mcpToolsService.updateRateLimit(toolName, newLimit);
      showSuccess(`Rate limit updated for ${toolName}`);
      queryClient.invalidateQueries(['mcp-tools']);
    } catch (error) {
      showError(`Failed to update rate limit for ${toolName}`);
    }
  };

  const handleAddDomain = useCallback((toolName, domain) => {
    if (readOnly) return;
    if (!domain || domain.trim() === '') {
      showError('Domain cannot be empty');
      return;
    }
    
    // Basic domain validation
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain.trim())) {
      showError('Invalid domain format');
      return;
    }

    setEditingDomains(prev => {
      const currentDomains = prev[toolName] || [];
      if (currentDomains.includes(domain.trim())) {
        showError('Domain already exists');
        return prev;
      }
      const updatedDomains = [...currentDomains, domain.trim()];
      return { ...prev, [toolName]: updatedDomains };
    });
    setNewDomainInputs(prev => ({ ...prev, [toolName]: '' }));
  }, [showError, readOnly]);

  const handleRemoveDomain = useCallback((toolName, domainToRemove) => {
    if (readOnly) return;
    setEditingDomains(prev => {
      const currentDomains = prev[toolName] || [];
      const updatedDomains = currentDomains.filter(d => d !== domainToRemove);
      return { ...prev, [toolName]: updatedDomains };
    });
  }, [readOnly]);

  const handleSaveDomains = async (toolName) => {
    if (readOnly) return;
    try {
      const domains = editingDomains[toolName] || [];
      await mcpToolsService.updateDomainAllowlist(toolName, domains);
      showSuccess(`Domain allowlist updated for ${toolName}`);
      queryClient.invalidateQueries(['mcp-tools']);
    } catch (error) {
      showError(`Failed to update domain allowlist for ${toolName}`);
    }
  };

  // Expose saveAll method to parent component
  useImperativeHandle(ref, () => ({
    saveAll: async () => {
      if (readOnly) return { success: false, error: 'Read-only mode' };
      
      // Use filtered tools (excludes booking_step_* tools)
      const toolsArray = filteredMcpTools;
      
      const savePromises = [];
      const errors = [];

      // Save all pending domain changes
      for (const tool of toolsArray) {
        const toolDomains = editingDomains[tool.name] || [];
        const originalDomains = tool.domains || [];
        
        // Check if domains have changed
        const domainsChanged = toolDomains.length !== originalDomains.length || 
          toolDomains.some((domain, idx) => domain !== (originalDomains[idx] || ''));
        
        if (domainsChanged) {
          savePromises.push(
            mcpToolsService.updateDomainAllowlist(tool.name, toolDomains)
              .catch(error => {
                errors.push(`Failed to save domains for ${tool.name}: ${error.message}`);
              })
          );
        }

        // Save rate limit if changed
        const rateLimitValue = rateLimitValues[tool.name];
        const originalRateLimit = tool.rateLimit?.limit;
        
        if (rateLimitValue !== undefined && rateLimitValue !== originalRateLimit) {
          if (rateLimitValue >= 1 && rateLimitValue <= 1000) {
            savePromises.push(
              mcpToolsService.updateRateLimit(tool.name, rateLimitValue)
                .catch(error => {
                  errors.push(`Failed to save rate limit for ${tool.name}: ${error.message}`);
                })
            );
          }
        }
      }

      try {
        await Promise.all(savePromises);
        if (errors.length > 0) {
          showError(`Some changes failed to save: ${errors.join('; ')}`);
          return { success: false, errors };
        }
        queryClient.invalidateQueries(['mcp-tools']);
        return { success: true };
      } catch (error) {
        showError(`Failed to save all tool configurations: ${error.message}`);
        return { success: false, error: error.message };
      }
    }
  }));

  return (
    <Box>
      {/* MCP Tools Registry */}
      <Paper>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Available MCP Tools ({filteredMcpTools.length})
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Refresh />}
            onClick={() => refetchMcpTools()}
            disabled={mcpLoading}
          >
            Refresh
          </Button>
        </Box>
        {mcpLoading ? (
          <LinearProgress sx={{ mb: 2 }} />
        ) : (() => {
          // Use filtered tools (excludes booking_step_* tools)
          const toolsArray = filteredMcpTools;
          
          return toolsArray.length === 0 ? (
            <Alert severity="info" sx={{ m: 2 }}>
              No MCP tools found. Tools will be discovered on system startup.
            </Alert>
          ) : (
            <TableContainer>
              <Table sx={{ tableLayout: 'fixed' }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '15%' }}><strong>Tool</strong></TableCell>
                    <TableCell sx={{ width: '25%' }}><strong>Description</strong></TableCell>
                    <TableCell align="center" sx={{ width: '10%' }}><strong>Enabled</strong></TableCell>
                    <TableCell sx={{ width: '15%' }}><strong>Rate Limit</strong></TableCell>
                    <TableCell sx={{ width: '20%' }}><strong>Domain Allowlist</strong></TableCell>
                    <TableCell sx={{ width: '15%' }}><strong>Usage Stats</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {toolsArray.map((tool) => {
                  const toolDomains = editingDomains[tool.name] || tool.domains || [];
                  const newDomainInput = newDomainInputs[tool.name] || '';
                  const rateLimitValue = rateLimitValues[tool.name] ?? tool.rateLimit?.limit ?? 100;
                  
                  return (
                    <TableRow key={tool.name}>
                      <TableCell>
                        <Typography 
                          variant="body2" 
                          fontWeight="medium" 
                          fontFamily="monospace"
                          sx={{ 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap' 
                          }}
                        >
                          {tool.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={tool.description || 'No description available'}>
                          <Typography 
                            variant="body2" 
                            color="text.secondary" 
                            sx={{ 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap',
                              display: 'block'
                            }}
                          >
                            {tool.description || 'N/A'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        <Switch
                          checked={tool.enabled}
                          onChange={(e) => handleToggleTool(tool.name, e.target.checked)}
                          size="small"
                          disabled={readOnly}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TextField
                            type="number"
                            value={rateLimitValue}
                            onChange={(e) => {
                              const value = parseInt(e.target.value, 10);
                              if (!isNaN(value)) {
                                setRateLimitValues(prev => ({ ...prev, [tool.name]: value }));
                              }
                            }}
                            onBlur={(e) => {
                              const value = parseInt(e.target.value, 10);
                              if (!isNaN(value) && value !== tool.rateLimit?.limit) {
                                handleUpdateRateLimit(tool.name, value);
                              }
                            }}
                            inputProps={{
                              min: 1,
                              max: 1000,
                              style: { textAlign: 'center', width: '60px' }
                            }}
                            size="small"
                            sx={{ width: '80px' }}
                            disabled={readOnly}
                          />
                          <Typography variant="caption" color="text.secondary">
                            /min
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ width: '100%', overflow: 'hidden' }}>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1, maxHeight: '60px', overflowY: 'auto' }}>
                            {toolDomains.length > 0 ? (
                              toolDomains.map((domain, idx) => (
                                <Chip
                                  key={idx}
                                  label={domain}
                                  size="small"
                                  onDelete={readOnly ? undefined : () => handleRemoveDomain(tool.name, domain)}
                                  color="primary"
                                  variant="outlined"
                                  sx={{ maxWidth: '100%' }}
                                />
                              ))
                            ) : (
                              <Typography variant="caption" color="text.secondary" fontStyle="italic">
                                All domains allowed
                              </Typography>
                            )}
                          </Box>
                          {!readOnly && (
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              <TextField
                                placeholder="Add domain"
                                value={newDomainInput}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setNewDomainInputs(prev => {
                                    if (prev[tool.name] === value) return prev;
                                    return { ...prev, [tool.name]: value };
                                  });
                                }}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    handleAddDomain(tool.name, newDomainInput);
                                  }
                                }}
                                size="small"
                                sx={{ flex: 1, minWidth: '120px' }}
                              />
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleAddDomain(tool.name, newDomainInput)}
                                disabled={!newDomainInput.trim()}
                              >
                                Add
                              </Button>
                              {(() => {
                                const originalDomains = tool.domains || [];
                                const hasChanges = toolDomains.length !== originalDomains.length || 
                                  toolDomains.some((domain, idx) => domain !== (originalDomains[idx] || ''));
                                return hasChanges ? (
                                  <Button
                                    size="small"
                                    variant="contained"
                                    onClick={() => handleSaveDomains(tool.name)}
                                  >
                                    Save
                                  </Button>
                                ) : null;
                              })()}
                            </Box>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ width: '100%' }}>
                          <Typography 
                            variant="caption" 
                            display="block"
                            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            Used: {tool.usageCount || 0} times
                          </Typography>
                          <Typography 
                            variant="caption" 
                            display="block" 
                            color="text.secondary"
                            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {tool.lastUsed ? formatDateTime(tool.lastUsed) : 'Never'}
                          </Typography>
                          {tool.rateLimit && (
                            <Typography 
                              variant="caption" 
                              display="block" 
                              color="text.secondary" 
                              sx={{ mt: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              Current: {tool.rateLimit.current}/{tool.rateLimit.limit}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          );
        })()}
      </Paper>
    </Box>
  );
});

MCPToolsConfig.displayName = 'MCPToolsConfig';

export default MCPToolsConfig;

