# Test DB config vs robert-agent-service — gap analysis

Analysis of config collections in MongoDB `test` database and which are **fetched** and **utilised** by `robert-agent-service`. No code changes were made; this is analysis only.

---

## 1. Config collections in `test` database (from MongoDB MCP)

| Collection | Documents | Schema inferred |
|------------|-----------|-----------------|
| aiconfigs | ≥1 | name, globalPrompt, parameters (temperature, topP, maxTokens, speechRate), model (id, name, fallbackChain), voice, uncertaintyGate, responsesApi, mcpSettings, isActive |
| telephonyconfigs | ≥1 | name, numbers[], outboundCallerId, transferNumbers[], afterHoursPolicy, voicemailSettings, sipSettings, recordingSettings, maxConcurrentCalls, callTimeout, retryAttempts, logLevel, isActive, routingEnabled |
| audioconfigs | ≥1 | name, vadThreshold, startPadding, endPadding, bargeInPolicy, noiseSuppression, echoCancellation, automaticGainControl, audioQuality, defaultVoice, selectedModelId, transcriptionModel, temperature, topP, maxTokens, speechRate, usePerNumberProfiles, perNumberProfiles[], isActive |
| privacyconfigs | ≥1 | name, consentScript, retentionSettings, consentSettings, recording (requireExplicitConsent, etc.), privacyPolicy, lawfulBasis, ukGdprCompliance, isActive |
| crmtasksconfigs | ≥1 | name, tasks (createBooking, cancel: enabled, requireConfirmation), generalSettings (dryRunEnforced, auditLogging), isActive |
| toolconfigs | ≥1 | toolName, enabled, description, domains[], rateLimit, maxTime, usageCount, lastUsed |
| conversationbehaviorconfigs | ≥1 | progressIndicators, silenceDetection, conversationFlow, errorHandling, qualityMetrics, proactiveAssistance, isActive |
| languagevoicemappings | ≥1 | languageCode, languageName, localeCode, voiceId, voiceName, isActive |
| flowparameteroverrides | 0 | (empty collection; model has flowType, enabled, priority, parameters, model) |
| paymentgatewayconfigs | 0 | (empty; schema not inferred) |
| prompts | 0 | (empty) |
| voices | ≥1 | id, name, description, language, gender, provider, isDefault, isActive, capabilities, sampleText |

---

## 2. What the agent fetches (ConfigManager + ad-hoc)

- **ConfigManager (polled ~30s):** AIConfig, AudioConfig, TelephonyConfig, ToolConfig, ConversationBehaviorConfig, FlowParameterOverride, CRMTasksConfig. All via `findOne({ isActive: true })` or `find({})` / `find({ enabled: true })`.
- **multilingualService:** LanguageVoiceMapping — `find({ isActive: true })` in `loadLanguageMappings()` (cache TTL 60s). Not part of ConfigManager.
- **PrivacyConfig:** Not in ConfigManager. Fetched ad-hoc in: conversationService, callHandlers, openaiIntegration, gdprService, kbaService, crossCallMemoryService (each does its own `PrivacyConfig.findOne({ isActive: true })`).

---

## 3. Configs / fields NOT fetched or NOT utilised

### 3.1 Not loaded by agent at all

- **paymentgatewayconfigs** — Empty in test DB; agent has no model and no code referencing it. **Not fetched, not utilised.**
- **prompts** — Empty in test DB; agent uses promptService.getCorePrompt() and templates in code, not this collection. **Not utilised** (even if backend uses it).
- **voices** — Agent never queries the Voice model. Voice choice comes from AIConfig.voice, AudioConfig.defaultVoice, LanguageVoiceMapping.voiceId. **Not fetched by agent** (backend may use for admin UI).

### 3.2 SIP: DB vs env

- **sipService** (robert-agent-service) uses **only env**: `OPENAI_SIP_ENDPOINT`, `SIP_ENABLED`. It does **not** read TelephonyConfig.sipSettings.
- So these DB fields (from backend/API schema) are **not** used by the agent even if present in backend TelephonyConfig: `openaiSipEndpoint`, `openaiSipWebhookUrl`, `twilioSipTrunkSid`, `openaiSipEnabled`, `testConnectionStatus`. SIP behaviour in the agent is env-driven, not test DB config.

### 3.3 TelephonyConfig — fields in DB not used by agent

- **transferNumbers[]** — Human transfer uses `twilioCallBridgeService.defaultTargetNumber` (hardcoded `+442036918807`) when no target is passed. Agent does not read `telephonyConfig.transferNumbers` for the default transfer target. **Not utilised.**
- **afterHoursPolicy** — Defined in schema and in test DB. No references in robert-agent-service. **Not utilised** (likely used by backend for routing/webhook).
- **recordingSettings** — Present in TelephonyConfig schema/DB. Agent uses PrivacyConfig for consent (consentScript, recording.requireExplicitConsent). No code reads `telephonyConfig.recordingSettings`. **Not utilised.**
- **numbers[]** — Routing table (number, route, status). Not referenced in agent. **Not utilised** (backend/webhook routing).

