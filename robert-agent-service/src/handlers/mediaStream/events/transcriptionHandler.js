import configManager from '../../../agent/configManager.js';
import adaptiveTimingService from '../../../services/adaptiveTimingService.js';
import silenceDetectionService from '../../../services/silenceDetectionService.js';
import complaintDetectionService from '../../../services/complaintDetectionService.js';
import { LanguageDetector } from '../utils/languageDetector.js';

/**
 * Transcription Handler
 * Handles user transcriptions and speech stopped events
 */
export class TranscriptionHandler {
  constructor(stateManager, languageDetector, consentHandler, openaiWs) {
    this.state = stateManager;
    this.languageDetector = languageDetector;
    this.consentHandler = consentHandler;
    this.openaiWs = openaiWs;
  }

  /**
   * Handle transcription.completed event
   */
  async handleTranscriptionCompleted(event) {
    const transcript = event.transcript || '';
    const confidence = event.confidence || 1.0;
    const transcriptionTime = Date.now();
    console.log(`👤 User said: "${transcript}" (confidence: ${confidence})`);
    
    const { conversations } = await import('../../../shared/state.js');
    
    // Handle memory consent
    await this.consentHandler.handleMemoryConsent(transcript);
    
    // Handle recording consent
    await this.consentHandler.handleRecordingConsent(transcript);
    
    // Track when we received this transcription
    this.state.lastTranscriptionReceivedTime = Date.now();
    
    // Check if transcription arrived during agent response (barge-in via transcription)
    if (this.state.isResponding && this.state.activeResponseId) {
      const isNewInterruption = !this.state.isInterrupted;
      
      if (isNewInterruption) {
        console.log(`🛑 [${this.state.callSid}] Barge-in detected via transcription! User interrupted agent response ${this.state.activeResponseId}`);
      }
      
      // Set interruption flags
      this.state.isInterrupted = true;
      this.state.interruptionStartTime = Date.now();
      this.state.pendingTranscriptions = [];
      
      // Save IDs before clearing
      const responseIdToCancel = this.state.activeResponseId;
      
      // Mark response as cancelled
      if (responseIdToCancel) {
        this.state.cancelledResponseIds.add(responseIdToCancel);
        this.state.cancellationTime.set(responseIdToCancel, Date.now());
        console.log(`🚫 [${this.state.callSid}] Marked response ${responseIdToCancel} as cancelled (via transcription)`);
      }
      
      // Clear response tracking
      this.state.activeResponseId = null;
      this.state.responseItemId = null;
      this.state.responseStartTime = null;
      this.state.isResponding = false;
      this.state.waitingForUser = true;
      this.state.lastCancellationTime = Date.now();
      
      // Cancel response and clear buffer
      try {
        if (this.state.openaiWs && this.state.openaiWs.readyState === 1) {
          if (responseIdToCancel) {
            this.state.openaiWs.send(JSON.stringify({
              type: 'response.cancel',
              response_id: responseIdToCancel
            }));
          }
          this.state.openaiWs.send(JSON.stringify({
            type: 'input_audio_buffer.clear'
          }));
        }
      } catch (err) {
        console.warn(`⚠️ [${this.state.callSid}] Error cancelling response:`, err.message);
      }
      
      // Queue transcription for processing after speech ends
      this.state.pendingTranscriptions.push({
        transcript,
        confidence,
        time: transcriptionTime
      });
      return; // Don't process yet
    }
    
    // If we're in an interruption window, queue this transcription
    if (this.state.isInterrupted) {
      console.log(`⏸️ [${this.state.callSid}] Transcription received during interruption - queuing: "${transcript}"`);
      this.state.pendingTranscriptions.push({
        transcript,
        confidence,
        time: transcriptionTime
      });
      return;
    }
    
    // Check if this transcription is stale (from before interruption)
    if (transcriptionTime < this.state.interruptionStartTime && this.state.interruptionStartTime > 0) {
      console.log(`🗑️ [${this.state.callSid}] Ignoring stale transcription from before interruption: "${transcript}"`);
      return;
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
      return;
    }
    
    // Prevent user responses until initial greeting completes
    if (!this.state.hasInitialGreetingCompleted && !isRecentCancellation) {
      console.log(`⏳ [${this.state.callSid}] Waiting for initial greeting to complete before responding to: "${transcript}"`);
      return;
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
      
      // Detect and switch language if enabled
      if (conversations[this.state.callSid].languageDetectionEnabled && this.state.hasInitialGreetingCompleted) {
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
        
        // Check if it's a stop command
        const transcript = latestTranscription.transcript;
        const stopCommands = /\b(stop|wait|hold on|pause|shut up|be quiet|enough|that's enough)\b/i;
        const isStopCommand = stopCommands.test(transcript);
        
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
        // Clear interruption flag and wait for transcriptions to arrive
        console.log(`✅ [${this.state.callSid}] Speech ended after interruption (no transcriptions yet) - clearing interruption flag, will process transcriptions when they arrive`);
        this.state.isInterrupted = false;
        this.state.interruptionStartTime = 0;
        // Don't return - continue to normal flow to process transcriptions when they arrive
      }
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
          if (this.state.waitingForUser && !this.state.isResponding && this.state.activeResponseId === null && this.state.hasInitialGreetingCompleted) {
            try {
              this.state.explicitResponseRequested = true;
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
                
                // Step 2: Create response - OpenAI will generate naturally based on context
                const responseCreatePayload = {
                  type: 'response.create',
                  response: {
                    modalities: ['audio', 'text']
                  }
                };
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
            }
          }
        }
      }, gracePeriodMs);
      
      console.log(`⏱️ [${this.state.callSid}] Started grace period timer (${gracePeriodMs}ms) for speech continuation`);
    } else if (this.state.pendingTranscriptionsAfterGrace.length > 0) {
      // No grace period - process immediately
      const transcriptionsToProcess = [...this.state.pendingTranscriptionsAfterGrace];
      this.state.pendingTranscriptionsAfterGrace = [];
      
      return { type: 'process_transcriptions', transcriptions: transcriptionsToProcess };
    }
    
    return null;
  }
}

