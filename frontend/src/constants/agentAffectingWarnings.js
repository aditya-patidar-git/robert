/**
 * Centralized copy for confirmation dialogs before saving agent-affecting settings.
 * Each key maps to { title, message, effects } for ConfirmSaveDialog.
 */
export const AGENT_AFFECTING_WARNINGS = {
  AI_CONFIG: {
    title: 'Save AI configuration',
    message: 'This will update the global prompt, model, voice, parameters, and uncertainty gate used by the agent on live calls.',
    effects: [
      'Live calls will use the new prompt and model immediately.',
      'Changing temperature or max tokens can affect response quality and length.',
      'Uncertainty gate changes when the agent defers vs answers from the knowledge base.'
    ]
  },
  PROMPT_ACTIVATE_VERSION: {
    title: 'Activate this prompt version',
    message: 'Activating this version will make it the active prompt used by the agent.',
    effects: ['The active prompt used on live calls will change immediately.']
  },
  PROMPT_ROLLBACK: {
    title: 'Rollback to previous version',
    message: 'This will create a new version with the content from the selected version.',
    effects: ['This will change how Robert behaves on live calls once you save.']
  },
  PROMPT_CLEAR_VERSIONS: {
    title: 'Clear inactive versions',
    message: 'This will permanently delete all inactive prompt versions. This action cannot be undone.',
    effects: [
      'Version history will be reduced; rollback options may be limited.',
      'Live behavior does not change unless you then activate a different version.'
    ]
  },
  FLOW_OVERRIDE: {
    title: 'Save flow parameter override',
    message: 'This overrides behavior for a specific flow (e.g. booking or cancellation).',
    effects: ['The agent will use these parameters for the selected flow on future calls.']
  },
  MCP_SYSTEM: {
    title: 'Save MCP configuration',
    message: 'This will update MCP system settings and per-tool configuration.',
    effects: [
      'Disabling MCP or a tool will remove that capability from the agent.',
      'Rate limits and timeouts affect how often and how long tool calls can run.',
      'Changes apply to live and future calls after the agent syncs config.'
    ]
  },
  CRM_TASKS: {
    title: 'Save CRM tasks configuration',
    message: 'This will change which CRM actions the agent can perform and how they are confirmed.',
    effects: [
      'Disabling a task removes that capability from the agent.',
      'Turning off "Require Human Confirmation" allows the agent to act without approval.',
      'Changing dry-run or audit logging affects safety and compliance.'
    ]
  },
  GENERAL_SYSTEM: {
    title: 'Save system parameters',
    message: 'These settings control call capacity and timeouts used by the system.',
    effects: [
      'Max concurrent calls limits how many calls can be handled at once; decreasing may reject new calls.',
      'Call timeout determines when calls are automatically terminated.',
      'Retry attempts affect reliability of API and operations.'
    ]
  },
  CONVERSATION_BEHAVIOR: {
    title: 'Save conversation behavior',
    message: 'These settings control how the agent interacts during calls.',
    effects: [
      'Progress indicators, silence detection, and turn-taking affect the caller experience.',
      'Proactive assistance and error handling change when and how the agent responds.',
      'Incorrect values can make calls feel broken or unresponsive.'
    ]
  },
  AUDIO_TELEPHONY: {
    title: 'Save audio & telephony configuration',
    message: 'This will update voice, audio, and routing settings used on calls.',
    effects: [
      'VAD and padding control when the agent considers the user done speaking.',
      'Default voice and per-number profiles change how the agent sounds.',
      'Phone numbers, transfer numbers, and after-hours/voicemail affect routing and availability.'
    ]
  },
  PHONE_NUMBER: {
    title: 'Change phone number configuration',
    message: 'This will change which numbers reach the agent or how they are configured.',
    effects: ['Routing and availability for incoming and transfer calls may change.']
  },
  SIP_CONFIG: {
    title: 'Save SIP configuration',
    message: 'This will update SIP and media path settings.',
    effects: [
      'Wrong endpoint or credentials can prevent calls from connecting.',
      'Changing primary/fallback path or codec can affect call quality or break live calls.'
    ]
  },
  PRIVACY_RETENTION: {
    title: 'Save data retention settings',
    message: 'This will change how long data is retained before automatic deletion.',
    effects: [
      'Reducing retention will cause data to be deleted sooner; this cannot be undone.',
      'The agent and compliance tools may have access to less historical data.'
    ]
  },
  PRIVACY_CONSENT: {
    title: 'Save consent or privacy notice',
    message: 'This affects what callers are told about data use.',
    effects: ['Compliance and consent handling may change; ensure wording is correct.']
  },
  RESTORE_BACKUP: {
    title: 'Restore from backup',
    message: 'Restoring will overwrite current configurations.',
    effects: ['This will replace current configurations and can change how the agent and telephony behave.']
  }
};

export default AGENT_AFFECTING_WARNINGS;
