import nodemailer from 'nodemailer';
import axios from 'axios';
import crypto from 'crypto';

/**
 * Alert Service
 * Handles sending alerts via multiple channels (email, webhook, admin portal)
 */
class AlertService {
  constructor() {
    this.emailEnabled = process.env.ALERT_EMAIL_ENABLED === 'true';
    this.webhookEnabled = process.env.ALERT_WEBHOOK_ENABLED === 'true';
    this.webhookUrl = process.env.ALERT_WEBHOOK_URL;
    this.webhookSecret = process.env.ALERT_WEBHOOK_SECRET;
    this.emailRecipients = process.env.ALERT_EMAIL_RECIPIENTS
      ? process.env.ALERT_EMAIL_RECIPIENTS.split(',').map(email => email.trim())
      : [];
    
    // Initialize email transporter if enabled
    this.emailTransporter = null;
    if (this.emailEnabled) {
      this.initializeEmailTransporter();
    }
  }

  /**
   * Initialize email transporter
   */
  initializeEmailTransporter() {
    try {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        }
      });

      console.log('✅ Alert Service: Email transporter initialized');
    } catch (error) {
      console.error('❌ Alert Service: Error initializing email transporter:', error);
      this.emailEnabled = false;
    }
  }

  /**
   * Send alert via all configured channels
   * @param {Object} alertData - Alert data
   * @returns {Promise<Object>} Send result
   */
  async sendAlert(alertData) {
    const results = {
      email: { sent: false, error: null },
      webhook: { sent: false, error: null },
      adminPortal: { sent: false, error: null }
    };

    // Send via email
    if (this.emailEnabled && this.emailRecipients.length > 0) {
      try {
        await this.sendEmailAlert(alertData);
        results.email.sent = true;
      } catch (error) {
        results.email.error = error.message;
        console.error('❌ Alert Service: Email send failed:', error);
      }
    }

    // Send via webhook
    if (this.webhookEnabled && this.webhookUrl) {
      try {
        await this.sendWebhookAlert(alertData);
        results.webhook.sent = true;
      } catch (error) {
        results.webhook.error = error.message;
        console.error('❌ Alert Service: Webhook send failed:', error);
      }
    }

    // Send to admin portal (via ObservabilityService)
    try {
      await this.sendAdminPortalAlert(alertData);
      results.adminPortal.sent = true;
    } catch (error) {
      results.adminPortal.error = error.message;
      console.error('❌ Alert Service: Admin portal alert failed:', error);
    }

    return results;
  }

  /**
   * Send alert via email
   * @param {Object} alertData - Alert data
   * @returns {Promise<void>}
   */
  async sendEmailAlert(alertData) {
    if (!this.emailTransporter) {
      throw new Error('Email transporter not initialized');
    }

    const {
      title,
      message,
      severity,
      callerId,
      reason,
      metadata = {}
    } = alertData;

    // Determine severity color
    const severityColors = {
      critical: '#d32f2f',
      warning: '#ed6c02',
      info: '#0288d1'
    };

    const severityColor = severityColors[severity] || severityColors.info;

    // Build HTML email
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: ${severityColor}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
            .footer { background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 5px 5px; }
            .detail { margin: 10px 0; }
            .label { font-weight: bold; }
            .metadata { background-color: #fff; padding: 15px; margin-top: 15px; border-radius: 5px; }
            .metadata-item { margin: 5px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">${title}</h2>
            </div>
            <div class="content">
              <p>${message}</p>
              
              ${callerId ? `
                <div class="detail">
                  <span class="label">Caller ID:</span> ${callerId}
                </div>
              ` : ''}
              
              ${reason ? `
                <div class="detail">
                  <span class="label">Reason:</span> ${reason}
                </div>
              ` : ''}
              
              <div class="detail">
                <span class="label">Severity:</span> ${severity.toUpperCase()}
              </div>
              
              <div class="detail">
                <span class="label">Timestamp:</span> ${new Date().toISOString()}
              </div>
              
              ${Object.keys(metadata).length > 0 ? `
                <div class="metadata">
                  <strong>Additional Details:</strong>
                  ${Object.entries(metadata).map(([key, value]) => `
                    <div class="metadata-item">
                      <span class="label">${key}:</span> ${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
            <div class="footer">
              <p>This is an automated alert from the Robert Voice Agent system.</p>
              <p>Please review the admin portal for more details.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email to all recipients
    const emailPromises = this.emailRecipients.map(recipient =>
      this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: recipient,
        subject: `[${severity.toUpperCase()}] ${title}`,
        html,
        text: `
${title}

${message}

${callerId ? `Caller ID: ${callerId}` : ''}
${reason ? `Reason: ${reason}` : ''}
Severity: ${severity.toUpperCase()}
Timestamp: ${new Date().toISOString()}

${Object.keys(metadata).length > 0 ? `\nAdditional Details:\n${JSON.stringify(metadata, null, 2)}` : ''}
        `.trim()
      })
    );

    await Promise.all(emailPromises);
    console.log(`✅ Alert Service: Email alert sent to ${this.emailRecipients.length} recipient(s)`);
  }

  /**
   * Send alert via webhook
   * @param {Object} alertData - Alert data
   * @returns {Promise<void>}
   */
  async sendWebhookAlert(alertData) {
    if (!this.webhookUrl) {
      throw new Error('Webhook URL not configured');
    }

    const payload = {
      alert: {
        title: alertData.title,
        message: alertData.message,
        severity: alertData.severity,
        callerId: alertData.callerId,
        reason: alertData.reason,
        metadata: alertData.metadata || {},
        timestamp: new Date().toISOString(),
        source: 'robert-voice-agent'
      }
    };

    // Add signature if secret is configured
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.webhookSecret) {
      const signature = this.generateWebhookSignature(JSON.stringify(payload));
      headers['X-Webhook-Signature'] = signature;
    }

    // Send webhook with retry logic
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await axios.post(this.webhookUrl, payload, {
          headers,
          timeout: 10000
        });

        console.log(`✅ Alert Service: Webhook alert sent (status: ${response.status})`);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries - 1) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw new Error(`Webhook send failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Generate webhook signature
   * @param {string} payload - Payload string
   * @returns {string} Signature
   */
  generateWebhookSignature(payload) {
    if (!this.webhookSecret) {
      return null;
    }

    return crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Send alert to admin portal (via ObservabilityService)
   * @param {Object} alertData - Alert data
   * @returns {Promise<void>}
   */
  async sendAdminPortalAlert(alertData) {
    try {
      // Dynamically import to avoid circular dependencies
      const observabilityService = (await import('./observabilityService.js')).default;
      
      observabilityService.createAlert({
        title: alertData.title,
        message: alertData.message,
        severity: alertData.severity || 'warning',
        component: alertData.component || 'abuse-prevention',
        metadata: {
          callerId: alertData.callerId,
          reason: alertData.reason,
          ...(alertData.metadata || {})
        }
      });

      console.log('✅ Alert Service: Admin portal alert created');
    } catch (error) {
      console.error('❌ Alert Service: Error creating admin portal alert:', error);
      throw error;
    }
  }

  /**
   * Send abuse prevention alert
   * @param {string} callerId - Caller phone number
   * @param {string} reason - Block reason
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Send result
   */
  async sendAbuseAlert(callerId, reason, metadata = {}) {
    const alertData = {
      title: 'Abuse Prevention Alert',
      message: `Caller ${callerId} has been blocked due to: ${reason}`,
      severity: 'warning',
      callerId,
      reason,
      component: 'abuse-prevention',
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    };

    return this.sendAlert(alertData);
  }

  /**
   * Test alert configuration
   * @returns {Promise<Object>} Test result
   */
  async testAlertConfiguration() {
    const results = {
      email: { configured: false, testable: false },
      webhook: { configured: false, testable: false },
      adminPortal: { configured: true, testable: true }
    };

    // Test email
    if (this.emailEnabled) {
      results.email.configured = true;
      if (this.emailTransporter && this.emailRecipients.length > 0) {
        results.email.testable = true;
      }
    }

    // Test webhook
    if (this.webhookEnabled && this.webhookUrl) {
      results.webhook.configured = true;
      results.webhook.testable = true;
    }

    return results;
  }

  /**
   * Send test alert
   * @returns {Promise<Object>} Send result
   */
  async sendTestAlert() {
    const alertData = {
      title: 'Test Alert',
      message: 'This is a test alert to verify alert configuration.',
      severity: 'info',
      component: 'system',
      metadata: {
        test: true,
        timestamp: new Date().toISOString()
      }
    };

    return this.sendAlert(alertData);
  }
}

export default new AlertService();

