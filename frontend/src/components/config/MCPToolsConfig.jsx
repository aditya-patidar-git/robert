import React, { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { isHiddenFromMcpSystemToolsList } from './mcpToolsVisibility';

const PAGE_SIZE = 25;

const MCPToolsConfig = forwardRef(
  ({
    showSystemControls = true, // Show MCP System Controls section
    readOnly = false, // If true, disable all editing
    excludeBookingCancellationTools = false
  },
  ref) => {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const sentinelRef = useRef(null);
  
  const [toolsList, setToolsList] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  /** Raw API offset: how many tools the server has returned so far (unfiltered count) */
  const [apiOffset, setApiOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editingDomains, setEditingDomains] = useState({});
  const [newDomainInputs, setNewDomainInputs] = useState({});
  const [rateLimitValues, setRateLimitValues] = useState({});
  const [maxTimeValues, setMaxTimeValues] = useState({});
  const [enabledValues, setEnabledValues] = useState({});

  const filterVisibleTools = useCallback(
    (tools) => {
      if (!excludeBookingCancellationTools) return tools;
      return tools.filter((t) => !isHiddenFromMcpSystemToolsList(t?.name));
    },
    [excludeBookingCancellationTools]
  );

  const hasMore = apiOffset < totalCount;

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const { tools, total } = await mcpToolsService.getToolsPaginated({ offset: 0, limit: PAGE_SIZE });
      setApiOffset(tools.length);
      setToolsList(filterVisibleTools(tools));
      setTotalCount(total);
    } catch (e) {
      setToolsList([]);
      setTotalCount(0);
      setApiOffset(0);
    } finally {
      setLoading(false);
    }
  }, [filterVisibleTools]);

  const loadNextPage = useCallback(async () => {
    if (apiOffset >= totalCount || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const { tools } = await mcpToolsService.getToolsPaginated({
        offset: apiOffset,
        limit: PAGE_SIZE
      });
      setApiOffset((prev) => prev + tools.length);
      setToolsList((prev) => [...prev, ...filterVisibleTools(tools)]);
    } finally {
      setLoadingMore(false);
    }
  }, [apiOffset, totalCount, loadingMore, loading, filterVisibleTools]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  // Intersection Observer: load next page when sentinel is visible
  useEffect(() => {
    if (!hasMore || loading) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadNextPage();
      },
      { root: null, rootMargin: '100px', threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadNextPage]);

  // Merge new tools into per-tool state when toolsList changes
  useEffect(() => {
    if (toolsList.length === 0) return;
    setEditingDomains(prev => {
      const next = { ...prev };
      toolsList.forEach(tool => {
        if (next[tool.name] === undefined) next[tool.name] = [...(tool.domains || [])];
      });
      return next;
    });
    setRateLimitValues(prev => {
      const next = { ...prev };
      toolsList.forEach(tool => {
        if (next[tool.name] === undefined) next[tool.name] = tool.rateLimit?.limit || 100;
      });
      return next;
    });
    setMaxTimeValues(prev => {
      const next = { ...prev };
      toolsList.forEach(tool => {
        if (next[tool.name] === undefined) next[tool.name] = tool.maxTime ?? null;
      });
      return next;
    });
    setEnabledValues(prev => {
      const next = { ...prev };
      toolsList.forEach(tool => {
        if (next[tool.name] === undefined) next[tool.name] = tool.enabled ?? true;
      });
      return next;
    });
  }, [toolsList]);

  // MCP Tools Handlers - All changes are local until Save is clicked
  const handleToggleTool = (toolName, enabled) => {
    if (readOnly) return;
    setEnabledValues(prev => ({ ...prev, [toolName]: enabled }));
  };

  const handleUpdateRateLimit = (toolName, newLimit) => {
    if (readOnly) return;
    if (newLimit < 1 || newLimit > 1000) {
      showError('Rate limit must be between 1 and 1000');
      return;
    }
    setRateLimitValues(prev => ({ ...prev, [toolName]: newLimit }));
  };

  const handleUpdateMaxTime = (toolName, maxTimeSeconds) => {
    if (readOnly) return;
    // Store in milliseconds, null means no limit
    const maxTimeMs = maxTimeSeconds ? maxTimeSeconds * 1000 : null;
    setMaxTimeValues(prev => ({ ...prev, [toolName]: maxTimeMs }));
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

  // Expose saveAll method to parent component (saves only currently loaded tools)
  useImperativeHandle(ref, () => ({
    saveAll: async () => {
      if (readOnly) return { success: false, error: 'Read-only mode' };
      
      const toolsArray = toolsList;
      
      const savePromises = [];
      const errors = [];

      // Save all pending changes for each tool
      for (const tool of toolsArray) {
        // Save enabled state if changed
        const enabledValue = enabledValues[tool.name];
        const originalEnabled = tool.enabled;
        
        if (enabledValue !== undefined && enabledValue !== originalEnabled) {
          savePromises.push(
            (enabledValue 
              ? mcpToolsService.enableTool(tool.name) 
              : mcpToolsService.disableTool(tool.name)
            ).catch(error => {
              errors.push(`Failed to ${enabledValue ? 'enable' : 'disable'} ${tool.name}: ${error.message}`);
            })
          );
        }

        // Save domains if changed
        const toolDomains = editingDomains[tool.name] || [];
        const originalDomains = tool.domains || [];
        
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

        // Save maxTime if changed
        const maxTimeValue = maxTimeValues[tool.name];
        const originalMaxTime = tool.maxTime;
        
        if (maxTimeValue !== originalMaxTime) {
          savePromises.push(
            mcpToolsService.updateMaxTime(tool.name, maxTimeValue)
              .catch(error => {
                errors.push(`Failed to save max time for ${tool.name}: ${error.message}`);
              })
          );
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
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
              Available MCP Tools ({toolsList.length}
              {totalCount > toolsList.length && !excludeBookingCancellationTools ? ` of ${totalCount}` : ''})
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Refresh />}
            onClick={() => {
              queryClient.invalidateQueries(['mcp-tools']);
              loadFirstPage();
            }}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
        {loading ? (
          <LinearProgress sx={{ mb: 2 }} />
        ) : (() => {
          const toolsArray = toolsList;
          
          return toolsArray.length === 0 ? (
            <Alert severity="info" sx={{ m: 2 }}>
              No MCP tools found. Tools will be discovered on system startup.
            </Alert>
          ) : (
            <TableContainer sx={{ maxHeight: '60vh', overflow: 'auto' }}>
              <Table sx={{ tableLayout: 'fixed' }} stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '12%', position: 'sticky', top: 0, backgroundColor: 'background.paper', zIndex: 1 }}><strong>Tool</strong></TableCell>
                    <TableCell sx={{ width: '20%', position: 'sticky', top: 0, backgroundColor: 'background.paper', zIndex: 1 }}><strong>Description</strong></TableCell>
                    <TableCell align="center" sx={{ width: '8%', position: 'sticky', top: 0, backgroundColor: 'background.paper', zIndex: 1 }}><strong>Enabled</strong></TableCell>
                    <TableCell sx={{ width: '12%', position: 'sticky', top: 0, backgroundColor: 'background.paper', zIndex: 1 }}><strong>Rate Limit</strong></TableCell>
                    <TableCell sx={{ width: '10%', position: 'sticky', top: 0, backgroundColor: 'background.paper', zIndex: 1 }}><strong>Max Time</strong></TableCell>
                    <TableCell sx={{ width: '23%', position: 'sticky', top: 0, backgroundColor: 'background.paper', zIndex: 1 }}><strong>Domain Allowlist</strong></TableCell>
                    <TableCell sx={{ width: '15%', position: 'sticky', top: 0, backgroundColor: 'background.paper', zIndex: 1 }}><strong>Usage Stats</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {toolsArray.map((tool) => {
                  const toolDomains = editingDomains[tool.name] || tool.domains || [];
                  const newDomainInput = newDomainInputs[tool.name] || '';
                  const rateLimitValue = rateLimitValues[tool.name] ?? tool.rateLimit?.limit ?? 100;
                  // maxTime is stored in ms in backend, display in seconds
                  const maxTimeValue = maxTimeValues[tool.name] !== undefined 
                    ? maxTimeValues[tool.name] 
                    : (tool.maxTime || null);
                  const maxTimeSeconds = maxTimeValue ? Math.round(maxTimeValue / 1000) : '';
                  
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
                          checked={enabledValues[tool.name] ?? tool.enabled ?? true}
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
                        <Tooltip title="Maximum execution time in seconds (empty = no limit)">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <TextField
                              type="number"
                              value={maxTimeSeconds}
                              placeholder="∞"
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || value === null) {
                                  handleUpdateMaxTime(tool.name, null);
                                } else {
                                  const seconds = parseInt(value, 10);
                                  if (!isNaN(seconds) && seconds >= 0) {
                                    handleUpdateMaxTime(tool.name, seconds);
                                  }
                                }
                              }}
                              inputProps={{
                                min: 1,
                                max: 300,
                                style: { textAlign: 'center', width: '50px' }
                              }}
                              size="small"
                              sx={{ width: '70px' }}
                              disabled={readOnly}
                            />
                            <Typography variant="caption" color="text.secondary">
                              s
                            </Typography>
                          </Box>
                        </Tooltip>
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
                  {hasMore && (
                    <TableRow sx={{ height: 4 }}>
                      <TableCell colSpan={7} sx={{ p: 0, border: 'none', verticalAlign: 'middle' }}>
                        <Box ref={sentinelRef} sx={{ height: 1, width: 1 }} aria-hidden />
                      </TableCell>
                    </TableRow>
                  )}
                  {loadingMore && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 2 }}>
                        <LinearProgress sx={{ maxWidth: 200, mx: 'auto' }} />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          Loading more tools...
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
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

