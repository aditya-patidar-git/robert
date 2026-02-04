/**
 * Requirements matrix: maps 12 §14 acceptance criteria to verification steps (unit/integration tests).
 * Aggregator matches by testFile (path) and assertionName (Jest fullName contains this).
 */
export const requirementsMatrix = {
  requirement_1_pickup: {
    description: 'Call pickup latency < 2s (§14.1)',
    verification: [
      { type: 'integration', testFile: 'tests/integration/timing-critical.test.js', assertionName: 'measures p95 latency < 2s' },
      { type: 'unit', testFile: 'tests/unit/services/conversationService.test.js', assertionName: 'returns instructions for initial greeting when consent not given' }
    ],
    evidenceRequired: ['logs', 'metrics'],
    acceptanceCriteria: 'Inbound answers <2.0s; greeting played.'
  },
  requirement_2_barge_in: {
    description: 'Barge-in halt < 200ms (§14.2)',
    verification: [
      { type: 'unit', testFile: 'tests/unit/handlers/bargeInHandler.test.js', assertionName: 'sets interrupted flag when triggerImmediateBargeIn is called' },
      { type: 'unit', testFile: 'tests/unit/handlers/bargeInHandler.test.js', assertionName: 'cancels OpenAI response on interruption when activeResponseId is set' },
      { type: 'integration', testFile: 'tests/integration/timing-critical.test.js', assertionName: 'halts TTS within 200ms' }
    ],
    evidenceRequired: ['logs', 'audio_recordings'],
    acceptanceCriteria: 'Caller speech interrupts TTS; stop within 200ms.'
  },
  requirement_3_vad: {
    description: 'VAD thresholds 500-700ms (§14.3)',
    verification: [
      { type: 'unit', testFile: 'tests/unit/config/vadConfig.test.js', assertionName: 'uses correct threshold range (500-700ms)' },
      { type: 'unit', testFile: 'tests/unit/config/vadConfig.test.js', assertionName: 'has correct padding values' },
      { type: 'integration', testFile: 'tests/integration/timing-critical.test.js', assertionName: 'detects silence correctly' }
    ],
    evidenceRequired: ['logs', 'config_snapshot'],
    acceptanceCriteria: 'No over-talk; no tail-cut; padding prevents clipping.'
  },
  requirement_4_kb_retrieval: {
    description: 'KB retrieval with citation (§14.4)',
    verification: [
      { type: 'unit', testFile: 'tests/unit/services/conversationService.test.js', assertionName: 'returns instructions for subsequent response' }
    ],
    evidenceRequired: ['logs', 'transcript'],
    acceptanceCriteria: 'File Search returns correct passage; cited in speech.'
  },
  requirement_5_web_search: {
    description: 'Web search with announcement (§14.5)',
    verification: [
      { type: 'unit', testFile: 'tests/unit/services/kbaService.test.js', assertionName: 'returns false for web_search' }
    ],
    evidenceRequired: ['logs', 'transcript'],
    acceptanceCriteria: 'MCP web_search with prior disclosure; result grounded.'
  },
  requirement_6_crm_tasking: {
    description: 'CRM booking with KBA + dry-run (§14.6)',
    verification: [
      { type: 'unit', testFile: 'tests/unit/services/kbaService.test.js', assertionName: 'returns true for reschedule_booking' },
      { type: 'unit', testFile: 'tests/unit/services/kbaService.test.js', assertionName: 'returns true for update_customer' },
      { type: 'unit', testFile: 'tests/unit/services/toolExecutionService.test.js', assertionName: 'returns true for duplicate call with same params' }
    ],
    evidenceRequired: ['logs', 'transcript', 'crm_screenshot'],
    acceptanceCriteria: 'KBA, dry-run diff, confirmation, commit, DOM assert.'
  },
  requirement_7_human_transfer: {
    description: 'Human transfer with DTMF (§14.7)',
    verification: [
      { type: 'unit', testFile: 'tests/unit/services/kbaService.test.js', assertionName: 'returns true for transfer_call' },
      { type: 'integration', testFile: 'tests/integration/human-transfer.test.js', assertionName: 'bridges call successfully' }
    ],
    evidenceRequired: ['logs', 'call_log', 'recording'],
    acceptanceCriteria: 'DTMF capture; bridge success.'
  },
  requirement_8_memory: {
    description: 'Cross-call memory with consent (§14.8)',
    verification: [
      { type: 'unit', testFile: 'tests/unit/services/memoryService.test.js', assertionName: 'stores call summary and retrieves previous calls' },
      { type: 'unit', testFile: 'tests/unit/services/memoryService.test.js', assertionName: 'recalls preferences across calls' }
    ],
    evidenceRequired: ['logs', 'database_snapshot'],
    acceptanceCriteria: 'Preference set in call 1; recalled in call 2 after consent.'
  },
  requirement_9_concurrency: {
    description: '20 concurrent calls, p95 < 3s (§14.9)',
    verification: [
      { type: 'integration', testFile: 'tests/integration/concurrency.test.js', assertionName: 'handles 20 simultaneous calls' }
    ],
    evidenceRequired: ['logs', 'metrics', 'voice_insights'],
    acceptanceCriteria: '20 simultaneous calls; p95 within target; no cross-talk.'
  },
  requirement_10_error_paths: {
    description: 'Graceful error handling (§14.10)',
    verification: [
      { type: 'unit', testFile: 'tests/unit/services/conversationService.test.js', assertionName: 'returns false when quality score is below 0.7' }
    ],
    evidenceRequired: ['logs', 'error_screenshots'],
    acceptanceCriteria: 'OpenAI 5xx / stream drop handled; retry; voicemail fallback.'
  },
  requirement_11_gdpr: {
    description: 'DSAR export/delete (§14.11)',
    verification: [
      { type: 'unit', testFile: 'tests/unit/services/gdprService.test.js', assertionName: 'returns export structure with requestId and data' },
      { type: 'unit', testFile: 'tests/unit/services/gdprService.test.js', assertionName: 'processes export action' }
    ],
    evidenceRequired: ['logs', 'export_file', 'deletion_proof'],
    acceptanceCriteria: 'Export transcript & metadata; delete on request; retention respected.'
  },
  requirement_12_security: {
    description: 'No secrets in bundles/logs (§14.12)',
    verification: [
      { type: 'unit', testFile: 'tests/unit/security/secrets.test.js', assertionName: 'does not find hardcoded API keys in .js source files' },
      { type: 'unit', testFile: 'tests/unit/security/secrets.test.js', assertionName: 'does not find sk- prefixed keys in test helpers' }
    ],
    evidenceRequired: ['scan_results', 'bundle_analysis'],
    acceptanceCriteria: 'No secrets in logs or bundles; PII masking; Argon2id.'
  },
  requirement_13_multilingual: {
    description: 'Multilingual: ask language; detect reply; switch language/voice',
    verification: [
      { type: 'integration', testFile: 'tests/integration/language-switch.test.js', assertionName: 'greeting instructions include language question' },
      { type: 'integration', testFile: 'tests/integration/language-switch.test.js', assertionName: 'call connects and accepts language response' }
    ],
    evidenceRequired: ['logs', 'transcript'],
    acceptanceCriteria: 'Greeting asks language; French (or other) reply triggers switch.'
  },
  requirement_14_recording_consent: {
    description: 'Recording consent: announce recording; honour opt-out',
    verification: [
      { type: 'unit', testFile: 'tests/unit/services/consentInstructionBuilder.test.js', assertionName: 'buildConsentFlowInstructions includes recording notice' },
      { type: 'unit', testFile: 'tests/unit/services/consentInstructionBuilder.test.js', assertionName: 'buildSessionInstructions includes recording notice' }
    ],
    evidenceRequired: ['logs', 'transcript'],
    acceptanceCriteria: 'Recording announced; opt-out honoured.'
  },
  requirement_15_failfast_secrets: {
    description: 'Fail-fast on missing secrets at boot',
    verification: [
      { type: 'unit', testFile: 'tests/unit/services/secretsManager.test.js', assertionName: 'validateSecrets throws when a required secret is missing' }
    ],
    evidenceRequired: ['logs'],
    acceptanceCriteria: 'Process throws on missing required secret.'
  },
  requirement_16_ssrf_dom: {
    description: 'SSRF/DOM injection defended in browser agent',
    verification: [
      { type: 'unit', testFile: 'tests/unit/services/urlValidation.test.js', assertionName: 'rejects javascript: protocol' },
      { type: 'unit', testFile: 'tests/unit/services/urlValidation.test.js', assertionName: 'rejects file: protocol' },
      { type: 'unit', testFile: 'tests/unit/services/urlValidation.test.js', assertionName: 'rejects private IP localhost' },
      { type: 'unit', testFile: 'tests/unit/services/urlValidation.test.js', assertionName: 'rejects domain not in allowed list' }
    ],
    evidenceRequired: ['logs'],
    acceptanceCriteria: 'Malicious URLs and script payloads rejected or sanitized.'
  },
  requirement_17_postcall_logging: {
    description: 'Post-call logging (structured call record / outcome)',
    verification: [
      { type: 'unit', testFile: 'tests/unit/services/summaryService.test.js', assertionName: 'produces structured call record with outcome and keyFacts' },
      { type: 'unit', testFile: 'tests/unit/services/summaryService.test.js', assertionName: 'validateOutcome returns only allowed outcome values' }
    ],
    evidenceRequired: ['logs', 'call_record'],
    acceptanceCriteria: 'Structured record with outcome, tool trace after call end.'
  },
  requirement_18_voicemail_fallback: {
    description: 'Voicemail fallback on unrecoverable error',
    verification: [
      { type: 'unit', testFile: 'tests/unit/services/errorRecoveryService.test.js', assertionName: 'handleToolError returns shouldFallbackToVoicemail for OpenAI 5xx' },
      { type: 'unit', testFile: 'tests/unit/services/errorRecoveryService.test.js', assertionName: 'handleToolError returns shouldFallbackToVoicemail for Twilio stream drop' }
    ],
    evidenceRequired: ['logs'],
    acceptanceCriteria: '5xx/stream drop triggers voicemail or redirect.'
  },
  requirement_19_crm_confirmation: {
    description: 'CRM confirmation sent (SMS/email) after success',
    verification: [
      { type: 'unit', testFile: 'tests/unit/services/sendConfirmation.test.js', assertionName: 'returns confirmationSent true after successful send' }
    ],
    evidenceRequired: ['logs', 'crm_screenshot'],
    acceptanceCriteria: 'After CRM commit, sendSMS/sendConfirmation invoked.'
  },
  requirement_20_session_revocation: {
    description: 'Session revocation on user status change',
    verification: [
      { type: 'unit', testFile: 'tests/unit/services/sessionManagementService.test.js', assertionName: 'deleteSession revokes session and removes it from storage' }
    ],
    evidenceRequired: ['logs'],
    acceptanceCriteria: 'Sessions revoked/invalidated when user deactivated.'
  },
  requirement_21_uncertainty_gate: {
    description: 'Uncertainty gate (no ungrounded answers; ask or decline)',
    verification: [
      { type: 'unit', testFile: 'tests/unit/services/conversationService.test.js', assertionName: 'withholds response when confidence is low (uncertainty gate)' },
      { type: 'unit', testFile: 'tests/unit/services/conversationService.test.js', assertionName: 'returns false when quality score is below 0.7' }
    ],
    evidenceRequired: ['logs', 'transcript'],
    acceptanceCriteria: 'Low confidence: response withheld or clarify/transfer offered.'
  }
};

export default requirementsMatrix;
