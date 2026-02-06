import React from 'react';
import { Box, Tabs, Tab, Paper } from '@mui/material';
import VectorStoreStatus from '../components/VectorStoreStatus';
import FileUploadSection from '../components/FileUploadSection';
import FileSearchInterface from '../components/FileSearchInterface';
import QAPairInput from '../components/QAPairInput';
import FilesTable from '../components/FilesTable';
import DriftDetectionMapping from '../components/DriftDetectionMapping';
import kbService from '../../../services/kbService';
import { useToast } from '../../../components/common/ToastProvider';

const KnowledgeBaseManagementTab = ({ state, handlers }) => {
  const { showError } = useToast();
  const [subTab, setSubTab] = React.useState(0);
  
  const {
    vectorStoreStatus,
    vectorStoreLoading,
    vectorStoreError,
    tagOptions,
    selectedTags,
    setSelectedTags,
    uploadFileMutation,
    fileSearchQuery,
    setFileSearchQuery,
    fileSearchResults,
    fileSearchMutation,
    isSearching,
    kbFiles,
    reingestingFiles,
    detectingDrift,
    reingestFileMutation,
    detectDriftMutation,
    addQAPairMutation,
    initialQAPairForKB = { question: '', answer: '' }
  } = state;

  const {
    handleFileUpload,
    handleFileSearch,
    handleViewFile,
    handleOpenEditTags,
    handleReingestFile,
    handleDetectDrift,
    handleClearInitialQAForKB
  } = handlers;

  const handleFileUploadLocal = (event) => {
    const file = event.target.files[0];
    if (file) {
      const allowedTypes = [
        'application/pdf',
        'text/html',
        'text/markdown',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      const maxSize = 25 * 1024 * 1024; // 25MB

      if (!allowedTypes.includes(file.type)) {
        showError('Only PDF, TXT, MD, HTML, DOC, DOCX files are allowed');
        return;
      }

      if (file.size > maxSize) {
        showError('File size must be less than 25MB');
        return;
      }

      uploadFileMutation.mutate({
        file,
        tags: selectedTags.length > 0 ? selectedTags : []
      });
      
      setSelectedTags([]);
      event.target.value = '';
    }
  };

  return (
    <Box>
      <VectorStoreStatus
        vectorStoreStatus={vectorStoreStatus}
        vectorStoreLoading={vectorStoreLoading}
        vectorStoreError={vectorStoreError}
      />

      {/* Sub-tabs for Files and Mappings */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={subTab}
          onChange={(e, newValue) => setSubTab(newValue)}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="Files" />
          <Tab label="Drift Detection Mappings" />
        </Tabs>
      </Paper>

      {subTab === 0 && (
        <>
          <FileUploadSection
            tagOptions={tagOptions}
            selectedTags={selectedTags}
            setSelectedTags={setSelectedTags}
            uploadFileMutation={uploadFileMutation}
            handleFileUpload={handleFileUploadLocal}
          />
          
          <FileSearchInterface
            fileSearchQuery={fileSearchQuery}
            setFileSearchQuery={setFileSearchQuery}
            fileSearchResults={fileSearchResults}
            fileSearchMutation={fileSearchMutation}
            isSearching={isSearching}
            handleFileSearch={handleFileSearch}
          />
          
          <QAPairInput
            addQAPairMutation={addQAPairMutation}
            initialQuestion={initialQAPairForKB.question}
            initialAnswer={initialQAPairForKB.answer}
            onInitialApplied={handleClearInitialQAForKB}
          />
          
          <FilesTable
            kbFiles={kbFiles}
            reingestingFiles={reingestingFiles}
            detectingDrift={detectingDrift}
            reingestFileMutation={reingestFileMutation}
            detectDriftMutation={detectDriftMutation}
            handleViewFile={handleViewFile}
            handleOpenEditTags={handleOpenEditTags}
            handleReingestFile={handleReingestFile}
            handleDetectDrift={handleDetectDrift}
          />
        </>
      )}

      {subTab === 1 && (
        <DriftDetectionMapping />
      )}
    </Box>
  );
};

export default KnowledgeBaseManagementTab;



