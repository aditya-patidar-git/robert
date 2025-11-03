import EscalationLog from '../models/EscalationLog.js';
import CallRecord from '../models/CallRecord.js';
import twilio from 'twilio';

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

class EscalationService {
  constructor() {
    this.targetNumber = '+442036918807'; // From documentation
  }

  // Initiate human transfer escalation
  async initiateEscalation(callData) {
    try {
      const {
        callId,
        callSid,
        reason = 'user_request',
        summary,
        confidenceScore = 0.5,
        uncertaintyGateTriggered = false,
        kbSourcesUsed = [],
        toolsAttempted = []
      } = callData;

      // Create escalation log
      const escalation = new EscalationLog({
        callId,
        callSid,
        from: 'AI Agent',
        to: 'Human Agent',
        reason,
        summary: summary || 'Customer requested human assistance',
        targetNumber: this.targetNumber,
        escalationStatus: 'initiated',
        metadata: {
          confidenceScore,
          uncertaintyGateTriggered,
          kbSourcesUsed,
          toolsAttempted
        }
      });

      await escalation.save();

      // Update call record
      await CallRecord.findOneAndUpdate(
        { callSid },
        {
          'escalation.escalated': true,
          'escalation.reason': reason,
          'escalation.targetNumber': this.targetNumber,
          'escalation.handoverSummary': summary,
          'escalation.escalatedAt': new Date(),
          result: 'escalated'
        }
      );

      console.log(`📞 Escalation initiated for call ${callSid}: ${reason}`);

      return escalation;

    } catch (error) {
      console.error('Error initiating escalation:', error);
      throw new Error(`Failed to initiate escalation: ${error.message}`);
    }
  }

  // Complete escalation (when human takes over)
  async completeEscalation(callSid, resolution = '') {
    try {
      const escalation = await EscalationLog.findOneAndUpdate(
        { callSid, escalationStatus: 'in_progress' },
        {
          escalationStatus: 'completed',
          completedAt: new Date(),
          duration: Date.now() - new Date().getTime() // This should be calculated properly
        },
        { new: true }
      );

      if (escalation) {
        console.log(`✅ Escalation completed for call ${callSid}`);
      }

      return escalation;

    } catch (error) {
      console.error('Error completing escalation:', error);
      throw new Error(`Failed to complete escalation: ${error.message}`);
    }
  }

  // Get escalation timeline for a call
  async getEscalationTimeline(callId) {
    try {
      const escalations = await EscalationLog.find({ callId })
        .sort({ initiatedAt: -1 })
        .lean();

      return escalations;

    } catch (error) {
      console.error('Error fetching escalation timeline:', error);
      throw new Error(`Failed to fetch escalation timeline: ${error.message}`);
    }
  }

  // Check if escalation is needed based on conversation analysis
  shouldEscalate(conversationData) {
    const {
      transcript,
      confidenceScore,
      uncertaintyGateTriggered,
      complaintKeywords = ['complaint', 'unsatisfied', 'disappointed', 'angry', 'frustrated'],
      safetyKeywords = ['injury', 'accident', 'unsafe', 'dangerous', 'discrimination'],
      legalKeywords = ['lawyer', 'legal', 'sue', 'court', 'litigation']
    } = conversationData;

    const transcriptText = transcript.map(t => t.text).join(' ').toLowerCase();

    // High priority escalations
    if (safetyKeywords.some(keyword => transcriptText.includes(keyword))) {
      return { shouldEscalate: true, reason: 'safety_concern', priority: 'urgent' };
    }

    if (legalKeywords.some(keyword => transcriptText.includes(keyword))) {
      return { shouldEscalate: true, reason: 'legal_threat', priority: 'urgent' };
    }

    // Medium priority escalations
    if (complaintKeywords.some(keyword => transcriptText.includes(keyword))) {
      return { shouldEscalate: true, reason: 'customer_complaint', priority: 'high' };
    }

    if (uncertaintyGateTriggered && confidenceScore < 0.3) {
      return { shouldEscalate: true, reason: 'low_confidence', priority: 'medium' };
    }

    // User explicitly requests human
    if (transcriptText.includes('human') || transcriptText.includes('speak to someone')) {
      return { shouldEscalate: true, reason: 'user_request', priority: 'medium' };
    }

    return { shouldEscalate: false };
  }

  // Generate handover summary for human agent
  generateHandoverSummary(transcript, escalationReason) {
    const customerName = transcript.find(t => t.role === 'user')?.text?.split(' ')[0] || 'Customer';
    const mainIssue = transcript.slice(-3).map(t => t.text).join(' ');
    
    return `Customer ${customerName} calling regarding: ${mainIssue}. Escalation reason: ${escalationReason}. Please review full transcript for complete context.`;
  }
}

export default new EscalationService();





