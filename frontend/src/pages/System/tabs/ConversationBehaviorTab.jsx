import React from 'react';
import { Box } from '@mui/material';
import ConversationBehaviorSettings from '../../../components/config/ConversationBehaviorSettings';
import { useConversationBehavior } from '../../../hooks/useConversationBehavior';

const ConversationBehaviorTab = () => {
  const { config, isLoading, updateConfig, isUpdating } = useConversationBehavior();

  const handleUpdate = (configData) => {
    updateConfig(configData);
  };

  return (
    <Box>
      <ConversationBehaviorSettings
        config={config}
        onUpdate={handleUpdate}
        isLoading={isLoading || isUpdating}
      />
    </Box>
  );
};

export default ConversationBehaviorTab;

