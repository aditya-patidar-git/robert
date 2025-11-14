import React from 'react';
import { Paper, Box, Typography, Button, TextField, FormControl, InputLabel, Select, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Pagination, CircularProgress } from '@mui/material';
import { Visibility } from '@mui/icons-material';
import { formatDateTime } from '../../../utils/formatters';

const ComplaintsTab = ({ state, handlers }) => {
  const {
    complaints,
    complaintPagination,
    complaintFilters,
    setComplaintFilters,
    isLoadingComplaints,
    selectedTranscript,
    setComplaintDialog,
    showError
  } = state;

  const {
    handleViewComplaint,
    getComplaintStatusColor,
    getPriorityColor
  } = handlers;

  return (
    <Paper>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          Complaints & Escalations ({complaintPagination?.total || complaints.length})
        </Typography>
        <Button 
          variant="contained" 
          onClick={() => {
            if (selectedTranscript) {
              setComplaintDialog(true);
            } else {
              showError('Please select a transcript first');
            }
          }}
        >
          Submit Complaint
        </Button>
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
            value={complaintFilters.status}
            onChange={(e) => setComplaintFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="open">Open</MenuItem>
            <MenuItem value="investigating">Investigating</MenuItem>
            <MenuItem value="resolved">Resolved</MenuItem>
            <MenuItem value="closed">Closed</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="priority-label">Priority</InputLabel>
          <Select
            labelId="priority-label"
            value={complaintFilters.priority}
            onChange={(e) => setComplaintFilters(prev => ({ ...prev, priority: e.target.value, page: 1 }))}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="urgent">Urgent</MenuItem>
            <MenuItem value="high">High</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="low">Low</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="type-label">Type</InputLabel>
          <Select
            labelId="type-label"
            value={complaintFilters.complaintType}
            onChange={(e) => setComplaintFilters(prev => ({ ...prev, complaintType: e.target.value, page: 1 }))}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="service_quality">Service Quality</MenuItem>
            <MenuItem value="ai_understanding">AI Understanding</MenuItem>
            <MenuItem value="response_time">Response Time</MenuItem>
            <MenuItem value="technical_issue">Technical Issue</MenuItem>
            <MenuItem value="billing">Billing</MenuItem>
            <MenuItem value="booking">Booking</MenuItem>
            <MenuItem value="instructor_conduct">Instructor Conduct</MenuItem>
            <MenuItem value="safety_concern">Safety Concern</MenuItem>
            <MenuItem value="discrimination">Discrimination</MenuItem>
            <MenuItem value="other">Other</MenuItem>
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
          onClick={() => setComplaintFilters({ page: 1, limit: 20, search: '', status: '', priority: '', complaintType: '', assignedTo: '', startDate: '', endDate: '' })}
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
                {complaints.map((complaint) => (
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
                ))}
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



