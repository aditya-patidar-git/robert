import CallRecord from '../models/CallRecord.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import TelephonyConfig from '../models/TelephonyConfig.js';
import AIConfig from '../models/AIConfig.js';
import mongoose from 'mongoose';
import observabilityService from '../services/observabilityService.js';
import mcpToolsService from '../services/mcpToolsService.js';

// Helper function to calculate metric changes
const calculateMetricChange = (current, previous) => {
  if (previous === 0) {
    return current > 0 ? { change: current, changeType: 'positive' } : { change: 0, changeType: 'neutral' };
  }
  const change = current - previous;
  const changeType = change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral';
  return { change: Math.abs(change), changeType };
};

// Get comprehensive dashboard analytics
export const getDashboardAnalytics = async (req, res) => {
  try {
    console.log('📊 Fetching dashboard analytics...');
    console.log('🔐 User authenticated:', req.user?.email, 'Role:', req.user?.role);

    const comparisonPeriod = '7d'; // 7 days comparison period
    const now = new Date();
    const currentPeriodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const previousPeriodStart = new Date(currentPeriodStart.getTime() - 7 * 24 * 60 * 60 * 1000); // 14 days ago

    // Execute all queries in parallel for better performance
    const [
      totalCalls,
      activeCalls,
      totalBookings,
      totalUsers,
      liveCalls,
      // Previous period metrics for comparison
      previousTotalCalls,
      previousActiveCalls,
      previousTotalBookings,
      previousTotalUsers,
      // System configs
      telephonyConfig,
      aiConfig
    ] = await Promise.all([
      // Current period - Total Calls
      CallRecord.countDocuments(),
      
      // Current period - Active Calls
      CallRecord.countDocuments({ callStatus: 'in-progress' }),
      
      // Current period - Total Bookings
      Booking.countDocuments(),
      
      // Current period - Total Users
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
      ).sort({ createdAt: -1 }).limit(10),
      
      // Previous period - Total Calls (last 7 days before current period)
      CallRecord.countDocuments({
        createdAt: { $gte: previousPeriodStart, $lt: currentPeriodStart }
      }),
      
      // Previous period - Active Calls
      // Note: Since "active calls" is a current state metric, we compare by counting
      // calls created in the previous period (as a proxy for activity level)
      CallRecord.countDocuments({
        createdAt: { $gte: previousPeriodStart, $lt: currentPeriodStart }
      }),
      
      // Previous period - Total Bookings
      Booking.countDocuments({
        createdAt: { $gte: previousPeriodStart, $lt: currentPeriodStart }
      }),
      
      // Previous period - Total Users
      User.countDocuments({
        createdAt: { $gte: previousPeriodStart, $lt: currentPeriodStart }
      }),
      
      // TelephonyConfig for routingEnabled
      TelephonyConfig.findOne({ isActive: true }),
      
      // AIConfig for agent name
      AIConfig.findOne({ isActive: true })
    ]);

    // Calculate metric changes
    const metricChanges = {
      totalCalls: {
        ...calculateMetricChange(totalCalls, previousTotalCalls),
        period: comparisonPeriod
      },
      activeCalls: {
        ...calculateMetricChange(activeCalls, previousActiveCalls),
        period: comparisonPeriod
      },
      bookings: {
        ...calculateMetricChange(totalBookings, previousTotalBookings),
        period: comparisonPeriod
      },
      users: {
        ...calculateMetricChange(totalUsers, previousTotalUsers),
        period: comparisonPeriod
      }
    };

    // Get agent name from AIConfig or use default
    const agentName = aiConfig?.model?.name || process.env.AGENT_NAME || 'AI Agent';

    // Transform live calls data for frontend
    const transformedLiveCalls = liveCalls.map(call => {
      // Calculate duration: if call is in-progress, calculate from createdAt to now
      // Otherwise use stored duration
      let duration = call.duration;
      if (call.callStatus === 'in-progress' && call.createdAt) {
        const elapsedSeconds = Math.floor((now - new Date(call.createdAt)) / 1000);
        duration = elapsedSeconds > 0 ? elapsedSeconds : (call.duration || 0);
      } else {
        duration = call.duration || 0;
      }

      // Map status correctly
      let status = call.callStatus;
      if (call.callStatus === 'in-progress') {
        status = 'In Progress';
      } else if (call.callStatus === 'completed') {
        status = 'Completed';
      } else {
        // Capitalize first letter for other statuses
        status = call.callStatus.charAt(0).toUpperCase() + call.callStatus.slice(1);
      }

      return {
        callSid: call.callSid,
        callerId: call.callSid, // Using callSid as callerId for now
        status: status,
        duration: duration,
        assignedNumber: call.from || 'Unknown',
        agent: agentName,
        startTime: call.createdAt
      };
    });

    // Get alerts from observability service
    const alerts = observabilityService.getAlerts({ status: 'active', limit: 20 });

    // Get MCP tools status
    const mcpTools = mcpToolsService.getAllTools();
    const mcpToolsActive = mcpTools.some(tool => tool.enabled);

    // Get database health status
    const dbReadyState = mongoose.connection.readyState;
    const dbStatusMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    const databaseStatus = dbStatusMap[dbReadyState] || 'unknown';

    // Get routing enabled status
    const routingEnabled = telephonyConfig?.routingEnabled ?? true;

    // Structure the response
    const dashboardData = {
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        totalCalls,
        activeCalls,
        totalBookings,
        totalUsers,
        metricChanges
      },
      liveCalls: transformedLiveCalls,
      alerts: alerts,
      systemStatus: {
        routingEnabled,
        mcpToolsActive,
        database: databaseStatus,
        lastUpdated: new Date().toISOString()
      },
      comparisonPeriod
    };

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

// Toggle routing enabled status
export const toggleRouting = async (req, res) => {
  try {
    console.log('🔄 Toggling routing status...');
    console.log('🔐 User authenticated:', req.user?.email, 'Role:', req.user?.role);

    // Get active telephony config
    let telephonyConfig = await TelephonyConfig.findOne({ isActive: true });
    
    if (!telephonyConfig) {
      // Create default configuration if none exists
      telephonyConfig = new TelephonyConfig({
        name: "default",
        routingEnabled: true
      });
    }

    // Toggle routing enabled
    telephonyConfig.routingEnabled = !telephonyConfig.routingEnabled;
    await telephonyConfig.save();

    // Get updated system status
    const mcpTools = mcpToolsService.getAllTools();
    const mcpToolsActive = mcpTools.some(tool => tool.enabled);
    
    const dbReadyState = mongoose.connection.readyState;
    const dbStatusMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    const databaseStatus = dbStatusMap[dbReadyState] || 'unknown';

    res.json({
      success: true,
      systemStatus: {
        routingEnabled: telephonyConfig.routingEnabled,
        mcpToolsActive,
        database: databaseStatus,
        lastUpdated: new Date().toISOString()
      },
      message: `Call routing ${telephonyConfig.routingEnabled ? 'enabled' : 'disabled'} successfully`
    });

  } catch (error) {
    console.error('❌ Error toggling routing status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle routing status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

