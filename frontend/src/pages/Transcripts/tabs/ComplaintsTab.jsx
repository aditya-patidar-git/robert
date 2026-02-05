import React from 'react';
import { Paper, Box, Typography, Button, TextField, FormControl, InputLabel, Select, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Pagination, CircularProgress } from '@mui/material';
import { Visibility } from '@mui/icons-material';
import { formatDateTime } from '../../../utils/formatters';
import { COMPLAINT_TYPE_OPTIONS, COMPLAINT_STATUS_OPTIONS, COMPLAINT_PRIORITY_OPTIONS, DEFAULT_COMPLAINT_FILTERS } from '../constants';

const ComplaintsTab = ({ state, handlers }) => {
  const {
    complaints,
    complaintPagination,
    complaintFilters,
    setComplaintFilters,
    isLoadingComplaints
  } = state;

  const {
    handleViewComplaint,
    getComplaintStatusColor,
    getPriorityColor
  } = handlers;

  return (
    <Paper>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6">
          Complaints & Escalations ({complaintPagination?.total || complaints.length})
        </Typography>
      </Box>

      <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          size="small"
          label="Search"
          value={complaintFilters.search}
          onChange={(e) => setComplaintFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
          placeholder="Search complaints..."
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="status-label">Status</InputLabel>
          <Select
            labelId="status-label"
            label="Status"
            value={complaintFilters.status}
            onChange={(e) => setComplaintFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
          >
            {COMPLAINT_STATUS_OPTIONS.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="priority-label">Priority</InputLabel>
          <Select
            labelId="priority-label"
            label="Priority"
            value={complaintFilters.priority}
            onChange={(e) => setComplaintFilters(prev => ({ ...prev, priority: e.target.value, page: 1 }))}
          >
            {COMPLAINT_PRIORITY_OPTIONS.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="type-label">Type</InputLabel>
          <Select
            labelId="type-label"
            label="Type"
            value={complaintFilters.complaintType}
            onChange={(e) => setComplaintFilters(prev => ({ ...prev, complaintType: e.target.value, page: 1 }))}
          >
            <MenuItem value="">All</MenuItem>
            {COMPLAINT_TYPE_OPTIONS.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="Start Date"
          type="date"
          value={complaintFilters.startDate}
          onChange={(e) => setComplaintFilters(prev => ({ ...prev, startDate: e.target.value, page: 1 }))}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 150 }}
        />
        <TextField
          size="small"
          label="End Date"
          type="date"
          value={complaintFilters.endDate}
          onChange={(e) => setComplaintFilters(prev => ({ ...prev, endDate: e.target.value, page: 1 }))}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 150 }}
        />
        <Button
          variant="outlined"
          onClick={() => setComplaintFilters(DEFAULT_COMPLAINT_FILTERS)}
        >
          Clear Filters
        </Button>
      </Box>

      {isLoadingComplaints ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Caller ID</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Assigned To</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {complaints.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No complaints found matching your filters
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  complaints.map((complaint) => (
                    <TableRow key={complaint._id || complaint.id}>
                      <TableCell><Typography variant="body2" fontFamily="monospace">{complaint.callerId || complaint.from}</Typography></TableCell>
                      <TableCell>{formatDateTime(complaint.createdAt)}</TableCell>
                      <TableCell>{complaint.complaintType || complaint.type}</TableCell>
                      <TableCell><Chip label={complaint.status} color={getComplaintStatusColor(complaint.status)} size="small" /></TableCell>
                      <TableCell><Chip label={complaint.priority} color={getPriorityColor(complaint.priority)} size="small" /></TableCell>
                      <TableCell>{complaint.assignedTo || 'Unassigned'}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleViewComplaint(complaint)}>
                          <Visibility fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {complaintPagination?.pages > 1 && (
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
              <Pagination count={complaintPagination.pages} page={complaintFilters.page} onChange={(e, page) => setComplaintFilters(prev => ({ ...prev, page }))} color="primary" />
            </Box>
          )}
        </>
      )}
    </Paper>
  );
};

export default ComplaintsTab;



