import React from 'react';
import { Box, Grid, TextField, FormControl, InputLabel, Select, MenuItem, Chip } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';

/**
 * DSARRequestFilters Component
 * Reusable filter component for DSAR requests
 */
const DSARRequestFilters = ({ filters, onFilterChange }) => {
  return (
    <Box sx={{ mb: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            size="small"
            label="Search Email/Phone"
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
          />
        </Grid>

        <Grid item xs={12} md={2}>
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
        </Grid>

        <Grid item xs={12} md={2}>
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
        </Grid>

        <Grid item xs={12} md={2}>
          <DatePicker
            label="Start Date"
            value={filters.startDate || null}
            onChange={(date) => onFilterChange({ ...filters, startDate: date })}
            slotProps={{ textField: { size: 'small', fullWidth: true } }}
          />
        </Grid>

        <Grid item xs={12} md={2}>
          <DatePicker
            label="End Date"
            value={filters.endDate || null}
            onChange={(date) => onFilterChange({ ...filters, endDate: date })}
            slotProps={{ textField: { size: 'small', fullWidth: true } }}
          />
        </Grid>

        <Grid item xs={12}>
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
        </Grid>
      </Grid>
    </Box>
  );
};

export default DSARRequestFilters;

