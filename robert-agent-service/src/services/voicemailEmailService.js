import emailService from './emailService.js';
import { getTemplate } from './emailTemplates.js';
import TelephonyConfig from '../database/models/TelephonyConfig.js';

/**
 * Service for sending voicemail email notifications
 */
class VoicemailEmailService {
  /**
   * Send voicemail notification email to configured recipients
   * @param {Object} voicemailData - Voicemail data
   * @param {string} voicemailData.callSid - Call SID
   * @param {string} voicemailData.callerId - Caller ID (will be masked)
   * @param {string} [voicemailData.recordingUrl] - Recording URL if available
   * @param {string} [voicemailData.transcript] - Transcript summary if available
   * @param {string} [voicemailData.duration] - Recording duration
   * @param {Date} [voicemailData.timestamp] - Voicemail timestamp
   * @returns {Promise<{success: boolean, messageId?: string, error?: string, recipients?: string[]}>}
   */
  async sendVoicemailNotification(voicemailData) {
    try {
      const {
        callSid,
        callerId,
        recordingUrl,
        transcript,
        duration,
        timestamp
      } = voicemailData;

      // Get telephony configuration to find email recipients
      const telephonyConfig = await TelephonyConfig.findOne({ isActive: true })
        .sort({ createdAt: -1 })
        .lean();

      if (!telephonyConfig) {
        console.warn('⚠️ No active telephony configuration found for voicemail notifications');
        return {
          success: false,
          error: 'No active telephony configuration found'
        };
      }

      const voicemailSettings = telephonyConfig.voicemailSettings || {};

      // Check if email notifications are enabled
      if (!voicemailSettings.emailNotification) {
        console.log('📧 Voicemail email notifications are disabled in configuration');
        return {
          success: true,
          messageId: null,
          skipped: true,
          reason: 'Email notifications disabled'
        };
      }

      // Get email recipients
      const recipients = voicemailSettings.emailRecipients || [];

      if (!recipients || recipients.length === 0) {
        console.warn('⚠️ No email recipients configured for voicemail notifications');
        return {
          success: false,
          error: 'No email recipients configured'
        };
      }

      // Validate email addresses
      const validRecipients = recipients.filter(email => emailService.validateEmailAddress(email));
      const invalidRecipients = recipients.filter(email => !emailService.validateEmailAddress(email));

      if (invalidRecipients.length > 0) {
        console.warn(`⚠️ Invalid email addresses in voicemail recipients: ${invalidRecipients.join(', ')}`);
      }

      if (validRecipients.length === 0) {
        return {
          success: false,
          error: 'No valid email recipients found'
        };
      }

      // Prepare voicemail data for template
      const templateData = {
        callerId: emailService.maskPII(callerId),
        timestamp: timestamp 
          ? new Date(timestamp).toLocaleString('en-GB', { timeZone: 'Europe/London' })
          : new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' }),
        recordingUrl,
        transcript,
        duration
      };

      // Get voicemail notification template
      const template = getTemplate('voicemail_notification');

      if (!template) {
        // Fallback to plain email if template not found
        return await this.sendPlainVoicemailEmail(validRecipients, templateData);
      }

      // Send email using template
      const result = await emailService.sendTemplateEmail(
        'voicemail_notification',
        templateData,
        validRecipients
      );

      if (result.success) {
        console.log(`✅ Voicemail notification sent to ${validRecipients.length} recipient(s): ${result.messageId || 'logged'}`);
      } else {
        console.error(`❌ Failed to send voicemail notification: ${result.error}`);
      }

      return {
        ...result,
        recipients: validRecipients
      };
    } catch (error) {
      console.error('❌ Error sending voicemail notification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send plain voicemail email (fallback if template not available)
   * @param {string[]} recipients - Email recipients
   * @param {Object} data - Voicemail data
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async sendPlainVoicemailEmail(recipients, data) {
    const subject = `New Voicemail Received - ${data.timestamp || new Date().toLocaleDateString('en-GB')}`;

    let text = `New Voicemail Received\n\n`;
    text += `Call Details:\n`;
    text += `- Caller ID: ${data.callerId || 'Unknown'}\n`;
    text += `- Timestamp: ${data.timestamp || new Date().toLocaleString('en-GB')}\n`;
    if (data.duration) {
      text += `- Duration: ${data.duration}\n`;
    }
    text += `\n`;

    if (data.transcript) {
      text += `Transcript Summary:\n`;
      text += `${data.transcript}\n\n`;
    }

    if (data.recordingUrl) {
      text += `Recording URL: ${data.recordingUrl}\n\n`;
    }

    text += `Please review the voicemail and respond as appropriate.\n`;

    return await emailService.sendEmail({
      to: recipients,
      subject,
      text
    });
  }

  /**
   * Check if voicemail notifications are enabled
   * @returns {Promise<{enabled: boolean, recipients: string[]}>}
   */
  async isNotificationEnabled() {
    try {
      const telephonyConfig = await TelephonyConfig.findOne({ isActive: true })
        .sort({ createdAt: -1 })
        .lean();

      if (!telephonyConfig) {
        return { enabled: false, recipients: [] };
      }

      const voicemailSettings = telephonyConfig.voicemailSettings || {};
      const enabled = voicemailSettings.emailNotification === true;
      const recipients = voicemailSettings.emailRecipients || [];

      return {
        enabled,
        recipients: recipients.filter(email => emailService.validateEmailAddress(email))
      };
    } catch (error) {
      console.error('❌ Error checking voicemail notification settings:', error);
      return { enabled: false, recipients: [] };
    }
  }
}

export default new VoicemailEmailService();

