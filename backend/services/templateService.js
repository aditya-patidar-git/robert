import EmailTemplate from "../models/EmailTemplate.js";
import SMSTemplate from "../models/SMSTemplate.js";

/**
 * Template Service
 * Handles template rendering, validation, and test sending
 */
class TemplateService {
  /**
   * Render template with variables
   * @param {Object} template - Template object
   * @param {Object} variables - Variables to substitute
   * @param {string} type - Template type ('email' or 'sms')
   * @returns {string} Rendered template
   */
  renderTemplate(template, variables, type = 'email') {
    let rendered = type === 'email' ? template.body : template.body;

    // Replace variables in template
    if (template.variables && variables) {
      template.variables.forEach((varDef) => {
        const varName = varDef.name;
        const varValue = variables[varName] || '';
        const placeholder = `{{${varName}}}`;
        rendered = rendered.replace(new RegExp(placeholder, 'g'), varValue);
      });
    }

    return rendered;
  }

  /**
   * Validate template variables
   * @param {Object} template - Template object
   * @param {Object} variables - Variables to validate
   * @returns {Object} Validation result
   */
  validateTemplateVariables(template, variables) {
    const errors = [];
    const warnings = [];

    if (!template.variables || template.variables.length === 0) {
      return { valid: true, errors: [], warnings: [] };
    }

    // Check for required variables
    template.variables.forEach((varDef) => {
      if (!variables || !variables.hasOwnProperty(varDef.name)) {
        errors.push(`Missing required variable: ${varDef.name}`);
      }
    });

    // Check for unused variables
    if (variables) {
      Object.keys(variables).forEach((varName) => {
        const varDef = template.variables.find(v => v.name === varName);
        if (!varDef) {
          warnings.push(`Unused variable: ${varName}`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Send test email
   * @param {string} templateId - Template ID
   * @param {string} recipientEmail - Recipient email
   * @returns {Promise<Object>} Send result
   */
  async sendTestEmail(templateId, recipientEmail) {
    try {
      const template = await EmailTemplate.findById(templateId);
      
      if (!template) {
        throw new Error('Email template not found');
      }

      // Use example variables or empty variables
      const exampleVariables = {};
      template.variables?.forEach((varDef) => {
        exampleVariables[varDef.name] = varDef.example || `[${varDef.name}]`;
      });

      const renderedSubject = this.renderTemplate(
        { ...template.toObject(), body: template.subject },
        exampleVariables,
        'email'
      );
      const renderedBody = this.renderTemplate(template.toObject(), exampleVariables, 'email');

      // TODO: Integrate with actual email service (SMTP/SendGrid/Mailgun)
      // For now, return mock result
      console.log('📧 [TEST EMAIL] Would send to:', recipientEmail);
      console.log('📧 [TEST EMAIL] Subject:', renderedSubject);
      console.log('📧 [TEST EMAIL] Body:', renderedBody.substring(0, 100) + '...');

      return {
        success: true,
        message: 'Test email sent successfully',
        recipient: recipientEmail,
        subject: renderedSubject
      };
    } catch (error) {
      throw new Error(`Failed to send test email: ${error.message}`);
    }
  }

  /**
   * Send test SMS
   * @param {string} templateId - Template ID
   * @param {string} recipientPhone - Recipient phone number
   * @returns {Promise<Object>} Send result
   */
  async sendTestSMS(templateId, recipientPhone) {
    try {
      const template = await SMSTemplate.findById(templateId);
      
      if (!template) {
        throw new Error('SMS template not found');
      }

      // Use example variables or empty variables
      const exampleVariables = {};
      template.variables?.forEach((varDef) => {
        exampleVariables[varDef.name] = varDef.example || `[${varDef.name}]`;
      });

      const renderedBody = this.renderTemplate(template.toObject(), exampleVariables, 'sms');

      // TODO: Integrate with actual SMS service (Twilio)
      // For now, return mock result
      console.log('📱 [TEST SMS] Would send to:', recipientPhone);
      console.log('📱 [TEST SMS] Body:', renderedBody);

      return {
        success: true,
        message: 'Test SMS sent successfully',
        recipient: recipientPhone,
        body: renderedBody,
        characterCount: renderedBody.length
      };
    } catch (error) {
      throw new Error(`Failed to send test SMS: ${error.message}`);
    }
  }

  /**
   * Validate SMS template
   * @param {Object} template - SMS template
   * @returns {Object} Validation result
   */
  validateSMSTemplate(template) {
    const errors = [];

    if (!template.body) {
      errors.push('SMS body is required');
    } else if (template.body.length > 1600) {
      errors.push('SMS body must be 1600 characters or less');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default new TemplateService();

