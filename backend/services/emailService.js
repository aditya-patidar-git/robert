import nodemailer from 'nodemailer';
// dotenv is already loaded in server.js, no need to reload here

/**
 * Email Service for backend (MCP Tools)
 * Provides email functionality for the backend service
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter (SMTP)
   */
  initializeTransporter() {
    // Check if SMTP is configured
    if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
      try {
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
          },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 10000
        });
        console.log('✅ Backend email transporter initialized (SMTP)');
      } catch (error) {
        console.error('❌ Error initializing backend email transporter:', error.message);
        this.transporter = null;
      }
    } else {
      console.log('⚠️ Backend SMTP not configured. Email sending will be logged only.');
    }
  }

  /**
   * Validate email address format
   * @param {string} email - Email address to validate
   * @returns {boolean} True if valid email format
   */
  validateEmailAddress(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Convert plain text to HTML (basic conversion)
   * @param {string} text - Plain text content
   * @returns {string} HTML formatted content
   */
  textToHtml(text) {
    if (!text) return '';
    return text
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  }

  /**
   * Send email via SMTP
   * @param {Object} options - Email options
   * @param {string|string[]} options.to - Recipient email address(es)
   * @param {string} options.subject - Email subject
   * @param {string} options.text - Plain text body
   * @param {string} [options.html] - HTML body (optional)
   * @param {string|string[]} [options.cc] - CC recipient(s)
   * @param {string|string[]} [options.bcc] - BCC recipient(s)
   * @returns {Promise<{success: boolean, messageId?: string, error?: string, logged?: boolean}>}
   */
  async sendEmail(options) {
    const { to, subject, text, html, cc, bcc } = options;

    // Validate required fields
    if (!to || !subject || !text) {
      return {
        success: false,
        error: 'Missing required fields: to, subject, and text are required'
      };
    }

    // Validate email addresses
    const recipients = Array.isArray(to) ? to : [to];
    const invalidRecipients = recipients.filter(email => !this.validateEmailAddress(email));
    if (invalidRecipients.length > 0) {
      return {
        success: false,
        error: `Invalid email address(es): ${invalidRecipients.join(', ')}`
      };
    }

    // If no transporter, log email instead of sending
    if (!this.transporter) {
      console.log('📧 [BACKEND EMAIL LOG] Email would be sent:');
      console.log(`📧 To: ${recipients.join(', ')}`);
      if (cc) console.log(`📧 CC: ${Array.isArray(cc) ? cc.join(', ') : cc}`);
      if (bcc) console.log(`📧 BCC: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}`);
      console.log(`📧 Subject: ${subject}`);
      console.log(`📧 Body:\n${text}`);

      return {
        success: true,
        messageId: `log_${Date.now()}`,
        logged: true
      };
    }

    // Prepare mail options
    const mailOptions = {
      from: process.env.SMTP_FROM || 'robert@universalmct.co.uk',
      to: recipients.join(', '),
      subject,
      text,
      html: html || this.textToHtml(text)
    };

    if (cc) {
      mailOptions.cc = Array.isArray(cc) ? cc.join(', ') : cc;
    }
    if (bcc) {
      mailOptions.bcc = Array.isArray(bcc) ? bcc.join(', ') : bcc;
    }

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Backend email sent successfully: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      console.error(`❌ Error sending backend email:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendLoginOtp(to, otp) {
    const subject = 'Your login verification code';
    const text = `Your one-time verification code is: ${otp}\n\nThis code is valid for 10 minutes. Do not share it with anyone.`;
    return this.sendEmail({ to, subject, text });
  }

  async sendSignupOtp(to, otp) {
    const subject = 'Verify your email – Robert Voice Agent';
    const text = `Your verification code is: ${otp}\n\nThis code is valid for 10 minutes. Use it to complete your registration.`;
    return this.sendEmail({ to, subject, text });
  }

  async sendPendingVerificationOtp(to, otp) {
    const subject = 'Activate your account – verification code';
    const text = `Your verification code is: ${otp}\n\nThis code is valid for 10 minutes. Use it to activate your account and sign in.`;
    return this.sendEmail({ to, subject, text });
  }
}

export default new EmailService();

