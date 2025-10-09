import React from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { Box, Chip, Typography } from '@mui/material';
import { formatDuration } from '../../utils/formatters';

const ActiveCallsTable = ({ calls, loading = false, onRowClick, userRole }) => {
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'in progress':
      case 'active':
        return 'success';
      case 'on hold':
        return 'warning';
      case 'ended':
      case 'completed':
        return 'default';
      case 'failed':
        return 'error';
      default:
        return 'info';
    }
  };

  const columns = [
    {
      field: 'callerId',
      headerName: 'Caller ID',
      width: 150,
      renderCell: (params) => (
        <Typography variant="body2" fontFamily="monospace">
          {params.value || 'Unknown'}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={getStatusColor(params.value)}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'duration',
      headerName: 'Duration',
      width: 120,
      renderCell: (params) => (
        <Typography variant="body2" fontFamily="monospace">
          {formatDuration(params.value)}
        </Typography>
      ),
    },
    {
      field: 'assignedNumber',
      headerName: 'Assigned Number/Route',
      width: 180,
      flex: 1,
      renderCell: (params) => (
        <Typography variant="body2">
          {params.value || 'Not assigned'}
        </Typography>
      ),
    },
  ];

  // Add additional columns for owner/admin
  if (userRole === 'owner' || userRole === 'admin') {
    columns.push({
      field: 'agent',
      headerName: 'Agent',
      width: 120,
      renderCell: (params) => (
        <Typography variant="body2">
          {params.value || 'System'}
        </Typography>
      ),
    });
  }

  const handleRowClick = (params) => {
    if (onRowClick) {
      onRowClick(params.row);
    }
  };

  return (
    <Box sx={{ height: 400, width: '100%' }}>
      <DataGrid
        rows={calls}
        columns={columns}
        loading={loading}
        pageSize={10}
        rowsPerPageOptions={[5, 10, 25]}
        disableSelectionOnClick
        onRowClick={handleRowClick}
        sx={{
          border: 0,
          backgroundColor: 'white',
          '& .MuiDataGrid-row': {
            cursor: 'pointer',
            backgroundColor: 'white',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.08) !important',
            },
            '&:nth-of-type(even)': {
              backgroundColor: 'white',
            },
            '&:nth-of-type(odd)': {
              backgroundColor: 'white',
            },
          },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.08) !important',
          },
          '& .MuiDataGrid-cell': {
            borderBottom: '1px solid',
            borderBottomColor: 'divider',
            backgroundColor: 'transparent',
          },
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: 'white',
            borderBottom: '2px solid',
            borderBottomColor: 'primary.main',
            '& .MuiDataGrid-columnHeader': {
              backgroundColor: 'white',
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 'bold',
              color: 'text.primary',
            },
          },
          '& .MuiDataGrid-footerContainer': {
            backgroundColor: 'white',
            borderTop: '1px solid',
            borderTopColor: 'divider',
          },
          '& .MuiDataGrid-toolbarContainer': {
            backgroundColor: 'white',
            borderBottom: '1px solid',
            borderBottomColor: 'divider',
          },
        }}
        getRowId={(row) => row.callSid || row.id}
      />
    </Box>
  );
};

export default ActiveCallsTable;