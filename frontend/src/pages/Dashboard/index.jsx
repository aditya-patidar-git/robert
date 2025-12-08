import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Box,
  Paper,
  Divider
} from '@mui/material';
import {
  Phone,
  PhoneCallback,
  Event,
  People
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/ToastProvider';
import MetricCard from '../../components/common/MetricCard';
import ActiveCallsTable from '../../components/common/ActiveCallsTable';
import AlertsPanel from '../../components/common/AlertsPanel';
import QuickActionsPanel from '../../components/common/QuickActionsPanel';
import dashboardService from '../../services/dashboardService';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  // Dashboard state
  const [metrics, setMetrics] = useState({
    totalCalls: 0,
    activeCalls: 0,
    bookings: 0,
    users: 0
  });
  const [activeCalls, setActiveCalls] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [metricChanges, setMetricChanges] = useState(null);
  const [comparisonPeriod, setComparisonPeriod] = useState('7d');
  const [loading, setLoading] = useState({
    metrics: true,
    calls: true,
    alerts: false
  });

  // Role-based visibility
  const canSeeQuickActions = user?.role === 'owner' || user?.role === 'admin';

  // Fetch dashboard data from API
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading({ metrics: true, calls: true, alerts: false });

        const dashboardData = await dashboardService.getDashboardAnalytics();

        if (dashboardData.success && dashboardData.data) {
          const data = dashboardData.data;
          // Update metrics
          setMetrics({
            totalCalls: data.metrics?.totalCalls || 0,
            activeCalls: data.metrics?.activeCalls || 0,
            bookings: data.metrics?.totalBookings || 0,
            users: data.metrics?.totalUsers || 0
          });

          // Update active calls
          setActiveCalls(data.liveCalls || []);

          // Update alerts from API
          setAlerts(data.alerts || []);

          // Update system status from API
          setSystemStatus(data.systemStatus || null);

          // Update metric changes from API
          setMetricChanges(data.metrics?.metricChanges || null);

          // Update comparison period from API
          setComparisonPeriod(data.comparisonPeriod || '7d');

        } else {
          console.error('❌ Dashboard API returned error:', dashboardData.error);
          showError('Failed to load dashboard data');
        }
      } catch (error) {
        console.error('❌ Error fetching dashboard data:', error);
        showError('Failed to load dashboard data');

        // Set fallback data on error
        setMetrics({
          totalCalls: 0,
          activeCalls: 0,
          bookings: 0,
          users: 0
        });
        setActiveCalls([]);
        setAlerts([]);
        setSystemStatus(null);
        setMetricChanges(null);
      } finally {
        setLoading({ metrics: false, calls: false, alerts: false });
      }
    };

    fetchDashboardData();
  }, [showError]);

  // WebSocket handlers removed - using mock data only

  // Event handlers
  const handleMetricCardClick = (metricType) => {
    switch (metricType) {
      case 'totalCalls':
        navigate('/transcripts');
        break;
      case 'activeCalls':
        navigate('/transcripts');
        break;
      case 'bookings':
        navigate('/admin/booking');
        break;
      case 'users':
        navigate('/admin/users');
        break;
      default:
        break;
    }
  };

  const handleCallRowClick = (call) => {
    navigate(`/admin/transcripts`, { 
      state: { 
        callSid: call.callSid || call.id,
        highlightCall: true 
      } 
    });
  };

  const handleDismissAlert = (alertId) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const handleToggleMCPTools = () => {
    navigate('/admin/system');
  };

  const handlePauseRouting = async () => {
    try {
      const response = await dashboardService.toggleRouting();
      if (response.success && response.data) {
        setSystemStatus(response.data.systemStatus);
        showSuccess(response.data.message || 'Routing status updated successfully');
      } else {
        showError('Failed to toggle routing status');
      }
    } catch (error) {
      console.error('❌ Error toggling routing:', error);
      showError('Failed to toggle routing status');
    }
  };

  const handleRefreshSystem = async () => {
    try {
      setLoading({ metrics: true, calls: true, alerts: false });
      console.log('🔄 Refreshing dashboard data...');

      const dashboardData = await dashboardService.getDashboardAnalytics();

      if (dashboardData.success && dashboardData.data) {
        const data = dashboardData.data;
        // Update metrics
        setMetrics({
          totalCalls: data.metrics?.totalCalls || 0,
          activeCalls: data.metrics?.activeCalls || 0,
          bookings: data.metrics?.totalBookings || 0,
          users: data.metrics?.totalUsers || 0
        });

        // Update active calls
        setActiveCalls(data.liveCalls || []);

        // Update alerts from API
        setAlerts(data.alerts || []);

        // Update system status from API
        setSystemStatus(data.systemStatus || null);

        // Update metric changes from API
        setMetricChanges(data.metrics?.metricChanges || null);

        // Update comparison period from API
        setComparisonPeriod(data.comparisonPeriod || '7d');

        showSuccess('Dashboard refreshed successfully');
      } else {
        showError('Failed to refresh dashboard data');
      }
    } catch (error) {
      console.error('❌ Error refreshing dashboard:', error);
      showError('Failed to refresh dashboard data');
    } finally {
      setLoading({ metrics: false, calls: false, alerts: false });
    }
  };

  // Business metrics for dashboard
  const visibleMetrics = [
    {
      title: 'Total Calls',
      value: metrics.totalCalls,
      icon: <PhoneCallback />,
      color: 'primary',
      change: metricChanges?.totalCalls ? `${metricChanges.totalCalls.changeType === 'positive' ? '+' : metricChanges.totalCalls.changeType === 'negative' ? '-' : ''}${metricChanges.totalCalls.change}` : null,
      changeType: metricChanges?.totalCalls?.changeType || 'neutral',
      onClick: null
    },
    {
      title: 'Active Calls',
      value: metrics.activeCalls,
      icon: <Phone />,
      color: 'primary',
      change: metricChanges?.activeCalls ? `${metricChanges.activeCalls.changeType === 'positive' ? '+' : metricChanges.activeCalls.changeType === 'negative' ? '-' : ''}${metricChanges.activeCalls.change}` : null,
      changeType: metricChanges?.activeCalls?.changeType || 'neutral',
      onClick: null
    },
    {
      title: 'Bookings',
      value: metrics.bookings,
      icon: <Event />,
      color: 'primary',
      change: metricChanges?.bookings ? `${metricChanges.bookings.changeType === 'positive' ? '+' : metricChanges.bookings.changeType === 'negative' ? '-' : ''}${metricChanges.bookings.change}` : null,
      changeType: metricChanges?.bookings?.changeType || 'neutral',
      onClick: null
    },
    {
      title: 'Users',
      value: metrics.users,
      icon: <People />,
      color: 'primary',
      change: metricChanges?.users ? `${metricChanges.users.changeType === 'positive' ? '+' : metricChanges.users.changeType === 'negative' ? '-' : ''}${metricChanges.users.change}` : null,
      changeType: metricChanges?.users?.changeType || 'neutral',
      onClick: null
    }
  ];

  return (
    <Box sx={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography 
          variant="h4" 
          component="h1" 
          sx={{ 
            fontWeight: 700,
            fontSize: { xs: '1.75rem', md: '2rem' },
            color: 'text.primary',
            mb: 1
          }}
        >
          Dashboard
        </Typography>
        <Typography 
          variant="body1" 
          sx={{ 
            color: 'text.secondary',
            fontSize: '0.9375rem'
          }}
        >
          Monitor your Robert Voice Agent system performance and manage operations
        </Typography>
      </Box>

      {/* Section A: Business Metrics */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(4, 1fr)'
          },
          gap: 3,
          mb: 4
        }}
      >
        {visibleMetrics.map((metric, index) => (
          <MetricCard
            key={index}
            title={metric.title}
            value={metric.value}
            icon={metric.icon}
            color={metric.color}
            change={metric.change}
            changeType={metric.changeType}
            onClick={metric.onClick}
            loading={loading.metrics}
            comparisonPeriod={comparisonPeriod}
          />
        ))}
      </Box>

      {/* Section B: Active Calls Panel */}
      <Paper 
        elevation={0}
        sx={{ 
          p: 3, 
          mb: 4,
          borderRadius: 2
        }}
      >
        <Box sx={{ mb: 3 }}>
          <Typography 
            variant="h6" 
            component="h2"
            sx={{ 
              fontWeight: 600,
              fontSize: '1.125rem',
              color: 'text.primary',
              mb: 0.5
            }}
          >
            Live Calls
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'text.secondary',
              fontSize: '0.875rem'
            }}
          >
            Real-time view of active calls in the system
          </Typography>
        </Box>
        <ActiveCallsTable
          calls={activeCalls}
          loading={loading.calls}
          onRowClick={handleCallRowClick}
          userRole={user?.role}
        />
      </Paper>

      {/* Section C: Alerts & Quick Actions */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: canSeeQuickActions ? 'repeat(2, 1fr)' : '1fr'
          },
          gap: 3
        }}
      >
        {/* Alerts Panel */}
        <Paper 
          elevation={0}
          sx={{ 
            p: 3,
            borderRadius: 2,
            display: 'flex', 
            flexDirection: 'column'
          }}
        >
          <Box sx={{ mb: 3 }}>
            <Typography 
              variant="h6" 
              component="h2"
              sx={{ 
                fontWeight: 600,
                fontSize: '1.125rem',
                color: 'text.primary',
                mb: 0.5
              }}
            >
              System Alerts
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'text.secondary',
                fontSize: '0.875rem'
              }}
            >
              Recent system notifications and warnings
            </Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ flex: 1 }}>
            <AlertsPanel
              alerts={alerts}
              onDismiss={handleDismissAlert}
            />
          </Box>
        </Paper>

        {/* Quick Actions Panel (Owner/Admin only) */}
        {canSeeQuickActions && (
          <Paper 
            elevation={0}
            sx={{ 
              p: 3,
              borderRadius: 2,
              display: 'flex', 
              flexDirection: 'column'
            }}
          >
            <QuickActionsPanel
              onToggleMCPTools={handleToggleMCPTools}
              onPauseRouting={handlePauseRouting}
              onRefreshSystem={handleRefreshSystem}
              systemStatus={systemStatus || { routingEnabled: true, mcpToolsActive: false }}
            />
          </Paper>
        )}
      </Box>
    </Box>
  );
};

export default Dashboard;