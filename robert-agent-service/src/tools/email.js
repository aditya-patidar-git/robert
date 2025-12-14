import emailService from '../services/emailService.js';
import { getTemplate } from '../services/emailTemplates.js';

class EmailTool {
  /**
   * Execute email tool - send email via SMTP
   * @param {Object} parameters - Email parameters
   * @param {string} parameters.to - Recipient email address
   * @param {string} [parameters.subject] - Email subject (required if no template)
   * @param {string} [parameters.body] - Email body (required if no template)
   * @param {string} [parameters.template] - Template name (booking_confirmation, booking_reminder, cancellation)
   * @param {Object} [parameters.templateData] - Data for template rendering
   * @param {string} [parameters.cc] - CC recipient(s)
   * @param {string} [parameters.bcc] - BCC recipient(s)
   * @param {Object} callContext - Call context
   * @returns {Promise<{success: boolean, messageId?: string, to?: string, subject?: string, body?: string, sentAt?: string, error?: string}>}
   */
  async execute(parameters, callContext = {}) {
    try {
      const { to, subject, body, template, templateData = {}, cc, bcc } = parameters;

      // Validate recipient
      if (!to) {
        return {
          success: false,
          error: 'Recipient email address (to) is required'
        };
      }

      if (!emailService.validateEmailAddress(to)) {
        return {
          success: false,
          error: `Invalid email address: ${to}`
        };
      }

      let finalSubject = subject;
      let finalText = body;
      let finalHtml = null;

      // If template is provided, use it
      if (template) {
        const emailTemplate = getTemplate(template);
        
        if (!emailTemplate) {
          return {
            success: false,
            error: `Template "${template}" not found. Available templates: booking_confirmation, booking_reminder, cancellation`
          };
        }

        // Render template with data
        finalSubject = typeof emailTemplate.subject === 'function'
          ? emailTemplate.subject(templateData)
          : emailTemplate.subject;
        
        finalText = typeof emailTemplate.text === 'function'
          ? emailTemplate.text(templateData)
          : emailTemplate.text;
        
        finalHtml = typeof emailTemplate.html === 'function'
          ? emailTemplate.html(templateData)
          : emailTemplate.html;
      } else {
        // Use provided subject and body
        if (!subject || !body) {
          return {
            success: false,
            error: 'Either template or both subject and body are required'
          };
        }
      }

      // Send email via SMTP
      const result = await emailService.sendEmail({
        to,
        subject: finalSubject,
        text: finalText,
        html: finalHtml,
        cc,
        bcc
      });

      if (result.success) {
        console.log(`✅ Email sent via tool: ${result.messageId || 'logged'}`);
        return {
          success: true,
          messageId: result.messageId,
          to,
          subject: finalSubject,
          body: finalText,
          sentAt: new Date().toISOString(),
          logged: result.logged || false
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to send email'
        };
      }
    } catch (error) {
      console.error('❌ Error in email tool:', error);
      return {
        success: false,
        error: error.message || 'Unknown error sending email'
      };
    }
  }
}

export default new EmailTool();

