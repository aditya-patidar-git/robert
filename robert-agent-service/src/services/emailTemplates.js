/**
 * Email Templates for Universal Motorcycle Training
 * Provides HTML and plain text templates for various email types
 */

/**
 * Get email template by name
 * @param {string} templateName - Name of the template
 * @returns {Object|null} Template object with subject, text, and html functions
 */
export function getTemplate(templateName) {
  const templates = {
    booking_confirmation,
    booking_reminder,
    cancellation,
    complaint_summary,
    voicemail_notification
  };

  return templates[templateName] || null;
}

/**
 * Booking Confirmation Email Template
 * @param {Object} data - Template data
 * @param {string} data.customerName - Customer name
 * @param {string} data.bookingReference - Booking reference number
 * @param {string} data.courseType - Type of course (e.g., "CBT", "TfL One-to-One")
 * @param {string} data.date - Booking date (DD/MM/YYYY format)
 * @param {string} data.time - Booking time (24-hour format, e.g., "10:00")
 * @param {string} data.centre - Training centre name
 * @param {string} [data.address] - Centre address
 * @param {string} [data.policyNote] - Policy citation or note
 * @param {string} [data.additionalInfo] - Additional information
 */
export const booking_confirmation = {
  subject: (data) => `Booking Confirmation - Universal Motorcycle Training - ${data.bookingReference || 'Your Booking'}`,
  
  text: (data) => {
    let email = `Dear ${data.customerName || 'Customer'},\n\n`;
    email += `Your booking has been confirmed with Universal Motorcycle Training.\n\n`;
    email += `Booking Details:\n`;
    email += `- Booking Reference: ${data.bookingReference || 'N/A'}\n`;
    email += `- Course Type: ${data.courseType || 'N/A'}\n`;
    email += `- Date: ${data.date || 'N/A'}\n`;
    email += `- Time: ${data.time || 'N/A'}\n`;
    email += `- Centre: ${data.centre || 'N/A'}\n`;
    if (data.address) {
      email += `- Address: ${data.address}\n`;
    }
    email += `\n`;
    
    if (data.policyNote) {
      email += `Policy Information:\n`;
      email += `${data.policyNote}\n\n`;
    }
    
    if (data.additionalInfo) {
      email += `Additional Information:\n`;
      email += `${data.additionalInfo}\n\n`;
    }
    
    email += `Please arrive 15 minutes before your scheduled time.\n\n`;
    email += `If you need to make any changes to your booking, please contact us as soon as possible.\n\n`;
    email += `We look forward to seeing you.\n\n`;
    email += `Best regards,\n`;
    email += `Universal Motorcycle Training\n`;
    email += `Robert AI Phone Agent\n\n`;
    email += `---\n`;
    email += `This is an automated confirmation email. For enquiries, please call us or email complaints@universalmct.co.uk\n`;
    
    return email;
  },
  
  html: (data) => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1a1a1a; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #1a1a1a; }
    .detail-row { margin: 8px 0; }
    .label { font-weight: bold; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Universal Motorcycle Training</h1>
    </div>
    <div class="content">
      <p>Dear ${data.customerName || 'Customer'},</p>
      <p>Your booking has been confirmed with Universal Motorcycle Training.</p>
      
      <div class="details">
        <h2>Booking Details</h2>
        <div class="detail-row"><span class="label">Booking Reference:</span> ${data.bookingReference || 'N/A'}</div>
        <div class="detail-row"><span class="label">Course Type:</span> ${data.courseType || 'N/A'}</div>
        <div class="detail-row"><span class="label">Date:</span> ${data.date || 'N/A'}</div>
        <div class="detail-row"><span class="label">Time:</span> ${data.time || 'N/A'}</div>
        <div class="detail-row"><span class="label">Centre:</span> ${data.centre || 'N/A'}</div>
        ${data.address ? `<div class="detail-row"><span class="label">Address:</span> ${data.address}</div>` : ''}
      </div>
      
      ${data.policyNote ? `<p><strong>Policy Information:</strong><br>${data.policyNote}</p>` : ''}
      ${data.additionalInfo ? `<p><strong>Additional Information:</strong><br>${data.additionalInfo}</p>` : ''}
      
      <p>Please arrive 15 minutes before your scheduled time.</p>
      <p>If you need to make any changes to your booking, please contact us as soon as possible.</p>
      <p>We look forward to seeing you.</p>
      <p>Best regards,<br>Universal Motorcycle Training<br>Robert AI Phone Agent</p>
    </div>
    <div class="footer">
      <p>This is an automated confirmation email. For enquiries, please call us or email complaints@universalmct.co.uk</p>
    </div>
  </div>
</body>
</html>`;
  }
};

/**
 * Booking Reminder Email Template
 * @param {Object} data - Template data
 * @param {string} data.customerName - Customer name
 * @param {string} data.bookingReference - Booking reference number
 * @param {string} data.courseType - Type of course
 * @param {string} data.date - Booking date
 * @param {string} data.time - Booking time
 * @param {string} data.centre - Training centre name
 */
export const booking_reminder = {
  subject: (data) => `Reminder: Your Booking Tomorrow - Universal Motorcycle Training`,
  
  text: (data) => {
    let email = `Dear ${data.customerName || 'Customer'},\n\n`;
    email += `This is a reminder about your upcoming booking with Universal Motorcycle Training.\n\n`;
    email += `Booking Details:\n`;
    email += `- Booking Reference: ${data.bookingReference || 'N/A'}\n`;
    email += `- Course Type: ${data.courseType || 'N/A'}\n`;
    email += `- Date: ${data.date || 'N/A'}\n`;
    email += `- Time: ${data.time || 'N/A'}\n`;
    email += `- Centre: ${data.centre || 'N/A'}\n\n`;
    email += `Please remember to:\n`;
    email += `- Arrive 15 minutes before your scheduled time\n`;
    email += `- Bring all required documents\n`;
    email += `- Wear appropriate clothing\n\n`;
    email += `If you need to reschedule or cancel, please contact us as soon as possible.\n\n`;
    email += `Best regards,\n`;
    email += `Universal Motorcycle Training\n`;
    
    return email;
  },
  
  html: (data) => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1a1a1a; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #1a1a1a; }
    .detail-row { margin: 8px 0; }
    .label { font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Booking Reminder</h1>
    </div>
    <div class="content">
      <p>Dear ${data.customerName || 'Customer'},</p>
      <p>This is a reminder about your upcoming booking with Universal Motorcycle Training.</p>
      
      <div class="details">
        <h2>Booking Details</h2>
        <div class="detail-row"><span class="label">Booking Reference:</span> ${data.bookingReference || 'N/A'}</div>
        <div class="detail-row"><span class="label">Course Type:</span> ${data.courseType || 'N/A'}</div>
        <div class="detail-row"><span class="label">Date:</span> ${data.date || 'N/A'}</div>
        <div class="detail-row"><span class="label">Time:</span> ${data.time || 'N/A'}</div>
        <div class="detail-row"><span class="label">Centre:</span> ${data.centre || 'N/A'}</div>
      </div>
      
      <p><strong>Please remember to:</strong></p>
      <ul>
        <li>Arrive 15 minutes before your scheduled time</li>
        <li>Bring all required documents</li>
        <li>Wear appropriate clothing</li>
      </ul>
      
      <p>If you need to reschedule or cancel, please contact us as soon as possible.</p>
      <p>Best regards,<br>Universal Motorcycle Training</p>
    </div>
  </div>
</body>
</html>`;
  }
};