### 3.4 AudioConfig — fields in DB not used by agent

Agent uses: vadThreshold, startPadding, endPadding, defaultVoice, usePerNumberProfiles, perNumberProfiles, temperature (via getConfigForNumber).  
**Not used in agent (schema/DB exist):** bargeInPolicy, noiseSuppression, noiseSuppressionAlgorithm, echoCancellation, automaticGainControl, audioQuality, energyThreshold, energyThresholdAutoCalibrate, selectedModelId, transcriptionModel, speechRate (and topP, maxTokens at Audio level for session — model params come from AIConfig in getConfigForNumber).

### 3.5 AIConfig — fields in DB not used by agent

- **globalPrompt** — Agent uses promptService.getCorePrompt() (in-code), not AIConfig.globalPrompt. **Not utilised** for session instructions.
- **parameters.speechRate** — Not read in configManager.getConfigForNumber or session.update. **Not utilised.**

### 3.6 PrivacyConfig — usage vs DB fields

- **Used:** consentScript, retentionSettings (transcriptRetention, recordingRetention, metadataRetention), recording.requireExplicitConsent (and consent flow).
- **Unused by agent (present in DB):** consentSettings (optOutAllowed, optOutEmailRoute, requireExplicitConsent), lawfulBasis, ukGdprCompliance, privacyPolicy. These are not read in robert-agent-service (may be for admin/compliance display or backend).

### 3.7 FlowParameterOverrides

- Collection is **empty** in test DB. ConfigManager **does** refresh and use it; openaiIntegration calls `getEffectiveParameters(flowType, aiConfig)`. So the **code path is used**; only the data is missing. If you add documents, they will be respected.

---

## 4. Summary table

| Source | Fetched by agent? | Utilised by agent? | Notes |
|--------|-------------------|--------------------|--------|
| aiconfigs | Yes (ConfigManager) | Yes | globalPrompt, parameters.speechRate not used |
| telephonyconfigs | Yes | Partial | sipSettings (SIP), transferNumbers, afterHoursPolicy, recordingSettings, numbers not used |
| audioconfigs | Yes | Partial | bargeInPolicy, noise*, echo*, AGC, audioQuality, energy*, selectedModelId, transcriptionModel, speechRate not used |
| privacyconfigs | Ad-hoc (no cache) | Partial | consentScript, retentionSettings, recording.requireExplicitConsent used; consentSettings, lawfulBasis, ukGdprCompliance, privacyPolicy not used |
| crmtasksconfigs | Yes | Yes | — |
| toolconfigs | Yes | Yes | — |
| conversationbehaviorconfigs | Yes | Yes | — |
| languagevoicemappings | Yes (multilingualService) | Yes | — |
| flowparameteroverrides | Yes | Yes (when data exists) | Collection empty in test DB |
| paymentgatewayconfigs | No | No | Empty; no model in agent |
| prompts | No | No | Empty; agent uses in-code prompts |
| voices | No | No | Agent uses voice ids from other configs only |

---

## 5. Recommendations (for when you choose to implement)

1. **Use DB for SIP in agent** — If you want test (or any) DB to drive SIP: in sipService (or a small config layer), read TelephonyConfig.sipSettings (openaiSipEnabled, openaiSipEndpoint, etc.) with env fallback, and use that instead of only env.
2. **Use transferNumbers for human transfer** — In twilioCallBridgeService, resolve default transfer target from `telephonyConfig.transferNumbers` (e.g. first active entry) instead of hardcoded default.
3. **Use afterHoursPolicy in agent** — Only if the agent should enforce after-hours (e.g. play message or redirect); otherwise leave to backend.
4. **Use TelephonyConfig.recordingSettings** — If you want a single source of truth for recording (enabled, consent message, retention), wire agent to use it (or align with PrivacyConfig and document which wins).
5. **PrivacyConfig in ConfigManager** — Add refreshPrivacyConfig + cache and use it everywhere that currently does ad-hoc PrivacyConfig.findOne, so consent and retention are consistent and cached.
6. **Optional: AIConfig.globalPrompt** — If you want DB-driven system prompt, add a path (e.g. in promptService) to use AIConfig.globalPrompt when set, with fallback to getCorePrompt().
7. **AudioConfig** — Wire bargeInPolicy, noiseSuppression, echoCancellation, etc. into audioProcessor / VAD / pipeline if you need DB-controlled behaviour.
8. **Payment / prompts / voices** — Add loading and usage only if product requires agent to use paymentgatewayconfigs, prompts collection, or Voice model at runtime.

---

**Document generated from:** MongoDB MCP (test DB) + robert-agent-service codebase search. No code was changed. Implement only after approval.
