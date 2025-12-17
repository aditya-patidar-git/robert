import React, { useState, useEffect } from 'react';
import { Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, FormControl, InputLabel, Select, MenuItem, Typography, Grid } from '@mui/material';
import { Close } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import promptVersionService from '../../../services/promptVersionService';
import VersionDiffView from '../../../components/versions/VersionDiffView';

/**
 * VersionComparison Component
 * Dialog for comparing two prompt versions
 */
const VersionComparison = ({ open, onClose, version1Id, version2Id, versions = [] }) => {
  const [selectedVersion1, setSelectedVersion1] = useState(version1Id);
  const [selectedVersion2, setSelectedVersion2] = useState(version2Id);
  const [diffData, setDiffData] = useState(null);

  // Fetch comparison data
  const { data: comparisonData, isLoading } = useQuery({
    queryKey: ['version-comparison', selectedVersion1, selectedVersion2],
    queryFn: async () => {
      if (!selectedVersion1 || !selectedVersion2) return null;
      return await promptVersionService.compareVersions(selectedVersion1, selectedVersion2);
    },
    enabled: !!selectedVersion1 && !!selectedVersion2 && open
  });

  useEffect(() => {
    if (comparisonData?.diff) {
      setDiffData(comparisonData.diff);
    }
  }, [comparisonData]);

  useEffect(() => {
    if (open) {
      setSelectedVersion1(version1Id);
      setSelectedVersion2(version2Id);
    }
  }, [open, version1Id, version2Id]);

  const handleCompare = () => {
    // Comparison is automatic via query
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Compare Prompt Versions</Typography>
          <Button onClick={onClose} size="small">
            <Close />
          </Button>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Version 1</InputLabel>
              <Select
                value={selectedVersion1 || ''}
                label="Version 1"
                onChange={(e) => setSelectedVersion1(e.target.value)}
              >
                {versions.map((version) => (
                  <MenuItem key={version._id || version.id} value={version._id || version.id}>
                    Version {version.version} - {version.createdByName || version.createdBy} ({new Date(version.createdAt).toLocaleDateString()})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Version 2</InputLabel>
              <Select
                value={selectedVersion2 || ''}
                label="Version 2"
                onChange={(e) => setSelectedVersion2(e.target.value)}
              >
                {versions.map((version) => (
                  <MenuItem key={version._id || version.id} value={version._id || version.id}>
                    Version {version.version} - {version.createdByName || version.createdBy} ({new Date(version.createdAt).toLocaleDateString()})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {comparisonData && (
            <Grid item xs={12}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Comparing Version {comparisonData.version1?.version} with Version {comparisonData.version2?.version}
                </Typography>
              </Box>
              <VersionDiffView diff={diffData || comparisonData.diff} />
            </Grid>
          )}

          {isLoading && (
            <Grid item xs={12}>
              <Typography>Loading comparison...</Typography>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default VersionComparison;

