import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Alert
} from '@mui/material';
import { Edit, Save, Cancel } from '@mui/icons-material';
import ConfirmSaveDialog from '../../../../components/common/ConfirmSaveDialog';
import { AGENT_AFFECTING_WARNINGS } from '../../../../constants/agentAffectingWarnings';

/**
 * Consent Script Section Component
 * Manages the consent script editor
 */
export function ConsentScriptSection({ script, onUpdate, loading }) {
  const [editing, setEditing] = useState(false);
  const [editedScript, setEditedScript] = useState(script || '');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleSave = () => {
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    try {
      await onUpdate(editedScript);
      setEditing(false);
      setConfirmOpen(false);
    } catch (error) {
      console.error('Failed to save consent script:', error);
    }
  };

  const handleCancel = () => {
    setEditedScript(script || '');
    setEditing(false);
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Consent Script</Typography>
        {!editing && (
          <Button
            startIcon={<Edit />}
            onClick={() => setEditing(true)}
            variant="outlined"
            size="small"
          >
            Edit
          </Button>
        )}
      </Box>

      {editing ? (
        <Box>
          <TextField
            fullWidth
            multiline
            rows={10}
            value={editedScript}
            onChange={(e) => setEditedScript(e.target.value)}
            placeholder="Enter consent script HTML..."
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              startIcon={<Save />}
              onClick={handleSave}
              variant="contained"
              disabled={loading}
            >
              Save
            </Button>
            <Button
              startIcon={<Cancel />}
              onClick={handleCancel}
              variant="outlined"
            >
              Cancel
            </Button>
          </Box>
        </Box>
      ) : (
        <Box>
          {script ? (
            <Box
              component="pre"
              sx={{
                p: 2,
                bgcolor: 'grey.100',
                borderRadius: 1,
                overflow: 'auto',
                maxHeight: 400,
                fontSize: '0.875rem'
              }}
            >
              {script}
            </Box>
          ) : (
            <Alert severity="info">No consent script configured</Alert>
          )}
        </Box>
      )}

      <ConfirmSaveDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmSave}
        title={AGENT_AFFECTING_WARNINGS.PRIVACY_CONSENT.title}
        message={AGENT_AFFECTING_WARNINGS.PRIVACY_CONSENT.message}
        effects={AGENT_AFFECTING_WARNINGS.PRIVACY_CONSENT.effects}
        confirmLabel="Save"
      />
    </Paper>
  );
}