/**
 * Cancellation Email Template
 * @param {Object} data - Template data
 * @param {string} data.customerName - Customer name
 * @param {string} data.bookingReference - Booking reference number
 * @param {string} data.courseType - Type of course
 * @param {string} data.date - Original booking date
 * @param {string} [data.refundInfo] - Refund information
 * @param {string} [data.policyNote] - Policy citation
 */
export const cancellation = {
  subject: (data) => `Booking Cancelled - Universal Motorcycle Training - ${data.bookingReference || 'Your Booking'}`,
  
  text: (data) => {
    let email = `Dear ${data.customerName || 'Customer'},\n\n`;
    email += `Your booking has been cancelled as requested.\n\n`;
    email += `Cancelled Booking Details:\n`;
    email += `- Booking Reference: ${data.bookingReference || 'N/A'}\n`;
    email += `- Course Type: ${data.courseType || 'N/A'}\n`;
    email += `- Original Date: ${data.date || 'N/A'}\n\n`;
    
    if (data.refundInfo) {
      email += `Refund Information:\n`;
      email += `${data.refundInfo}\n\n`;
    }
    
    if (data.policyNote) {
      email += `Policy Information:\n`;
      email += `${data.policyNote}\n\n`;
    }
    
    email += `If you have any questions or would like to make a new booking, please contact us.\n\n`;
    email += `Best regards,\n`;
    email += `Universal Motorcycle Training\n`;
    
    return email;
  },
  
  html: (data) => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1a1a1a; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #d32f2f; }
    .detail-row { margin: 8px 0; }
    .label { font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Booking Cancelled</h1>
    </div>
    <div class="content">
      <p>Dear ${data.customerName || 'Customer'},</p>
      <p>Your booking has been cancelled as requested.</p>
      
      <div class="details">
        <h2>Cancelled Booking Details</h2>
        <div class="detail-row"><span class="label">Booking Reference:</span> ${data.bookingReference || 'N/A'}</div>
        <div class="detail-row"><span class="label">Course Type:</span> ${data.courseType || 'N/A'}</div>
        <div class="detail-row"><span class="label">Original Date:</span> ${data.date || 'N/A'}</div>
      </div>
      
      ${data.refundInfo ? `<p><strong>Refund Information:</strong><br>${data.refundInfo}</p>` : ''}
      ${data.policyNote ? `<p><strong>Policy Information:</strong><br>${data.policyNote}</p>` : ''}
      
      <p>If you have any questions or would like to make a new booking, please contact us.</p>
      <p>Best regards,<br>Universal Motorcycle Training</p>
    </div>
  </div>
</body>
</html>`;
  }
};

/**
 * Complaint Summary Email Template
 * @param {Object} data - Template data
 * @param {string} data.customerName - Customer name (masked)
 * @param {string} data.callSid - Call SID
 * @param {string} data.complaintText - Complaint details
 * @param {string} [data.summary] - Call summary
 */
export const complaint_summary = {
  subject: (data) => `Complaint Summary - Call ${data.callSid || 'N/A'}`,
  
  text: (data) => {
    let email = `Complaint Summary\n\n`;
    email += `Call Details:\n`;
    email += `- Call SID: ${data.callSid || 'N/A'}\n`;
    email += `- Date: ${new Date().toLocaleDateString('en-GB')}\n\n`;
    email += `Complaint Details:\n`;
    email += `${data.complaintText || 'N/A'}\n\n`;
    
    if (data.summary) {
      email += `Call Summary:\n`;
      email += `${data.summary}\n\n`;
    }
    
    email += `This complaint has been logged and will be reviewed in line with our procedures.\n`;
    
    return email;
  },
  
  html: (data) => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #d32f2f; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #d32f2f; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Complaint Summary</h1>
    </div>
    <div class="content">
      <div class="details">
        <h2>Call Details</h2>
        <p><strong>Call SID:</strong> ${data.callSid || 'N/A'}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
      </div>
      
      <div class="details">
        <h2>Complaint Details</h2>
        <p>${(data.complaintText || 'N/A').replace(/\n/g, '<br>')}</p>
      </div>
      
      ${data.summary ? `<div class="details"><h2>Call Summary</h2><p>${data.summary.replace(/\n/g, '<br>')}</p></div>` : ''}
      
      <p>This complaint has been logged and will be reviewed in line with our procedures.</p>
    </div>
  </div>
</body>
</html>`;
  }
};

