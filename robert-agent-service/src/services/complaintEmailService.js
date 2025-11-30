import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import ComplaintRecord from '../database/models/ComplaintRecord.js';

dotenv.config();

class ComplaintEmailService {
  constructor() {
    this.complaintsEmail = 'complaints@universalmct.co.uk';
    this.managerEmail = 'john.mcgregor@universalmct.co.uk'; // From documentation
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter (SMTP or API)
   */
  initializeTransporter() {
    // Check if SMTP is configured
    if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        }
      });
      console.log('✅ Email transporter initialized (SMTP)');
    } else {
      console.log('⚠️ SMTP not configured. Email sending will be logged only.');
    }
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
      context
    } = complaintData;

    const subject = `[${priority.toUpperCase()}] Complaint - ${complaintType} - Call ${callSid}`;

    let body = `A complaint has been received during a phone call.\n\n`;
    body += `Call Details:\n`;
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
   * Mask PII in email content
   * @param {string} value - Value to mask
   * @returns {string} Masked value
   */
  maskPII(value) {
    if (!value) return 'N/A';
    if (value.includes('@')) {
      // Email: mask middle part
      const [local, domain] = value.split('@');
      if (local.length > 2) {
        return `${local[0]}***@${domain}`;
      }
      return `***@${domain}`;
    }
    if (value.match(/^\+?\d+$/)) {
      // Phone: mask middle digits
      if (value.length > 6) {
        return `${value.substring(0, 3)}***${value.substring(value.length - 3)}`;
      }
      return '***';
    }
    return value;
  }

  /**
   * Send complaint email
   * @param {object} complaintData - Complaint data
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async sendComplaintEmail(complaintData) {
    try {
      const { subject, body } = this.generateComplaintEmail(complaintData);

      if (!this.transporter) {
        // Log email instead of sending (for development/testing)
        console.log('📧 [EMAIL LOG] Complaint email would be sent:');
        console.log(`📧 To: ${this.complaintsEmail}`);
        console.log(`📧 CC: ${this.managerEmail}`);
        console.log(`📧 Subject: ${subject}`);
        console.log(`📧 Body:\n${body}`);

        return {
          success: true,
          messageId: `log_${Date.now()}`,
          logged: true
        };
      }

      // Send email via SMTP
      const mailOptions = {
        from: process.env.SMTP_FROM || 'robert@universalmct.co.uk',
        to: this.complaintsEmail,
        cc: this.managerEmail,
        subject,
        text: body,
        html: body.replace(/\n/g, '<br>')
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Complaint email sent: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId
      };
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

      // Create complaint record
      const complaintRecord = new ComplaintRecord({
        callId: callSid,
        callSid,
        callerId,
        complaintText,
        complaintType,
        priority,
        status: 'open',
        assignedTo: this.managerEmail,
        complaintEmail: this.complaintsEmail,
        submittedAt: new Date(),
        escalationRequired: priority === 'urgent' || priority === 'high'
      });

      await complaintRecord.save();
      console.log(`✅ Complaint record created: ${complaintRecord._id}`);

      // Send email
      const emailResult = await this.sendComplaintEmail({
        callSid,
        callerId,
        complaintText,
        complaintType,
        priority,
        context
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
          status: complaintRecord.status
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

