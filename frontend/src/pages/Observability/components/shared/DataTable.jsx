import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
  Box
} from '@mui/material';

/**
 * Reusable Data Table Component
 * Displays data in a table format with consistent styling
 */
const DataTable = ({ 
  columns = [], 
  rows = [], 
  emptyMessage = 'No data available',
  loading = false,
  onRowClick = null,
  getRowKey = (row, index) => index
}) => {
  if (loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Loading data...
        </Typography>
      </Paper>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary" align="center">
          {emptyMessage}
        </Typography>
      </Paper>
    );
  }

  const renderCell = (row, column) => {
    const value = column.accessor ? column.accessor(row) : row[column.key];
    
    if (column.render) {
      return column.render(value, row);
    }
    
    if (column.type === 'chip') {
      return (
        <Chip 
          label={value} 
          size="small" 
          color={column.chipColor || 'default'}
        />
      );
    }
    
    if (column.type === 'number') {
      return typeof value === 'number' ? value.toLocaleString() : value;
    }
    
    if (column.type === 'percentage') {
      return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : value;
    }
    
    return value || '-';
  };

  return (
    <TableContainer component={Paper} elevation={2}>
      <Table>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell 
                key={column.key || column.id}
                sx={{ fontWeight: 600 }}
                align={column.align || 'left'}
              >
                {column.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow
              key={getRowKey(row, index)}
              onClick={onRowClick ? () => onRowClick(row, index) : undefined}
              sx={{
                cursor: onRowClick ? 'pointer' : 'default',
                '&:hover': onRowClick ? { backgroundColor: 'action.hover' } : {}
              }}
            >
              {columns.map((column) => (
                <TableCell 
                  key={column.key || column.id}
                  align={column.align || 'left'}
                >
                  {renderCell(row, column)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default DataTable;

