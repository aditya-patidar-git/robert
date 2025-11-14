import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, FormControl, Select, MenuItem, IconButton, Chip, Alert } from '@mui/material';
import { Edit, Delete } from '@mui/icons-material';

const NumberManagementTable = ({
  numbers,
  setValue,
  watch,
  handleOpenEditNumber,
  handleOpenDeleteNumber,
  handleEditNumber
}) => {
  const provisionedNumbers = numbers || [];

  return (
    <>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Phone Number</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Route Assignment</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {provisionedNumbers.map((number, index) => (
              <TableRow key={number.number}>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {number.number}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {number.description || '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <Select
                      value={number.route || 'ai_agent'}
                      onChange={(e) => {
                        const updatedNumbers = [...provisionedNumbers];
                        updatedNumbers[index] = { ...updatedNumbers[index], route: e.target.value };
                        setValue('numbers', updatedNumbers);
                      }}
                    >
                      <MenuItem value="ai_agent">AI Agent</MenuItem>
                      <MenuItem value="transfer">Transfer to Human</MenuItem>
                      <MenuItem value="voicemail">Voicemail</MenuItem>
                      <MenuItem value="after_hours">After-hours Message</MenuItem>
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <Select
                      value={number.status || 'active'}
                      onChange={(e) => {
                        const updatedNumbers = [...provisionedNumbers];
                        updatedNumbers[index] = { ...updatedNumbers[index], status: e.target.value };
                        setValue('numbers', updatedNumbers);
                        handleEditNumber(number.number, { status: e.target.value });
                      }}
                    >
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="inactive">Inactive</MenuItem>
                      <MenuItem value="maintenance">Maintenance</MenuItem>
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell>
                  <IconButton 
                    size="small"
                    onClick={() => handleOpenEditNumber(number)}
                  >
                    <Edit />
                  </IconButton>
                  <IconButton 
                    size="small" 
                    color="error"
                    onClick={() => handleOpenDeleteNumber(number)}
                  >
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {provisionedNumbers.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          No provisioned numbers found. Add a phone number to get started.
        </Alert>
      )}
    </>
  );
};

export default NumberManagementTable;



