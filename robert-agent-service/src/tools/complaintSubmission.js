import complaintEmailService from '../services/complaintEmailService.js';
import complaintDetectionService from '../services/complaintDetectionService.js';
import { conversations } from '../shared/state.js';

class ComplaintSubmissionTool {
  async execute(parameters, callContext = {}) {
    const { complaintType, complaintText, callerDetails } = parameters;
    const { callSid, phoneNumber } = callContext;

    if (!callSid) {
      throw new Error('Call SID is required for complaint submission. This tool must be called during an active call.');
    }

    if (!complaintText) {
      return {
        success: false,
        error: 'Complaint text is required.',
        message: 'Please provide details about your complaint.'
      };
    }

    try {
      // Determine complaint type if not provided
      let detectedType = complaintType;
      if (!detectedType) {
        const detection = complaintDetectionService.detectComplaintKeywords(complaintText);
        detectedType = detection.complaintType || 'other';
      }

      // Determine priority based on complaint type
      let priority = 'medium';
      const highPriorityTypes = ['safety', 'discrimination', 'legal', 'media'];
      if (highPriorityTypes.includes(detectedType)) {
        priority = 'urgent';
      }

      // Extract context from conversation
      const context = complaintDetectionService.extractComplaintContext(callSid);

      // Create complaint record and send email
      const result = await complaintEmailService.createAndSendComplaint(
        callSid,
        phoneNumber || 'unknown',
        {
          complaintText,
          complaintType: detectedType,
          priority,
          context
        }
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          message: 'Failed to submit complaint. Please try again or request a human transfer.'
        };
      }

      // Generate complaint reference
      const complaintRef = result.complaintRecord.id.substring(0, 8).toUpperCase();

      console.log(`✅ [${callSid}] Complaint submitted: ${complaintRef}`);

      return {
        success: true,
        complaintReference: complaintRef,
        complaintType: detectedType,
        priority,
        message: `Your complaint has been submitted successfully. Reference: ${complaintRef}. We will investigate and get back to you.`,
        emailSent: result.emailSent
      };
    } catch (error) {
      console.error(`❌ [${callSid}] Complaint submission error:`, error);
      return {
        success: false,
        error: error.message,
        message: 'An error occurred while submitting your complaint. Please try again or request a human transfer.'
      };
    }
  }
}

export default new ComplaintSubmissionTool();

