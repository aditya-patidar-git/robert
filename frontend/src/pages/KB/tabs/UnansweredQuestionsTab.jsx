import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  HelpOutline,
  CheckCircle,
  Cancel,
  Warning,
  TrendingUp,
  AddCircleOutline
} from '@mui/icons-material';
import { formatDateTime } from '../../../utils/formatters';

const UnansweredQuestionsTab = ({ state, handlers }) => {
  const {
    unansweredQuestions,
    unansweredQuestionsLoading,
    unansweredQuestionsError,
    unansweredQuestionsTotal,
    unansweredQuestionsStatusFilter,
    setUnansweredQuestionsStatusFilter,
    unansweredQuestionsPriorityFilter,
    setUnansweredQuestionsPriorityFilter,
    refetchUnansweredQuestions
  } = state;

  const { handleAddToKBFromUnanswered } = handlers;

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'answered':
        return 'success';
      case 'dismissed':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Warning fontSize="small" />;
      case 'answered':
        return <CheckCircle fontSize="small" />;
      case 'dismissed':
        return <Cancel fontSize="small" />;
      default:
        return <HelpOutline fontSize="small" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  const trimContextBrackets = (context) => {
    if (!context) return 'N/A';
    // Remove everything from the first opening parenthesis onwards
    const index = context.indexOf('(');
    return index !== -1 ? context.substring(0, index).trim() : context.trim();
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" gutterBottom fontWeight="bold">
            Unanswered Questions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Review questions that the AI system was unable to answer or had low confidence in answering.
          </Typography>
        </Box>

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={unansweredQuestionsStatusFilter}
              onChange={(e) => setUnansweredQuestionsStatusFilter(e.target.value)}
              label="Status"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="answered">Answered</MenuItem>
              <MenuItem value="dismissed">Dismissed</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Priority</InputLabel>
            <Select
              value={unansweredQuestionsPriorityFilter}
              onChange={(e) => setUnansweredQuestionsPriorityFilter(e.target.value)}
              label="Priority"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Low</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ flexGrow: 1 }} />

          <Typography variant="body2" color="text.secondary">
            Total: {unansweredQuestionsTotal}
          </Typography>
        </Box>

        {/* Loading State */}
        {unansweredQuestionsLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Error State */}
        {unansweredQuestionsError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load unanswered questions: {unansweredQuestionsError.message || 'Unknown error'}
          </Alert>
        )}

        {/* Empty State */}
        {!unansweredQuestionsLoading && !unansweredQuestionsError && unansweredQuestions.length === 0 && (
          <Alert severity="info">
            No unanswered questions found matching the current filters.
          </Alert>
        )}

        {/* Questions Table */}
        {!unansweredQuestionsLoading && !unansweredQuestionsError && unansweredQuestions.length > 0 && (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Question</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Priority</strong></TableCell>
                  <TableCell><strong>Context</strong></TableCell>
                  <TableCell><strong>Confidence</strong></TableCell>
                  <TableCell><strong>Occurrences</strong></TableCell>
                  <TableCell><strong>Created</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {unansweredQuestions.map((question) => (
                  <TableRow key={question._id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {question.question}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(question.status)}
                        label={question.status || 'pending'}
                        color={getStatusColor(question.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={question.priority || 'medium'}
                        color={getPriorityColor(question.priority)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {trimContextBrackets(question.context)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {question.confidence !== undefined && question.confidence !== null ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="body2">
                            {(question.confidence * 100).toFixed(1)}%
                          </Typography>
                          {question.confidence < 0.5 && (
                            <TrendingUp fontSize="small" color="error" />
                          )}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          N/A
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={question.occurrenceCount || 1}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDateTime(question.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Add to Knowledge Base (opens KB tab with question pre-filled)">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleAddToKBFromUnanswered?.(question.question)}
                          aria-label="Add to KB"
                        >
                          <AddCircleOutline fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

      </Paper>
    </Box>
  );
};

export default UnansweredQuestionsTab;
