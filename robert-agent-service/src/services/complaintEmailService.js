// dotenv is already loaded in index.js, no need to reload here
import ComplaintRecord from '../database/models/ComplaintRecord.js';
import emailService from './emailService.js';
import generateReferenceIdTool from '../tools/generateReferenceId.js';

class ComplaintEmailService {
  constructor() {
    this.complaintsEmail = 'complaints@universalmct.co.uk';
    this.managerEmail = 'john.mcgregor@universalmct.co.uk'; // From documentation
  }

  /**
   * Generate complaint email content
   * @param {object} complaintData - Complaint data
   * @returns {object} Email content (subject, body)
   */
  generateComplaintEmail(complaintData) {
    const {
      callSid,
      callerId,
      complaintText,
      complaintType,
      priority,
      context,
      referenceId
    } = complaintData;

    const subject = `[${priority.toUpperCase()}] Complaint - ${complaintType}${referenceId ? ` - ${referenceId}` : ''} - Call ${callSid}`;

    let body = `A complaint has been received during a phone call.\n\n`;
    body += `Call Details:\n`;
    if (referenceId) {
      body += `- Reference ID: ${referenceId}\n`;
    }
    body += `- Call SID: ${callSid}\n`;
    body += `- Caller ID: ${this.maskPII(callerId)}\n`;
    body += `- Complaint Type: ${complaintType}\n`;
    body += `- Priority: ${priority}\n\n`;

    if (context) {
      body += `Context:\n`;
      if (context.when) body += `- When: ${context.when}\n`;
      if (context.where) body += `- Where: ${context.where}\n`;
      if (context.bookingRef) body += `- Booking Reference: ${context.bookingRef}\n`;
      if (context.desiredOutcome) body += `- Desired Outcome: ${context.desiredOutcome}\n`;
      body += `\n`;
    }

    body += `Complaint Details:\n`;
    body += `${complaintText}\n\n`;

    body += `Call Transcript:\n`;
    body += `A full transcript of this call is available in the admin portal.\n`;
    body += `Call SID: ${callSid}\n\n`;

    body += `Action Required:\n`;
    if (priority === 'urgent' || priority === 'high') {
      body += `This is a ${priority} priority complaint requiring immediate attention.\n`;
    }
    body += `Please review the full call transcript and contact the customer to resolve this matter.\n\n`;

    body += `---\n`;
    body += `This is an automated email from Robert AI Phone Agent.\n`;
    body += `Generated at: ${new Date().toISOString()}\n`;

    return { subject, body };
  }

  /**
   * Mask PII in email content (delegates to emailService)
   * @param {string} value - Value to mask
   * @returns {string} Masked value
   */
  maskPII(value) {
    return emailService.maskPII(value);
  }

  /**
   * Send complaint email
   * @param {object} complaintData - Complaint data
   * @returns {Promise<{success: boolean, messageId?: string, error?: string, logged?: boolean}>}
   */
  async sendComplaintEmail(complaintData) {
    try {
      const { subject, body } = this.generateComplaintEmail(complaintData);

      // Use general email service to send email
      const result = await emailService.sendEmail({
        to: this.complaintsEmail,
        cc: this.managerEmail,
        subject,
        text: body,
        html: emailService.textToHtml(body)
      });

      if (result.success) {
        console.log(`✅ Complaint email sent: ${result.messageId || 'logged'}`);
      } else {
        console.error(`❌ Failed to send complaint email: ${result.error}`);
      }

      return result;
    } catch (error) {
      console.error('❌ Error sending complaint email:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create complaint record and send email
   * @param {string} callSid - Call SID
   * @param {string} callerId - Caller ID
   * @param {object} complaintData - Complaint data
   * @returns {Promise<{success: boolean, complaintRecord?: object, error?: string}>}
   */
  async createAndSendComplaint(callSid, callerId, complaintData) {
    try {
      const {
        complaintText,
        complaintType,
        priority = 'medium',
        context
      } = complaintData;

      // Generate reference ID for complaint (prefix: "COMP")
      const referenceIdResult = generateReferenceIdTool.generateReferenceId('COMP');
      console.log(`✅ [${callSid}] Generated complaint reference ID: ${referenceIdResult}`);

      // Create complaint record
      const complaintRecord = new ComplaintRecord({
        callId: callSid,
        callSid,
        callerId,
        complaintText,
        complaintType,
        priority,
        status: 'open',
        referenceId: referenceIdResult,
        assignedTo: this.managerEmail,
        complaintEmail: this.complaintsEmail,
        submittedAt: new Date(),
        escalationRequired: priority === 'urgent' || priority === 'high'
      });

      await complaintRecord.save();
      console.log(`✅ Complaint record created: ${complaintRecord._id}, Reference ID: ${referenceIdResult}`);

      // Send email
      const emailResult = await this.sendComplaintEmail({
        callSid,
        callerId,
        complaintText,
        complaintType,
        priority,
        context,
        referenceId: referenceIdResult
      });

      if (!emailResult.success) {
        console.error(`⚠️ Complaint record created but email failed: ${emailResult.error}`);
      }

      return {
        success: true,
        complaintRecord: {
          id: complaintRecord._id.toString(),
          callSid,
          complaintType,
          priority,
          status: complaintRecord.status,
          referenceId: referenceIdResult
        },
        emailSent: emailResult.success,
        messageId: emailResult.messageId
      };
    } catch (error) {
      console.error('❌ Error creating complaint:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new ComplaintEmailService();

