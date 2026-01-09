import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        },
        tls: {
          rejectUnauthorized: false // Allow self-signed certificates
        }
      });

      console.log('✅ Email service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error.message);
    }
  }

  async sendEmail(to, subject, html, text = null) {
    if (!this.transporter) {
      console.error('❌ Email transporter not initialized');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@example.com',
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
        text: text || this.htmlToText(html)
      };

      console.log(`📧 Attempting to send email:`);
      console.log(`   To: ${to}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   From: ${mailOptions.from}`);

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ Email sent successfully!`);
      console.log(`   To: ${to}`);
      console.log(`   Message ID: ${info.messageId}`);
      console.log(`   Response: ${info.response || 'N/A'}`);
      
      return { 
        success: true, 
        messageId: info.messageId,
        response: info.response,
        to: to,
        subject: subject
      };
    } catch (error) {
      console.error(`❌ Failed to send email:`);
      console.error(`   To: ${to}`);
      console.error(`   Subject: ${subject}`);
      console.error(`   Error: ${error.message}`);
      console.error(`   Error Code: ${error.code || 'N/A'}`);
      console.error(`   Error Stack: ${error.stack || 'N/A'}`);
      
      return { 
        success: false, 
        error: error.message,
        code: error.code,
        to: to,
        subject: subject
      };
    }
  }

  async testEmailConnection() {
    try {
      if (!this.transporter) {
        return {
          success: false,
          error: 'Email transporter not initialized',
          details: 'Check SMTP configuration in .env file'
        };
      }

      // Verify connection
      await this.transporter.verify();
      
      return {
        success: true,
        message: 'Email service is configured correctly',
        config: {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          secure: process.env.SMTP_SECURE === 'true',
          user: process.env.SMTP_USER,
          from: process.env.EMAIL_FROM
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Email connection test failed',
        message: error.message,
        details: 'Check your SMTP settings in .env file'
      };
    }
  }

  async sendTestEmail(to) {
    const testSubject = 'Test Email - IT Equipment Request System';
    const testHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>✅ Email Test Successful</h2>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>This is a test email from the IT Equipment Request System.</p>
            <p>If you received this email, it means the email notification system is working correctly!</p>
            <p><strong>Test Details:</strong></p>
            <ul>
              <li>Sent at: ${new Date().toLocaleString()}</li>
              <li>SMTP Host: ${process.env.SMTP_HOST}</li>
              <li>SMTP Port: ${process.env.SMTP_PORT}</li>
            </ul>
          </div>
          <div class="footer">
            <p>This is an automated test email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(to, testSubject, testHtml);
  }

  htmlToText(html) {
    // Simple HTML to text conversion
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  // Email templates
  getRequestSubmittedTemplate(request, requestor, departmentApprover) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #4b5563; }
          .button { display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Request Submitted Successfully</h2>
          </div>
          <div class="content">
            <p>Hello ${requestor.first_name} ${requestor.last_name},</p>
            <p>Your equipment request has been submitted successfully and is now pending department approval.</p>
            
            <div class="info-row">
              <span class="label">Request Number:</span> ${request.request_number}
            </div>
            <div class="info-row">
              <span class="label">Department:</span> ${request.Department?.name || 'N/A'}
            </div>
            <div class="info-row">
              <span class="label">Priority:</span> ${request.priority}
            </div>
            <div class="info-row">
              <span class="label">Submitted Date:</span> ${new Date(request.submitted_at || request.created_at).toLocaleString()}
            </div>
            
            <p>Your request is now awaiting approval from ${departmentApprover?.first_name} ${departmentApprover?.last_name} (Department Approver).</p>
            
            <a href="${process.env.FRONTEND_URL}/track?code=${request.request_number}" class="button">Track Your Request</a>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getApprovalRequestTemplate(request, requestor, approver) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #4b5563; }
          .button { display: inline-block; padding: 10px 20px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New Request Pending Approval</h2>
          </div>
          <div class="content">
            <p>Hello ${approver.first_name} ${approver.last_name},</p>
            <p>A new equipment request requires your approval.</p>
            
            <div class="info-row">
              <span class="label">Request Number:</span> ${request.request_number}
            </div>
            <div class="info-row">
              <span class="label">Requestor:</span> ${requestor.first_name} ${requestor.last_name}
            </div>
            <div class="info-row">
              <span class="label">Department:</span> ${request.Department?.name || 'N/A'}
            </div>
            <div class="info-row">
              <span class="label">Priority:</span> ${request.priority}
            </div>
            <div class="info-row">
              <span class="label">Submitted Date:</span> ${new Date(request.submitted_at || request.created_at).toLocaleString()}
            </div>
            
            <a href="${process.env.FRONTEND_URL}/requests/${request.id}" class="button">Review Request</a>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getRequestApprovedTemplate(request, requestor, approver, stage) {
    const stageNames = {
      'department_approval': 'Department Approval',
      'it_manager_approval': 'IT Manager Approval',
      'service_desk_processing': 'Service Desk Processing'
    };
    
    const nextStage = stage === 'department_approval' ? 'IT Manager' : 
                     stage === 'it_manager_approval' ? 'Service Desk' : 
                     'Completed';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #4b5563; }
          .button { display: inline-block; padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Request Approved</h2>
          </div>
          <div class="content">
            <p>Hello ${requestor.first_name} ${requestor.last_name},</p>
            <p>Your equipment request has been approved by ${approver.first_name} ${approver.last_name} (${stageNames[stage]}).</p>
            
            <div class="info-row">
              <span class="label">Request Number:</span> ${request.request_number}
            </div>
            <div class="info-row">
              <span class="label">Status:</span> ${request.status}
            </div>
            ${request.status === 'completed' ? `
            <div class="info-row">
              <span class="label">Completed Date:</span> ${new Date(request.completed_at || new Date()).toLocaleString()}
            </div>
            ` : `
            <p>Your request is now pending ${nextStage} review.</p>
            `}
            
            <a href="${process.env.FRONTEND_URL}/track?code=${request.request_number}" class="button">View Request Status</a>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getRequestDeclinedTemplate(request, requestor, approver, comments) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #4b5563; }
          .comments { background-color: #fee2e2; padding: 15px; border-left: 4px solid #ef4444; margin: 15px 0; }
          .button { display: inline-block; padding: 10px 20px; background-color: #ef4444; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Request Declined</h2>
          </div>
          <div class="content">
            <p>Hello ${requestor.first_name} ${requestor.last_name},</p>
            <p>Unfortunately, your equipment request has been declined by ${approver.first_name} ${approver.last_name}.</p>
            
            <div class="info-row">
              <span class="label">Request Number:</span> ${request.request_number}
            </div>
            <div class="info-row">
              <span class="label">Status:</span> ${request.status}
            </div>
            
            ${comments ? `
            <div class="comments">
              <strong>Comments:</strong><br>
              ${comments}
            </div>
            ` : ''}
            
            <a href="${process.env.FRONTEND_URL}/track?code=${request.request_number}" class="button">View Request Details</a>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getRequestReturnedTemplate(request, requestor, approver, returnReason) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #4b5563; }
          .comments { background-color: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 15px 0; }
          .button { display: inline-block; padding: 10px 20px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Request Returned for Revision</h2>
          </div>
          <div class="content">
            <p>Hello ${requestor.first_name} ${requestor.last_name},</p>
            <p>Your equipment request has been returned by ${approver.first_name} ${approver.last_name} for revision.</p>
            
            <div class="info-row">
              <span class="label">Request Number:</span> ${request.request_number}
            </div>
            
            ${returnReason ? `
            <div class="comments">
              <strong>Revision Required:</strong><br>
              ${returnReason}
            </div>
            ` : ''}
            
            <p>Please review the comments above and update your request accordingly.</p>
            
            <a href="${process.env.FRONTEND_URL}/requests/${request.id}" class="button">Update Request</a>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Send notification methods
  async notifyRequestSubmitted(request, requestor, departmentApprover) {
    if (!requestor.email) {
      console.log(`⚠️ Skipping email - requestor ${requestor.username} has no email`);
      return;
    }

    const subject = `Request Submitted: ${request.request_number}`;
    const html = this.getRequestSubmittedTemplate(request, requestor, departmentApprover);
    
    return await this.sendEmail(requestor.email, subject, html);
  }

  async notifyApprovalRequired(request, requestor, approver) {
    if (!approver.email) {
      console.log(`⚠️ Skipping email - approver ${approver.username} has no email`);
      return;
    }

    const subject = `Action Required: Approve Request ${request.request_number}`;
    const html = this.getApprovalRequestTemplate(request, requestor, approver);
    
    return await this.sendEmail(approver.email, subject, html);
  }

  async notifyRequestApproved(request, requestor, approver, stage) {
    if (!requestor.email) {
      console.log(`⚠️ Skipping email - requestor ${requestor.username} has no email`);
      return;
    }

    const subject = `Request Approved: ${request.request_number}`;
    const html = this.getRequestApprovedTemplate(request, requestor, approver, stage);
    
    return await this.sendEmail(requestor.email, subject, html);
  }

  async notifyRequestDeclined(request, requestor, approver, comments) {
    if (!requestor.email) {
      console.log(`⚠️ Skipping email - requestor ${requestor.username} has no email`);
      return;
    }

    const subject = `Request Declined: ${request.request_number}`;
    const html = this.getRequestDeclinedTemplate(request, requestor, approver, comments);
    
    return await this.sendEmail(requestor.email, subject, html);
  }

  async notifyRequestReturned(request, requestor, approver, returnReason) {
    if (!requestor.email) {
      console.log(`⚠️ Skipping email - requestor ${requestor.username} has no email`);
      return;
    }

    const subject = `Request Returned for Revision: ${request.request_number}`;
    const html = this.getRequestReturnedTemplate(request, requestor, approver, returnReason);
    
    return await this.sendEmail(requestor.email, subject, html);
  }
}

// Export singleton instance
const emailService = new EmailService();
export default emailService;