import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  CircularProgress
} from '@mui/material';
import { Add, Clear } from '@mui/icons-material';

const QAPairInput = ({ addQAPairMutation, onClear, initialQuestion = '', initialAnswer = '', onInitialApplied }) => {
  const [question, setQuestion] = useState(initialQuestion);
  const [answer, setAnswer] = useState(initialAnswer);

  useEffect(() => {
    if (initialQuestion || initialAnswer) {
      setQuestion(initialQuestion);
      setAnswer(initialAnswer);
      onInitialApplied?.();
    }
  }, [initialQuestion, initialAnswer]);

  const handleAdd = () => {
    if (!question.trim() || !answer.trim()) {
      return;
    }

    addQAPairMutation.mutate(
      { question: question.trim(), answer: answer.trim() },
      {
        onSuccess: () => {
          setQuestion('');
          setAnswer('');
          if (onClear) {
            onClear();
          }
        }
      }
    );
  };

  const handleClear = () => {
    setQuestion('');
    setAnswer('');
  };

  const isLoading = addQAPairMutation?.isLoading || false;

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Add Q&A Pair
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Add a question-answer pair directly to the vector store. The agent will be able to retrieve this information in future conversations.
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          fullWidth
          label="Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Enter the question..."
          required
          disabled={isLoading}
          margin="normal"
        />
        <TextField
          fullWidth
          label="Answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Enter the answer..."
          multiline
          rows={4}
          required
          disabled={isLoading}
          margin="normal"
        />
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            startIcon={<Clear />}
            onClick={handleClear}
            disabled={isLoading || (!question && !answer)}
          >
            Clear
          </Button>
          <Button
            variant="contained"
            startIcon={isLoading ? <CircularProgress size={20} /> : <Add />}
            onClick={handleAdd}
            disabled={isLoading || !question.trim() || !answer.trim()}
          >
            {isLoading ? 'Adding...' : 'Add'}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};

export default QAPairInput;

