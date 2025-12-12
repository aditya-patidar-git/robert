import { chromium } from 'playwright';
import itmBookingService from '../services/itmBookingService.js';

export const testITMBooking = async (req, res) => {
  let browser;
  let context;
  let page;
  
  try {
    console.log('🚀 Starting ITM booking demo...');
    console.log('🔍 Controller: About to launch browser...');
    
    // Launch browser in visible mode
    browser = await chromium.launch({ 
      headless: false,  // Show browser window
      slowMo: 500,      // Slow down actions for visibility
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    console.log('🔍 Controller: Browser launched successfully');
    
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    
    console.log('🔍 Controller: Context created successfully');
    
    page = await context.newPage();
    
    console.log('🔍 Controller: Page created successfully, calling service...');
    
    // Execute the full workflow
    const result = await itmBookingService.executeITMBookingDemo(page);
    
    console.log('✅ ITM booking demo completed successfully');
    
    // Enhanced response with detailed test results
    res.json({
      success: result.success !== false,
      message: result.success !== false 
        ? 'ITM booking demo completed successfully' 
        : 'ITM booking demo completed with errors',
      sessionDetails: result.sessionDetails,
      screenshots: result.screenshots || [],
      clientEmail: result.clientEmail || process.env.TEST_CLIENT_EMAIL || process.env.CLIENT_EMAIL_ADDRESS,
      workflowSteps: result.workflowSteps || {
        mobileSearchAttempts: 0,
        verificationCompleted: false,
        policyCheckPerformed: false,
        confirmationEmailSent: false
      },
      testState: result.testState || {},
      error: result.error || null
    });
    
  } catch (error) {
    console.error('❌ ITM booking demo failed:', error);
    console.error('❌ Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    
  } finally {
    // Always close browser resources in finally block
    console.log('🔍 Controller: Closing browser resources...');
    try {
      if (page) {
        console.log('🔍 Controller: Closing page...');
        await page.close();
      }
      if (context) {
        console.log('🔍 Controller: Closing context...');
        await context.close();
      }
      if (browser) {
        console.log('🔍 Controller: Closing browser...');
        await browser.close();
      }
      console.log('🔍 Controller: All browser resources closed');
    } catch (closeError) {
      console.error('Error closing browser resources:', closeError);
    }
  }
};
