import React from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Typography
} from '@mui/material';
import { Edit, Delete, Send, Search } from '@mui/icons-material';
import { formatDateTime } from '../../utils/formatters';

/**
 * TemplateList Component
 * Reusable template list with filtering
 */
const TemplateList = ({
  templates = [],
  onSelect,
  onDelete,
  onTest,
  filters = {},
  onFilterChange
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredTemplates = templates.filter(template => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        template.name?.toLowerCase().includes(searchLower) ||
        template.category?.toLowerCase().includes(searchLower) ||
        template.subject?.toLowerCase().includes(searchLower) ||
        template.body?.toLowerCase().includes(searchLower)
      );
    }

    if (filters.category && template.category !== filters.category) {
      return false;
    }

    if (filters.courseType && template.courseType !== filters.courseType && template.courseType !== 'all') {
      return false;
    }

    if (filters.isActive !== undefined && template.isActive !== filters.isActive) {
      return false;
    }

    return true;
  });

  return (
    <Box>
      <TextField
        fullWidth
        size="small"
        placeholder="Search templates..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" />
            </InputAdornment>
          )
        }}
        sx={{ mb: 2 }}
      />

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Name</strong></TableCell>
              <TableCell><strong>Category</strong></TableCell>
              <TableCell><strong>Course Type</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Updated</strong></TableCell>
              <TableCell align="right"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTemplates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary">No templates found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredTemplates.map((template) => (
                <TableRow key={template._id || template.id} hover>
                  <TableCell>{template.name}</TableCell>
                  <TableCell>
                    <Chip label={template.category} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    {template.courseType === 'all' ? 'All Courses' : template.courseType}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={template.isActive ? 'Active' : 'Inactive'}
                      color={template.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{formatDateTime(template.updatedAt || template.createdAt)}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => onSelect && onSelect(template)}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Test Send">
                      <IconButton size="small" onClick={() => onTest && onTest(template)}>
                        <Send fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => onDelete && onDelete(template)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default TemplateList;

