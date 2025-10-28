import { chromium } from 'playwright';
import itmBookingService from '../services/itmBookingService.js';

export const testITMBooking = async (req, res) => {
  let browser;
  
  try {
    console.log('🚀 Starting ITM booking demo...');
    
    // Launch browser in visible mode
    browser = await chromium.launch({ 
      headless: false,  // Show browser window
      slowMo: 500,      // Slow down actions for visibility
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    
    const page = await context.newPage();
    
    // Execute the full workflow
    const result = await itmBookingService.executeITMBookingDemo(page);
    
    // Close browser after completion
    await browser.close();
    
    console.log('✅ ITM booking demo completed successfully');
    
    res.json({
      success: true,
      message: 'ITM booking demo completed successfully',
      sessionDetails: result.sessionDetails,
      screenshots: result.screenshots,
      clientEmail: process.env.CLIENT_EMAIL_ADDRESS
    });
    
  } catch (error) {
    console.error('❌ ITM booking demo failed:', error);
    
    if (browser) {
      await browser.close();
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