/**
 * Voicemail Notification Email Template
 * @param {Object} data - Template data
 * @param {string} data.callerId - Caller ID (masked)
 * @param {string} data.timestamp - Voicemail timestamp
 * @param {string} [data.recordingUrl] - Recording URL
 * @param {string} [data.transcript] - Transcript summary
 * @param {string} [data.duration] - Recording duration
 */
export const voicemail_notification = {
  subject: (data) => `New Voicemail Received - ${data.timestamp || new Date().toLocaleDateString('en-GB')}`,
  
  text: (data) => {
    let email = `New Voicemail Received\n\n`;
    email += `Call Details:\n`;
    email += `- Caller ID: ${data.callerId || 'Unknown'}\n`;
    email += `- Timestamp: ${data.timestamp || new Date().toLocaleString('en-GB')}\n`;
    if (data.duration) {
      email += `- Duration: ${data.duration}\n`;
    }
    email += `\n`;
    
    if (data.transcript) {
      email += `Transcript Summary:\n`;
      email += `${data.transcript}\n\n`;
    }
    
    if (data.recordingUrl) {
      email += `Recording URL: ${data.recordingUrl}\n\n`;
    }
    
    email += `Please review the voicemail and respond as appropriate.\n`;
    
    return email;
  },
  
  html: (data) => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1976d2; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #1976d2; }
    .detail-row { margin: 8px 0; }
    .label { font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Voicemail Received</h1>
    </div>
    <div class="content">
      <div class="details">
        <h2>Call Details</h2>
        <div class="detail-row"><span class="label">Caller ID:</span> ${data.callerId || 'Unknown'}</div>
        <div class="detail-row"><span class="label">Timestamp:</span> ${data.timestamp || new Date().toLocaleString('en-GB')}</div>
        ${data.duration ? `<div class="detail-row"><span class="label">Duration:</span> ${data.duration}</div>` : ''}
      </div>
      
      ${data.transcript ? `<div class="details"><h2>Transcript Summary</h2><p>${data.transcript.replace(/\n/g, '<br>')}</p></div>` : ''}
      
      ${data.recordingUrl ? `<p><strong>Recording URL:</strong> <a href="${data.recordingUrl}">${data.recordingUrl}</a></p>` : ''}
      
      <p>Please review the voicemail and respond as appropriate.</p>
    </div>
  </div>
</body>
</html>`;
  }
};

