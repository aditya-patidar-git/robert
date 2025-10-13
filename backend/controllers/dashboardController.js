import CallRecord from '../models/CallRecord.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';

// Get comprehensive dashboard analytics
export const getDashboardAnalytics = async (req, res) => {
  try {
    console.log('📊 Fetching dashboard analytics...');
    console.log('🔐 User authenticated:', req.user?.email, 'Role:', req.user?.role);

    // Execute all queries in parallel for better performance
    const [
      totalCalls,
      activeCalls,
      totalBookings,
      totalUsers,
      liveCalls
    ] = await Promise.all([
      // Total Calls - count all call records
      CallRecord.countDocuments(),
      
      // Active Calls - count records with 'in-progress' status
      CallRecord.countDocuments({ callStatus: 'in-progress' }),
      
      // Total Bookings - count all bookings
      Booking.countDocuments(),
      
      // Total Users - count all users
      User.countDocuments(),
      
      // Live Calls - get active calls with details
      CallRecord.find(
        { callStatus: 'in-progress' },
        {
          callSid: 1,
          from: 1,
          to: 1,
          duration: 1,
          createdAt: 1,
          callStatus: 1
        }
      ).sort({ createdAt: -1 }).limit(10) // Limit to 10 most recent active calls
    ]);

    // Transform live calls data for frontend
    const transformedLiveCalls = liveCalls.map(call => ({
      callSid: call.callSid,
      callerId: call.callSid, // Using callSid as callerId for now
      status: call.callStatus === 'in-progress' ? 'In Progress' : call.callStatus,
      duration: call.duration || 0,
      assignedNumber: call.from || 'Unknown',
      agent: 'AI Agent',
      startTime: call.createdAt
    }));

    // Structure the response
    const dashboardData = {
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        totalCalls,
        activeCalls,
        totalBookings,
        totalUsers
      },
      liveCalls: transformedLiveCalls,
      systemStatus: {
        database: 'connected',
        lastUpdated: new Date().toISOString()
      }
    };

    // console.log('📊 Dashboard analytics fetched successfully:', {
    //   totalCalls,
    //   activeCalls,
    //   totalBookings,
    //   totalUsers,
    //   liveCallsCount: liveCalls.length
    // });

    res.json(dashboardData);

  } catch (error) {
    console.error('❌ Error fetching dashboard analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard analytics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

