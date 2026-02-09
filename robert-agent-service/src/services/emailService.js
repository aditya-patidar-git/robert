import nodemailer from 'nodemailer';
import * as gmailTokenStore from './gmailTokenStore.js';

/**
 * General Email Service for sending emails via SMTP
 * Provides reusable email functionality for the application
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  reinitializeTransporter() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    const smtpUser = process.env.SMTP_USER || '';
    const smtpHost = process.env.SMTP_HOST || '';
    const isGmail = smtpUser.toLowerCase().includes('@gmail.com') ||
      smtpHost.toLowerCase().includes('gmail.com') ||
      smtpHost.toLowerCase().includes('smtp.gmail.com');

    if (isGmail && process.env.GMAIL_OAUTH_CLIENT_ID && process.env.GMAIL_OAUTH_CLIENT_SECRET) {
      const tokens = gmailTokenStore.getTokens();
      if (tokens?.refresh_token) {
        try {
          this.transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: false,
            requireTLS: true,
            auth: {
              type: 'OAuth2',
              user: process.env.SMTP_USER,
              clientId: process.env.GMAIL_OAUTH_CLIENT_ID,
              clientSecret: process.env.GMAIL_OAUTH_CLIENT_SECRET,
              refreshToken: tokens.refresh_token
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 10000
          });
          console.log('✅ Email transporter initialized (Gmail OAuth2)');
        } catch (error) {
          console.error('❌ Error initializing Gmail OAuth transporter:', error.message);
          this.transporter = null;
        }
      } else {
        console.log('⚠️ Gmail OAuth not connected. Visit /api/gmail/auth to connect.');
        this.transporter = null;
      }
      return;
    }

    if (isGmail || (process.env.SMTP_HOST && process.env.SMTP_PORT)) {
      try {
        const smtpConfig = isGmail ? {
          host: 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: false,
          requireTLS: true,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
          },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 10000
        } : {
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
        };

        this.transporter = nodemailer.createTransport(smtpConfig);
        if (isGmail) {
          console.log('✅ Email transporter initialized (Gmail SMTP App Password)');
        } else {
          console.log('✅ Email transporter initialized (SMTP)');
        }
      } catch (error) {
        console.error('❌ Error initializing email transporter:', error.message);
        if (isGmail) {
          console.error('\n💡 Gmail: use OAuth (set GMAIL_OAUTH_*) or App Password (SMTP_PASSWORD).');
        }
        this.transporter = null;
      }
    } else {
      console.log('⚠️ SMTP not configured. Email sending will be logged only.');
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
    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
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
   * @param {string} [options.html] - HTML body (optional, will be generated from text if not provided)
   * @param {string|string[]} [options.cc] - CC recipient(s)
   * @param {string|string[]} [options.bcc] - BCC recipient(s)
   * @param {string} [options.from] - Sender email (defaults to SMTP_FROM env var)
   * @param {string} [options.replyTo] - Reply-to email
   * @param {Object[]} [options.attachments] - Email attachments
   * @param {number} [options.maxRetries=2] - Maximum retry attempts for transient errors
   * @returns {Promise<{success: boolean, messageId?: string, error?: string, logged?: boolean}>}
   */
  async sendEmail(options) {
    const {
      to,
      subject,
      text,
      html,
      cc,
      bcc,
      from,
      replyTo,
      attachments,
      maxRetries = 2
    } = options;

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
      console.log('📧 [EMAIL LOG] Email would be sent:');
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
      from: from || process.env.SMTP_FROM || 'robert@universalmct.co.uk',
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
    if (replyTo) {
      mailOptions.replyTo = replyTo;
    }
    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    // Send email with retry logic
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`🔄 Retrying email send (attempt ${attempt + 1}/${maxRetries + 1})...`);
          // Exponential backoff: wait 1s, 2s, 4s...
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
        }

        const info = await this.transporter.sendMail(mailOptions);
        console.log(`✅ Email sent successfully: ${info.messageId}`);

        return {
          success: true,
          messageId: info.messageId
        };
      } catch (error) {
        lastError = error;
        const isTransientError = this.isTransientError(error);
        
        if (!isTransientError || attempt === maxRetries) {
          // Non-transient error or max retries reached
          console.error(`❌ Error sending email:`, error.message);
          return {
            success: false,
            error: error.message
          };
        }
        
        // Transient error, will retry
        console.warn(`⚠️ Transient error sending email (attempt ${attempt + 1}):`, error.message);
      }
    }

    // Should not reach here, but handle edge case
    return {
      success: false,
      error: lastError ? lastError.message : 'Unknown error sending email'
    };
  }

  /**
   * Check if error is transient (retryable)
   * @param {Error} error - Error object
   * @returns {boolean} True if error is transient
   */
  isTransientError(error) {
    if (!error) return false;
    
    const transientCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN'];
    const transientMessages = ['timeout', 'connection', 'network', 'temporary'];
    
    const errorCode = error.code || '';
    const errorMessage = (error.message || '').toLowerCase();
    
    return transientCodes.some(code => errorCode.includes(code)) ||
           transientMessages.some(msg => errorMessage.includes(msg));
  }

  /**
   * Send email using a template
   * @param {string} templateName - Name of the template
   * @param {Object} templateData - Data to populate template
   * @param {string|string[]} to - Recipient email address(es)
   * @param {Object} [options] - Additional email options (cc, bcc, etc.)
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async sendTemplateEmail(templateName, templateData, to, options = {}) {
    // This will be used with emailTemplates.js
    // For now, return error - templates will be implemented separately
    try {
      const { getTemplate } = await import('./emailTemplates.js');
      const template = getTemplate(templateName);
      
      if (!template) {
        return {
          success: false,
          error: `Template "${templateName}" not found`
        };
      }

      // Render template with data
      const subject = typeof template.subject === 'function' 
        ? template.subject(templateData)
        : template.subject;
      const text = typeof template.text === 'function'
        ? template.text(templateData)
        : template.text;
      const html = typeof template.html === 'function'
        ? template.html(templateData)
        : template.html;

      return await this.sendEmail({
        to,
        subject,
        text,
        html,
        ...options
      });
    } catch (error) {
      return {
        success: false,
        error: `Failed to load template: ${error.message}`
      };
    }
  }

  /**
   * Test SMTP connection
   * @returns {Promise<{connected: boolean, error?: string}>}
   */
  async testConnection() {
    if (!this.transporter) {
      return {
        connected: false,
        error: 'SMTP transporter not initialized'
      };
    }

    try {
      await this.transporter.verify();
      return { connected: true };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export default new EmailService();

