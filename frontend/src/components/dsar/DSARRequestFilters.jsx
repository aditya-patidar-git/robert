import React from 'react';
import { Box, TextField, FormControl, InputLabel, Select, MenuItem, Chip } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { GlobalStyles } from '@mui/material';

/**
 * DSARRequestFilters Component
 * Reusable filter component for DSAR requests
 */
const DSARRequestFilters = ({ filters, onFilterChange }) => {
  return (
    <Box sx={{ mb: 2 }}>
      <GlobalStyles
        styles={{
          'input[type="date"]::-webkit-inner-spin-button': {
            WebkitAppearance: 'none',
            margin: 0,
            display: 'none !important'
          },
          'input[type="date"]::-webkit-outer-spin-button': {
            WebkitAppearance: 'none',
            margin: 0,
            display: 'none !important'
          },
          'input[type="date"]::-webkit-calendar-picker-indicator': {
            opacity: 1,
            cursor: 'pointer'
          },
          'input[type="number"]::-webkit-inner-spin-button': {
            WebkitAppearance: 'none',
            margin: 0,
            display: 'none !important'
          },
          'input[type="number"]::-webkit-outer-spin-button': {
            WebkitAppearance: 'none',
            margin: 0,
            display: 'none !important'
          },
          'input[type="number"]': {
            MozAppearance: 'textfield'
          },
          '.MuiTextField-root input[type="date"]::-webkit-inner-spin-button, .MuiTextField-root input[type="date"]::-webkit-outer-spin-button': {
            WebkitAppearance: 'none',
            margin: 0,
            display: 'none !important'
          },
          '.MuiTextField-root input[type="number"]::-webkit-inner-spin-button, .MuiTextField-root input[type="number"]::-webkit-outer-spin-button': {
            WebkitAppearance: 'none',
            margin: 0,
            display: 'none !important'
          }
        }}
      />
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, overflowX: 'auto' }}>
        <Box sx={{ flex: '1 1 0', minWidth: '160px' }}>
          <TextField
            fullWidth
            size="small"
            label="Search Email/Phone"
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
          />
        </Box>

        <Box sx={{ flex: '1 1 0', minWidth: '140px' }}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.status || ''}
              label="Status"
              onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="approved">Approved</MenuItem>
              <MenuItem value="rejected">Rejected</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ flex: '1 1 0', minWidth: '140px' }}>
          <FormControl fullWidth size="small">
            <InputLabel>Type</InputLabel>
            <Select
              value={filters.type || ''}
              label="Type"
              onChange={(e) => onFilterChange({ ...filters, type: e.target.value })}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="export">Export</MenuItem>
              <MenuItem value="delete">Delete</MenuItem>
              <MenuItem value="portability">Portability</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ flex: '1 1 0', minWidth: '160px' }}>
          <DatePicker
            label="Start Date"
            value={filters.startDate || null}
            onChange={(date) => onFilterChange({ ...filters, startDate: date })}
            slotProps={{ 
              textField: { 
                size: 'small', 
                fullWidth: true
              } 
            }}
          />
        </Box>

        <Box sx={{ flex: '1 1 0', minWidth: '160px' }}>
          <DatePicker
            label="End Date"
            value={filters.endDate || null}
            onChange={(date) => onFilterChange({ ...filters, endDate: date })}
            slotProps={{ 
              textField: { 
                size: 'small', 
                fullWidth: true
              } 
            }}
          />
        </Box>
      </Box>

      <Box sx={{ width: '100%' }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {filters.status && (
            <Chip
              label={`Status: ${filters.status}`}
              onDelete={() => onFilterChange({ ...filters, status: '' })}
              size="small"
            />
          )}
          {filters.type && (
            <Chip
              label={`Type: ${filters.type}`}
              onDelete={() => onFilterChange({ ...filters, type: '' })}
              size="small"
            />
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default DSARRequestFilters;

