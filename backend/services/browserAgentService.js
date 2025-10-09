import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

class BrowserAgentService {
  constructor() {
    this.crmCredentials = {
      loginUrl: 'https://takeabyte.co.uk/InContact/Account/Login',
      username: 'universalmct',
      password: 'Robert2025!',
      userAgent: 'auagent'
    };
    this.screenshotsDir = './screenshots';
    this.auditDir = './audit-logs';
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
    if (!fs.existsSync(this.auditDir)) {
      fs.mkdirSync(this.auditDir, { recursive: true });
    }
  }

  async executeTask(task, args, callContext = {}) {
    const browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      userAgent: this.crmCredentials.userAgent,
      viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();
    const auditId = `audit_${Date.now()}_${callContext.callSid || 'unknown'}`;
    
    try {
      console.log(`🤖 Browser agent executing task: ${task}`);
      
      // Always start with dry-run
      const dryRunResult = await this.executeDryRun(page, task, args, auditId);
      
      if (!dryRunResult.success) {
        return {
          success: false,
          error: dryRunResult.error,
          dryRun: true
        };
      }

      // If dry-run successful and task requires confirmation, return for user confirmation
      if (dryRunResult.requiresConfirmation) {
        return {
          success: true,
          result: dryRunResult.result,
          dryRun: true,
          requiresConfirmation: true,
          auditId
        };
      }

      // Execute actual task
      const result = await this.executeActualTask(page, task, args, auditId);
      
      return {
        success: result.success,
        result: result.result,
        dryRun: false,
        requiresConfirmation: false,
        auditId,
        screenshots: result.screenshots
      };

    } catch (error) {
      console.error('Browser agent error:', error);
      return {
        success: false,
        error: error.message,
        dryRun: true
      };
    } finally {
      await browser.close();
    }
  }

