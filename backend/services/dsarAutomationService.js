/**
 * DSAR Automation Service
 * Handles automated verification, export generation, and notifications
 */

import DSARRequest from '../models/DSARRequest.js';
import gdprService from './gdprService.js';
import nodemailer from 'nodemailer';

class DSARAutomationService {
  constructor() {
    this.emailTransporter = null;
    this.initializeEmail();
  }

  initializeEmail() {
    // Initialize email transporter if configured
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        }
      });
    }
  }

  /**
   * Auto-verify DSAR request via email OTP
   * @param {string} requestId - DSAR request ID
   * @param {string} verificationCode - Verification code
   * @returns {Promise<Object>} Verification result
   */
  async autoVerify(requestId, verificationCode) {
    try {
      const request = await gdprService.verifyDSARRequest(requestId, verificationCode);
      
      // Auto-generate export if request type is export
      if (request.requestType === 'export' && request.status === 'processing') {
        await this.autoGenerateExport(requestId);
      }
      
      return request;
    } catch (error) {
      console.error(`❌ Auto-verify failed for ${requestId}:`, error.message);
      throw error;
    }
  }

  /**
   * Auto-generate export after verification
   * @param {string} requestId - DSAR request ID
   * @returns {Promise<Object>} Export result
   */
  async autoGenerateExport(requestId) {
    try {
      const request = await DSARRequest.findOne({ requestId });
      
      if (!request) {
        throw new Error('DSAR request not found');
      }

      if (request.status !== 'processing') {
        throw new Error(`Request cannot be processed. Current status: ${request.status}`);
      }

      // Generate export
      const exportData = await gdprService.generateDSARExport(requestId, false);
      
      // Send notification
      await this.sendNotification(request.requestorEmail, 'export_ready', {
        requestId,
        exportUrl: exportData.exportUrl,
        expiresAt: exportData.exportExpiresAt
      });

      return exportData;
    } catch (error) {
      console.error(`❌ Auto-generate export failed for ${requestId}:`, error.message);
      throw error;
    }
  }

  /**
   * Send notification email
   * @param {string} email - Recipient email
   * @param {string} type - Notification type
   * @param {Object} data - Notification data
   */
  async sendNotification(email, type, data) {
    if (!this.emailTransporter) {
      console.log(`📧 [Mock] Would send ${type} notification to ${email}`);
      return;
    }

    try {
      let subject, text, html;

      switch (type) {
        case 'verification':
          subject = 'DSAR Request Verification Code';
          text = `Your verification code is: ${data.verificationCode}\n\nRequest ID: ${data.requestId}`;
          html = `
            <h2>DSAR Request Verification</h2>
            <p>Your verification code is: <strong>${data.verificationCode}</strong></p>
            <p>Request ID: ${data.requestId}</p>
            <p>This code will expire in 24 hours.</p>
          `;
          break;
        case 'export_ready':
          subject = 'Your Data Export is Ready';
          text = `Your data export is ready for download.\n\nRequest ID: ${data.requestId}\nDownload URL: ${data.exportUrl}\nExpires: ${new Date(data.expiresAt).toLocaleString()}`;
          html = `
            <h2>Data Export Ready</h2>
            <p>Your data export is ready for download.</p>
            <p><strong>Request ID:</strong> ${data.requestId}</p>
            <p><a href="${data.exportUrl}">Download Export</a></p>
            <p><small>This link expires on ${new Date(data.expiresAt).toLocaleString()}</small></p>
          `;
          break;
        case 'request_received':
          subject = 'DSAR Request Received';
          text = `Your DSAR request has been received.\n\nRequest ID: ${data.requestId}\nType: ${data.requestType}`;
          html = `
            <h2>DSAR Request Received</h2>
            <p>Your request has been received and is being processed.</p>
            <p><strong>Request ID:</strong> ${data.requestId}</p>
            <p><strong>Type:</strong> ${data.requestType}</p>
          `;
          break;
        default:
          return;
      }

      await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject,
        text,
        html
      });

      console.log(`✅ Notification sent to ${email}: ${type}`);
    } catch (error) {
      console.error(`❌ Failed to send notification to ${email}:`, error.message);
    }
  }

  /**
   * Process pending requests that need attention
   */
  async processPendingRequests() {
    try {
      // Find requests that have been verified but not processed
      const pendingRequests = await DSARRequest.find({
        status: 'processing',
        verifiedAt: { $exists: true },
        completedAt: { $exists: false }
      }).limit(10);

      for (const request of pendingRequests) {
        try {
          if (request.requestType === 'export') {
            await this.autoGenerateExport(request.requestId);
          } else if (request.requestType === 'delete') {
            // Auto-delete requires admin approval, so we just notify
            await this.sendNotification(request.requestorEmail, 'request_received', {
              requestId: request.requestId,
              requestType: request.requestType
            });
          }
        } catch (error) {
          console.error(`❌ Failed to process request ${request.requestId}:`, error.message);
        }
      }

      return { processed: pendingRequests.length };
    } catch (error) {
      console.error('❌ Error processing pending requests:', error.message);
      throw error;
    }
  }
}

export default new DSARAutomationService();

