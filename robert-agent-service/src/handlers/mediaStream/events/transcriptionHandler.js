import configManager from '../../../agent/configManager.js';
import adaptiveTimingService from '../../../services/adaptiveTimingService.js';
import silenceDetectionService from '../../../services/silenceDetectionService.js';
import complaintDetectionService from '../../../services/complaintDetectionService.js';
import promptService from '../../../services/promptService.js';
import { LanguageDetector } from '../utils/languageDetector.js';

/**
 * Transcription Handler
 * Handles user transcriptions and speech stopped events
 */
export class TranscriptionHandler {
  constructor(stateManager, languageDetector, consentHandler, openaiWs, bargeInHandler = null) {
    this.state = stateManager;
    this.languageDetector = languageDetector;
    this.consentHandler = consentHandler;
    this.openaiWs = openaiWs;
    this.bargeInHandler = bargeInHandler; // Reference to BargeInHandler for conditional barge-in
  }

  /**
   * Handle transcription.completed event
   */
  async handleTranscriptionCompleted(event) {
    const transcript = event.transcript || '';
    const confidence = event.confidence || 1.0;
    const transcriptionTime = Date.now();
    
    // CRITICAL: Filter out unclear/empty transcriptions and background noise
    // Minimum confidence threshold: 0.6 (60%) to filter out background noise
    const MIN_CONFIDENCE_THRESHOLD = 0.6;
    const MIN_TRANSCRIPT_LENGTH = 2; // Minimum 2 characters (to filter out single letters/noise)
    
    // Check if transcription is too unclear or empty
    const isUnclear = !transcript || transcript.trim().length < MIN_TRANSCRIPT_LENGTH;
    const isLowConfidence = confidence < MIN_CONFIDENCE_THRESHOLD;
    
    // Log ALL transcriptions (even filtered ones) for debugging
    if (isUnclear || isLowConfidence) {
      console.log(`🔇 [${this.state.callSid}] Ignoring unclear/low-confidence transcription: "${transcript}" (confidence: ${confidence}, threshold: ${MIN_CONFIDENCE_THRESHOLD})`);
      return { processed: false, shouldCreateResponse: false, reason: isUnclear ? 'unclear' : 'low_confidence' }; // Return early - don't process unclear transcriptions
    }
    
    console.log(`👤 User said: "${transcript}" (confidence: ${confidence})`);
    
    const { conversations } = await import('../../../shared/state.js');
    
    // Handle memory consent
    await this.consentHandler.handleMemoryConsent(transcript);
    
    // Handle recording consent
    await this.consentHandler.handleRecordingConsent(transcript);
    
    // Track when we received this transcription
    this.state.lastTranscriptionReceivedTime = Date.now();
    
    // CRITICAL: Check for "stop" command FIRST - if audio is playing and transcript contains "stop", trigger barge-in IMMEDIATELY
    // Use word boundary regex to match "stop" as a word (not substring like "stopped")
    const stopPattern = /\bstop\b/i;
    const containsStop = stopPattern.test(transcript);
    
    // Check if audio is currently playing (multiple indicators to catch all cases)
    // Audio might still be playing even if isResponding is false (buffered audio)
    const hasActiveResponse = this.state.activeResponseId !== null;
    const hasAudioPacer = this.state.outboundAudioPacer !== null;
    const hasBufferedAudio = this.state.outboundAudioBuffer !== null && this.state.outboundAudioBuffer.length > 0;
    const hasRecentAudio = this.state.lastAudioChunkTime > 0 && (Date.now() - this.state.lastAudioChunkTime) < 5000; // Audio sent within last 5 seconds
    const isAudioPlaying = this.state.isResponding || hasActiveResponse || hasAudioPacer || hasBufferedAudio || hasRecentAudio;
    
    // Log detection details for debugging when "stop" is detected
    if (containsStop) {
      console.log(`🔍 [${this.state.callSid}] "stop" detected in transcript: "${transcript}"`);
      console.log(`   - isResponding: ${this.state.isResponding}`);
      console.log(`   - activeResponseId: ${this.state.activeResponseId}`);
      console.log(`   - hasAudioPacer: ${hasAudioPacer}`);
      console.log(`   - hasBufferedAudio: ${hasBufferedAudio} (buffer length: ${this.state.outboundAudioBuffer?.length || 0})`);
      console.log(`   - hasRecentAudio: ${hasRecentAudio} (lastAudioChunkTime: ${this.state.lastAudioChunkTime}, age: ${this.state.lastAudioChunkTime > 0 ? Date.now() - this.state.lastAudioChunkTime : 'N/A'}ms)`);
      console.log(`   - isAudioPlaying: ${isAudioPlaying}`);
    }
    
    // EDGE CASE 1: Handle transcription that arrives while audio is playing and contains "stop"
    // CRITICAL: Trigger barge-in IMMEDIATELY (within milliseconds) if audio is playing
    if (isAudioPlaying && containsStop) {
      console.log(`🛑 [${this.state.callSid}] Barge-in triggered: "stop" detected while audio is playing`);
      // CRITICAL: Trigger barge-in IMMEDIATELY (within milliseconds)
      // This executes synchronously - audio stops immediately, response is cancelled immediately
      if (this.bargeInHandler) {
        this.bargeInHandler.triggerBargeInFromTranscription(transcript);
      } else {
        console.warn(`⚠️ [${this.state.callSid}] BargeInHandler not available - cannot trigger barge-in for "stop" command`);
      }
      
      // Queue transcription for processing after speech ends
      this.state.pendingTranscriptions.push({
        transcript,
        confidence,
        time: transcriptionTime
      });
      return { processed: true, shouldCreateResponse: false }; // Don't process yet - wait for speech_stopped
    }
    
    // EDGE CASE 2: Transcription arrives but audio is playing and transcript does NOT contain "stop"
    // Let audio continue normally - this is a normal interruption, not a stop command
    // CRITICAL: Don't create responses when audio is playing (unless "stop" was detected)
    if (isAudioPlaying && !containsStop) {
      // Clear pendingBargeInCheck flag since we've processed the transcription
      if (this.state.pendingBargeInCheck) {
        this.state.pendingBargeInCheck = false;
        console.log(`👂 [${this.state.callSid}] Transcription received during audio playback but does not contain "stop" - audio continues, NO response created: "${transcript}"`);
      }
      // Return early - don't create responses when audio is playing
      return { processed: true, shouldCreateResponse: false };
    }
    
    // EDGE CASE 3: Transcription arrives but audio is NOT playing
    // If transcription contains "stop" but audio is not playing, it's not a barge-in scenario
    if (!isAudioPlaying && containsStop) {
      console.log(`📝 [${this.state.callSid}] Transcription contains "stop" but audio is not playing - normal processing: "${transcript}"`);
      // Continue normal processing
    }
    
    // If we're in an interruption window, queue this transcription
    if (this.state.isInterrupted) {
      console.log(`⏸️ [${this.state.callSid}] Transcription received during interruption - queuing: "${transcript}"`);
      this.state.pendingTranscriptions.push({
        transcript,
        confidence,
        time: transcriptionTime
      });
      return { processed: true, shouldCreateResponse: false };
    }
    
    // Check if this transcription is stale (from before interruption)
    if (transcriptionTime < this.state.interruptionStartTime && this.state.interruptionStartTime > 0) {
      console.log(`🗑️ [${this.state.callSid}] Ignoring stale transcription from before interruption: "${transcript}"`);
      return { processed: false, shouldCreateResponse: false, reason: 'stale' };
    }
    
    // Check for stop commands
    const timeSinceCancellation = Date.now() - this.state.lastCancellationTime;
    const isRecentCancellation = this.state.lastCancellationTime > 0 && timeSinceCancellation < 3000;
    const stopCommands = /\b(stop|wait|hold on|pause|shut up|be quiet|enough|that's enough)\b/i;
    const isStopCommand = stopCommands.test(transcript);
    
    if (isRecentCancellation && isStopCommand) {
      console.log(`🛑 [${this.state.callSid}] Stop command detected: "${transcript}" - entering listening mode`);
      this.state.waitingForUser = true;
      this.state.lastCancellationTime = 0;
      this.state.isInterrupted = false;
      this.state.interruptionStartTime = 0;
      return { processed: true, shouldCreateResponse: false };
    }
    
    // Prevent user responses until initial greeting completes
    if (!this.state.hasInitialGreetingCompleted && !isRecentCancellation) {
      console.log(`⏳ [${this.state.callSid}] Waiting for initial greeting to complete before responding to: "${transcript}"`);
      return { processed: true, shouldCreateResponse: false };
    }
    
    // Add user transcription to conversation transcript
    if (transcript && conversations[this.state.callSid]) {
      conversations[this.state.callSid].transcript.push({
        role: 'user',
        text: transcript,
        timestamp: new Date(transcriptionTime)
      });
      
      // Reset silence detection
      const conversationBehaviorConfig = configManager.getConversationBehaviorConfig();
      if (conversationBehaviorConfig?.silenceDetection?.enabled) {
        silenceDetectionService.userSpoke(this.state.callSid);
      }
      
      // Track user transcription for adaptive timing
      if (this.state.userSpeechStartedTime === 0 || Math.abs(transcriptionTime - this.state.userSpeechStartedTime) > 1000) {
        adaptiveTimingService.trackCallerBehavior(this.state.callSid, 'user_spoke', transcriptionTime);
      }
      
      // Detect and switch language if waiting for language preference OR if language detection is enabled
      const waitingForLanguage = this.state.waitingForLanguage || conversations[this.state.callSid]?.waitingForLanguage || false;
      const languageSelected = this.state.languagePreferenceState?.selected || conversations[this.state.callSid]?.languagePreferenceState?.selected || false;
      
      if (waitingForLanguage && !languageSelected) {
        // CRITICAL: Handle language preference selection
        await this.languageDetector.detectAndSwitchLanguage(transcript);
      } else if (conversations[this.state.callSid].languageDetectionEnabled && this.state.hasInitialGreetingCompleted) {
        // Mid-call language switching (after initial greeting)
        await this.languageDetector.detectAndSwitchLanguage(transcript);
        conversations[this.state.callSid].languageDetectionEnabled = false;
      }
      
      // Monitor for complaint keywords
      const complaintDetection = complaintDetectionService.monitorCall(this.state.callSid);
      if (complaintDetection && complaintDetection.detected) {
        console.log(`⚠️ [${this.state.callSid}] Complaint detected: ${complaintDetection.riskLevel} risk, type: ${complaintDetection.complaintType}`);
        
        if (!conversations[this.state.callSid].complaintDetected) {
          conversations[this.state.callSid].complaintDetected = {
            detected: true,
            riskLevel: complaintDetection.riskLevel,
            complaintType: complaintDetection.complaintType,
            keywords: complaintDetection.keywords,
            detectedAt: new Date()
          };
        }
      }
    }
    
    // Store transcription for processing after grace period
    if (transcript && transcript !== this.state.lastUserTranscript) {
      if (!this.state.pendingTranscriptionsAfterGrace.find(t => t.transcript === transcript)) {
        this.state.pendingTranscriptionsAfterGrace.push({
          transcript,
          confidence,
          time: transcriptionTime
        });
        console.log(`📝 [${this.state.callSid}] Stored transcription for processing after grace period: "${transcript}"`);
      }
    }
    
    // Update last processed transcription time
    this.state.lastProcessedTranscriptionTime = transcriptionTime;
    
    // Return flag indicating transcription was processed and response can be created (if audio is not playing)
    return { processed: true, shouldCreateResponse: !isAudioPlaying };
  }

  /**
   * Handle speech_stopped event
   */
  async handleSpeechStopped(event) {
    const conversationBehaviorConfig = configManager.getConversationBehaviorConfig();
    const speechContinuation = conversationBehaviorConfig?.conversationFlow?.speechContinuation;
    
    // Track when speech stopped
    this.state.speechStoppedTime = Date.now();
    
    // Handle interruption case
    if (this.state.isInterrupted) {
      if (this.state.pendingTranscriptions.length > 0) {
        // We have transcriptions - process them
        const latestTranscription = this.state.pendingTranscriptions[this.state.pendingTranscriptions.length - 1];
        console.log(`✅ [${this.state.callSid}] Speech ended after interruption - acknowledging interruption first`);
        
        // Clear interruption flag
        this.state.isInterrupted = false;
        this.state.interruptionStartTime = 0;
        
        // Check if it's a stop command (only "stop" word)
        const transcript = latestTranscription.transcript;
        const stopPattern = /\bstop\b/i; // Only match "stop" as a word (not substring like "stopped")
        const isStopCommand = stopPattern.test(transcript);
        
        if (isStopCommand) {
          console.log(`🛑 [${this.state.callSid}] Stop command detected: "${transcript}" - entering listening mode`);
          this.state.waitingForUser = true;
          this.state.lastCancellationTime = 0;
          this.state.pendingTranscriptions = [];
          return;
        }
        
        this.state.pendingTranscriptions = [];
        
        // Acknowledge interruption (will be handled by tool coordinator)
        return { type: 'acknowledge_interruption' };
      } else {
        // Barge-in detected via speech_started but no transcriptions yet
        // CRITICAL: Keep interruption flag SET until transcriptions arrive
        // Don't clear flag - wait for transcriptions to process stop commands
        console.log(`⏸️ [${this.state.callSid}] Speech ended after interruption (no transcriptions yet) - KEEPING interruption flag set, waiting for transcriptions to arrive`);
        // DON'T clear interruption flag - keep it set to prevent new responses
        // Return early to prevent normal flow from creating responses
        return null; // Wait for transcriptions to arrive
      }
    }
    
    // CRITICAL: Don't process pending transcriptions if interrupted
    if (this.state.isInterrupted) {
      console.log(`🛑 [${this.state.callSid}] Skipping transcription processing - user has interrupted`);
      return null;
    }
    
    // Handle normal speech continuation grace period
    if (speechContinuation?.enabled && this.state.pendingTranscriptionsAfterGrace.length > 0) {
      const gracePeriodMs = speechContinuation.gracePeriodMs || 1500;
      
      // Start grace period timer
      this.state.speechContinuationGraceTimer = setTimeout(async () => {
        if (!this.state.speechResumedDuringGrace && this.state.pendingTranscriptionsAfterGrace.length > 0) {
          // Process transcriptions after grace period
          const transcriptionsToProcess = [...this.state.pendingTranscriptionsAfterGrace];
          this.state.pendingTranscriptionsAfterGrace = [];
          this.state.speechResumedDuringGrace = false;
          this.state.gracePeriodExtensionCount = 0;
          
          console.log(`✅ [${this.state.callSid}] Grace period expired - processing ${transcriptionsToProcess.length} transcriptions`);
          
          // Create response immediately if agent is waiting
          // CRITICAL: Use atomic lock to prevent concurrent response creation
          // CRITICAL: Don't create response if user has interrupted
          if (this.state.waitingForUser && this.state.hasInitialGreetingCompleted && !this.state.isInterrupted && this.state.tryAcquireResponseLock()) {
            try {
              // Lock acquired - proceed with response creation
              // Double-check interruption state before sending
              if (this.state.isInterrupted) {
                console.log(`🛑 [${this.state.callSid}] Skipping response creation after grace period - user interrupted`);
                this.state.releaseResponseLock();
                return;
              }

              if (this.openaiWs && this.openaiWs.readyState === 1) {
                // CRITICAL FIX: Temporarily disable tools to ensure natural language response
                // Step 1: Disable tools
                this.openaiWs.send(JSON.stringify({
                  type: 'session.update',
                  session: {
                    tool_choice: 'none'
                  }
                }));
                
                await new Promise(resolve => setTimeout(resolve, 150));
                
                // Step 2: Create response - PHASE 1: Include contextual instructions to prevent code generation
                // Determine workflow phase from state (pass callSid to access booking session)
                const workflowPhase = await promptService.determineWorkflowPhase(this.state, this.state.callSid);
                
                // Get active tool name if available
                const activeToolName = this.state.activeToolName || null;
                
                // Get booking session info if available
                const { conversations } = await import('../../../shared/state.js');
                let courseType = null;
                let workflowType = null;
                let currentStep = null;
                
                if (this.state.callSid && conversations[this.state.callSid]?.bookingSession) {
                  const bookingSession = conversations[this.state.callSid].bookingSession;
                  courseType = bookingSession.courseType;
                  workflowType = bookingSession.workflowType;
                  currentStep = bookingSession.currentStep;
                }
                
                // Get contextual instructions for this response
                const responseInstructions = promptService.getContextualInstructions({
                  isInitialGreeting: false,
                  workflowPhase,
                  courseType,
                  workflowType,
                  currentStep,
                  activeTool: activeToolName
                });
                
                const responseCreatePayload = {
                  type: 'response.create',
                  response: {
                    modalities: ['audio', 'text']
                  }
                };
                
                // PHASE 1: Include contextual instructions to prevent model from using full prompt
                if (responseInstructions) {
                  responseCreatePayload.response.instructions = responseInstructions;
                  console.log(`📋 [${this.state.callSid}] Including contextual instructions in response.create after grace period (phase: ${workflowPhase})`);
                }
                
                this.openaiWs.send(JSON.stringify(responseCreatePayload));
                
                // Step 3: Re-enable tools after delay
                setTimeout(() => {
                  if (this.openaiWs && this.openaiWs.readyState === 1) {
                    this.openaiWs.send(JSON.stringify({
                      type: 'session.update',
                      session: {
                        tool_choice: 'auto'
                  }
                }));
                  }
                }, 3000);
                
                console.log(`🎯 [${this.state.callSid}] Created response after grace period (${transcriptionsToProcess.length} transcriptions)`);
              }
            } catch (err) {
              console.error(`❌ [${this.state.callSid}] Error creating response after grace period:`, err);
              // Release lock on error
              this.state.releaseResponseLock();
            }
          }
        }
      }, gracePeriodMs);
      
      console.log(`⏱️ [${this.state.callSid}] Started grace period timer (${gracePeriodMs}ms) for speech continuation`);
    } else if (this.state.pendingTranscriptionsAfterGrace.length > 0) {
      // CRITICAL: Don't process if interrupted
      if (this.state.isInterrupted) {
        console.log(`🛑 [${this.state.callSid}] Skipping immediate transcription processing - user has interrupted`);
        return null;
      }
      // No grace period - process immediately
      const transcriptionsToProcess = [...this.state.pendingTranscriptionsAfterGrace];
      this.state.pendingTranscriptionsAfterGrace = [];
      
      return { type: 'process_transcriptions', transcriptions: transcriptionsToProcess };
    }
    
    return null;
  }
}
