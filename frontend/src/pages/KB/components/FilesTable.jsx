import React, { useState } from 'react';
import { Paper, Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Chip, IconButton } from '@mui/material';
import { Description, Visibility, Edit, Refresh, Warning, CheckCircle } from '@mui/icons-material';
import { formatDate, formatDateTime } from '../../../utils/formatters';

const ROWS_PER_PAGE = 15;

const FilesTable = ({
  kbFiles,
  reingestingFiles,
  detectingDrift,
  reingestFileMutation,
  detectDriftMutation,
  handleViewFile,
  handleOpenEditTags,
  handleReingestFile,
  handleDetectDrift
}) => {
  const fileList = Array.isArray(kbFiles) ? kbFiles : [];
  const [page, setPage] = useState(0);

  const paginatedFiles = fileList.slice(page * ROWS_PER_PAGE, page * ROWS_PER_PAGE + ROWS_PER_PAGE);

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  return (
    <Paper sx={{ mb: 3 }}>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Knowledge Base Files ({fileList.length})
        </Typography>
      </Box>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Filename</TableCell>
              <TableCell>Tags</TableCell>
              <TableCell>Uploaded At</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Drift</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedFiles.map((file, index) => (
              <TableRow key={file.id || index}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Description fontSize="small" />
                    {file.filename}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {file.tags && file.tags.length > 0 ? (
                      file.tags.map((tag, tagIndex) => (
                        <Chip key={tagIndex} label={tag} size="small" variant="outlined" />
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        No tags
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell sx={{ width: 150 }}>{formatDate(new Date(file.created_at * 1000))}</TableCell>
                <TableCell>
                  <Chip
                    label={file.status || 'Active'}
                    color={file.status === 'processed' ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {file.hasDrift ? (
                      <Chip
                        icon={<Warning />}
                        label="Drift Detected"
                        color="warning"
                        size="small"
                        title={`Drift Score: ${(file.driftScore * 100).toFixed(1)}%`}
                      />
                    ) : (
                      <Chip
                        icon={<CheckCircle />}
                        label="No Drift"
                        color="success"
                        size="small"
                      />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleViewFile(file)}
                      title="View file details"
                      color="primary"
                    >
                      <Visibility />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenEditTags(file)}
                      title="Edit tags"
                      color="primary"
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleReingestFile(file)}
                      title="Re-ingest file"
                      color="secondary"
                      disabled={reingestingFiles.has(file.id) || reingestFileMutation.isLoading}
                    >
                      <Refresh />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDetectDrift(file)}
                      title="Detect drift"
                      color={file.hasDrift ? 'warning' : 'default'}
                      disabled={detectingDrift.has(file.id) || detectDriftMutation.isLoading}
                    >
                      <Warning />
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={fileList.length}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={ROWS_PER_PAGE}
          rowsPerPageOptions={[]}
        />
      </TableContainer>
    </Paper>
  );
};

export default FilesTable;