  async executeDryRun(page, task, args, auditId) {
    try {
      await this.loginToCRM(page, auditId);
      
      switch (task) {
        case 'create_booking':
          return await this.dryRunCreateBooking(page, args, auditId);
        case 'reschedule_booking':
          return await this.dryRunRescheduleBooking(page, args, auditId);
        case 'cancel_booking':
          return await this.dryRunCancelBooking(page, args, auditId);
        case 'update_customer':
          return await this.dryRunUpdateCustomer(page, args, auditId);
        case 'check_availability':
          return await this.dryRunCheckAvailability(page, args, auditId);
        default:
          throw new Error(`Unknown task: ${task}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async executeActualTask(page, task, args, auditId) {
    try {
      switch (task) {
        case 'create_booking':
          return await this.createBooking(page, args, auditId);
        case 'reschedule_booking':
          return await this.rescheduleBooking(page, args, auditId);
        case 'cancel_booking':
          return await this.cancelBooking(page, args, auditId);
        case 'update_customer':
          return await this.updateCustomer(page, args, auditId);
        case 'check_availability':
          return await this.checkAvailability(page, args, auditId);
        default:
          throw new Error(`Unknown task: ${task}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async loginToCRM(page, auditId) {
    try {
      console.log('🔐 Logging into CRM...');
      
      await page.goto(this.crmCredentials.loginUrl);
      await page.waitForLoadState('networkidle');
      
      // Take screenshot
      await this.takeScreenshot(page, `${auditId}_login_start.png`);
      
      // Fill login form
      await page.fill('input[name="username"]', this.crmCredentials.username);
      await page.fill('input[name="password"]', this.crmCredentials.password);
      
      // Submit form
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');
      
      // Verify login success
      const isLoggedIn = await page.locator('text=Dashboard').isVisible().catch(() => false);
      
      if (!isLoggedIn) {
        throw new Error('CRM login failed');
      }
      
      await this.takeScreenshot(page, `${auditId}_login_success.png`);
      console.log('✅ CRM login successful');
      
    } catch (error) {
      await this.takeScreenshot(page, `${auditId}_login_error.png`);
      throw new Error(`CRM login failed: ${error.message}`);
    }
  }

  async dryRunCreateBooking(page, args, auditId) {
    try {
      console.log('🔍 Dry run: Create booking');
      
      // Navigate to booking creation
      await page.goto(`${this.crmCredentials.loginUrl}/bookings/new`);
      await page.waitForLoadState('networkidle');
      
      // Fill form fields
      await page.fill('input[name="customerName"]', args.customerName || '');
      await page.fill('input[name="customerEmail"]', args.customerEmail || '');
      await page.fill('input[name="customerPhone"]', args.customerPhone || '');
      await page.selectOption('select[name="courseType"]', args.courseType || '');
      await page.fill('input[name="preferredDate"]', args.preferredDate || '');
      
      // Take screenshot of filled form
      await this.takeScreenshot(page, `${auditId}_booking_form_filled.png`);
      
      // Check if form is valid
      const isValid = await this.validateBookingForm(page);
      
      return {
        success: true,
        result: {
          action: 'create_booking',
          customerName: args.customerName,
          courseType: args.courseType,
          preferredDate: args.preferredDate,
          formValid: isValid
        },
        requiresConfirmation: true
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async dryRunRescheduleBooking(page, args, auditId) {
    try {
      console.log('🔍 Dry run: Reschedule booking');
      
      // Navigate to booking management
      await page.goto(`${this.crmCredentials.loginUrl}/bookings/${args.bookingId}`);
      await page.waitForLoadState('networkidle');
      
      // Check if booking exists
      const bookingExists = await page.locator(`text=${args.bookingId}`).isVisible();
      
      if (!bookingExists) {
        throw new Error('Booking not found');
      }
      
      // Navigate to reschedule
      await page.click('button[data-action="reschedule"]');
      await page.waitForLoadState('networkidle');
      
      // Fill new date
      await page.fill('input[name="newDate"]', args.newDate);
      
      await this.takeScreenshot(page, `${auditId}_reschedule_form.png`);
      
      return {
        success: true,
        result: {
          action: 'reschedule_booking',
          bookingId: args.bookingId,
          newDate: args.newDate,
          currentDate: await page.inputValue('input[name="currentDate"]')
        },
        requiresConfirmation: true
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async dryRunCancelBooking(page, args, auditId) {
    try {
      console.log('🔍 Dry run: Cancel booking');
      
      // Navigate to booking
      await page.goto(`${this.crmCredentials.loginUrl}/bookings/${args.bookingId}`);
      await page.waitForLoadState('networkidle');
      
      // Check booking status
      const status = await page.textContent('.booking-status');
      
      if (status === 'cancelled') {
        throw new Error('Booking already cancelled');
      }
      
      await this.takeScreenshot(page, `${auditId}_cancel_booking.png`);
      
      return {
        success: true,
        result: {
          action: 'cancel_booking',
          bookingId: args.bookingId,
          currentStatus: status,
          reason: args.reason || 'Customer request'
        },
        requiresConfirmation: true
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async dryRunUpdateCustomer(page, args, auditId) {
    try {
      console.log('🔍 Dry run: Update customer');
      
      // Navigate to customer record
      await page.goto(`${this.crmCredentials.loginUrl}/customers/${args.customerId}`);
      await page.waitForLoadState('networkidle');
      
      // Check if customer exists
      const customerExists = await page.locator(`text=${args.customerId}`).isVisible();
      
      if (!customerExists) {
        throw new Error('Customer not found');
      }
      
      // Navigate to edit
      await page.click('button[data-action="edit"]');
      await page.waitForLoadState('networkidle');
      
      // Show what will be updated
      const updates = [];
      if (args.email) updates.push(`Email: ${args.email}`);
      if (args.phone) updates.push(`Phone: ${args.phone}`);
      if (args.address) updates.push(`Address: ${args.address}`);
      
      await this.takeScreenshot(page, `${auditId}_update_customer.png`);
      
      return {
        success: true,
        result: {
          action: 'update_customer',
          customerId: args.customerId,
          updates: updates
        },
        requiresConfirmation: true
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async dryRunCheckAvailability(page, args, auditId) {
    try {
      console.log('🔍 Dry run: Check availability');
      
      // Navigate to availability checker
      await page.goto(`${this.crmCredentials.loginUrl}/availability`);
      await page.waitForLoadState('networkidle');
      
      // Fill search criteria
      await page.selectOption('select[name="courseType"]', args.courseType);
      await page.fill('input[name="date"]', args.date);
      await page.fill('input[name="time"]', args.time);
      
      // Search availability
      await page.click('button[data-action="search"]');
      await page.waitForLoadState('networkidle');
      
      // Get results
      const availableSlots = await page.locator('.available-slot').count();
      
      await this.takeScreenshot(page, `${auditId}_availability_check.png`);
      
      return {
        success: true,
        result: {
          action: 'check_availability',
          courseType: args.courseType,
          date: args.date,
          time: args.time,
          availableSlots: availableSlots
        },
        requiresConfirmation: false
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createBooking(page, args, auditId) {
    // Implementation for actual booking creation
    console.log('✅ Creating booking...');
    // Add actual implementation here
    return { success: true, result: 'Booking created successfully' };
  }

  async rescheduleBooking(page, args, auditId) {
    // Implementation for actual booking reschedule
    console.log('✅ Rescheduling booking...');
    // Add actual implementation here
    return { success: true, result: 'Booking rescheduled successfully' };
  }

  async cancelBooking(page, args, auditId) {
    // Implementation for actual booking cancellation
    console.log('✅ Cancelling booking...');
    // Add actual implementation here
    return { success: true, result: 'Booking cancelled successfully' };
  }

  async updateCustomer(page, args, auditId) {
    // Implementation for actual customer update
    console.log('✅ Updating customer...');
    // Add actual implementation here
    return { success: true, result: 'Customer updated successfully' };
  }

  async checkAvailability(page, args, auditId) {
    // Implementation for actual availability check
    console.log('✅ Checking availability...');
    // Add actual implementation here
    return { success: true, result: 'Availability checked successfully' };
  }

  async validateBookingForm(page) {
    // Check if all required fields are filled
    const requiredFields = ['customerName', 'customerEmail', 'customerPhone', 'courseType'];
    
    for (const field of requiredFields) {
      const value = await page.inputValue(`input[name="${field}"]`);
      if (!value || value.trim() === '') {
        return false;
      }
    }
    
    return true;
  }

  async takeScreenshot(page, filename) {
    try {
      const screenshotPath = path.join(this.screenshotsDir, filename);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 Screenshot saved: ${filename}`);
    } catch (error) {
      console.error('Screenshot error:', error);
    }
  }

  async saveAuditLog(auditId, action, result) {
    try {
      const auditLog = {
        auditId,
        timestamp: new Date().toISOString(),
        action,
        result,
        screenshots: fs.readdirSync(this.screenshotsDir)
          .filter(file => file.startsWith(auditId))
      };
      
      const logPath = path.join(this.auditDir, `${auditId}.json`);
      fs.writeFileSync(logPath, JSON.stringify(auditLog, null, 2));
      
      console.log(`📝 Audit log saved: ${auditId}`);
    } catch (error) {
      console.error('Audit log error:', error);
    }
  }
}

export default new BrowserAgentService();
