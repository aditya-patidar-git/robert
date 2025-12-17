import React from 'react';
import { Box, Paper, Typography, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { Code } from '@mui/icons-material';

/**
 * VersionDiffView Component
 * Reusable component for displaying version diffs
 * Used by Prompt Versioning, Template Versioning, etc.
 */
const VersionDiffView = ({ diff, format = 'unified' }) => {
  const [viewMode, setViewMode] = React.useState(format);

  if (!diff) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No diff available
        </Typography>
      </Paper>
    );
  }

  const renderUnifiedDiff = () => {
    if (!diff.lines) return null;

    return (
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width="80px"><strong>Line</strong></TableCell>
              <TableCell width="60px"><strong>Type</strong></TableCell>
              <TableCell><strong>Content</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {diff.lines.map((line, index) => (
              <TableRow
                key={index}
                sx={{
                  bgcolor: line.type === 'added' ? 'success.light' :
                           line.type === 'removed' ? 'error.light' :
                           'transparent'
                }}
              >
                <TableCell>
                  {line.lineNumber1 || line.lineNumber2 || '-'}
                </TableCell>
                <TableCell>
                  <Typography
                    variant="caption"
                    color={
                      line.type === 'added' ? 'success.main' :
                      line.type === 'removed' ? 'error.main' :
                      'text.secondary'
                    }
                  >
                    {line.prefix || ' '}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    component="pre"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      m: 0
                    }}
                  >
                    {line.line}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderSideBySideDiff = () => {
    if (!diff.left || !diff.right) return null;

    return (
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width="80px"><strong>Line</strong></TableCell>
              <TableCell><strong>Old Version</strong></TableCell>
              <TableCell><strong>New Version</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {diff.left.map((leftLine, index) => {
              const rightLine = diff.right[index];
              return (
                <TableRow key={index}>
                  <TableCell>
                    {leftLine.originalLineNumber || rightLine?.lineNumber || '-'}
                  </TableCell>
                  <TableCell
                    sx={{
                      bgcolor: leftLine.type === 'removed' ? 'error.light' : 'transparent',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem'
                    }}
                  >
                    {leftLine.line}
                  </TableCell>
                  <TableCell
                    sx={{
                      bgcolor: rightLine?.type === 'added' ? 'success.light' : 'transparent',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem'
                    }}
                  >
                    {rightLine?.line || ''}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" fontWeight="bold">
          Version Comparison
        </Typography>
        {diff.stats && (
          <Typography variant="caption" color="text.secondary">
            {diff.stats.added} added, {diff.stats.removed} removed, {diff.stats.unchanged} unchanged
          </Typography>
        )}
      </Box>

      {diff.format === 'side-by-side' || viewMode === 'side-by-side' ? (
        renderSideBySideDiff()
      ) : (
        renderUnifiedDiff()
      )}
    </Paper>
  );
};

export default VersionDiffView;

