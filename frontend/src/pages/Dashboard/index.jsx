import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
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
import { useSocket } from '../../hooks/useSocket';
import { useToast } from '../../components/common/ToastProvider';
import MetricCard from '../../components/common/MetricCard';
import ActiveCallsTable from '../../components/common/ActiveCallsTable';
import AlertsPanel from '../../components/common/AlertsPanel';
import QuickActionsPanel from '../../components/common/QuickActionsPanel';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { on, off } = useSocket();
  const { showSuccess, showError } = useToast();

  // Mock data for dashboard
  const [metrics, setMetrics] = useState({
    totalCalls: 1247,
    activeCalls: 3,
    bookings: 89,
    users: 156
  });
  const [activeCalls, setActiveCalls] = useState([
    {
      callSid: 'CA1234567890abcdef1234567890abcdef',
      callerId: 'CA1234567890abcdef1234567890abcdef',
      status: 'In Progress',
      duration: 120,
      assignedNumber: '+44123456789',
      agent: 'AI Agent'
    },
    {
      callSid: 'CA0987654321fedcba0987654321fedcba',
      callerId: 'CA0987654321fedcba0987654321fedcba',
      status: 'In Progress',
      duration: 45,
      assignedNumber: '+44111111111',
      agent: 'AI Agent'
    }
  ]);
  const [alerts, setAlerts] = useState([
    {
      id: '1',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      level: 'error',
      message: 'Database connection timeout',
      context: { service: 'database', retryCount: 3 },
      service: 'robert-ai'
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 600000).toISOString(),
      level: 'warn',
      message: 'High memory usage detected',
      context: { memoryUsage: '85%', threshold: '80%' },
      service: 'robert-ai'
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 900000).toISOString(),
      level: 'error',
      message: 'AI service response timeout',
      context: { service: 'openai', timeout: '30s' },
      service: 'robert-ai'
    }
  ]);
  const [systemStatus, setSystemStatus] = useState({
    routingEnabled: true,
    mcpToolsActive: false
  });
  const [loading, setLoading] = useState({
    metrics: false,
    calls: false,
    alerts: false
  });

  // Role-based visibility
  const canSeeQuickActions = user?.role === 'owner' || user?.role === 'admin';

  // Initialize with mock data (no API calls needed)
  useEffect(() => {
    // Dashboard is now using mock data only
    console.log('Dashboard initialized with mock data');
  }, []);

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
    navigate(`/transcripts/${call.callSid}`);
  };

  const handleDismissAlert = (alertId) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const handleToggleMCPTools = () => {
    navigate('/admin/system');
  };

  const handlePauseRouting = async () => {
    try {
      // Simulate API call
      setSystemStatus(prev => ({
        ...prev,
        routingEnabled: !prev.routingEnabled
      }));
    } catch (error) {
      showError('Failed to toggle routing status');
    }
  };

  const handleRefreshSystem = () => {
    // Mock refresh - just show success message
    showSuccess('Dashboard refreshed successfully');
  };

  // Business metrics for dashboard
  const visibleMetrics = [
    {
      title: 'Total Calls',
      value: metrics.totalCalls,
      icon: <PhoneCallback />,
      color: 'primary',
      change: '+12',
      changeType: 'positive',
      onClick: () => handleMetricCardClick('totalCalls')
    },
    {
      title: 'Active Calls',
      value: metrics.activeCalls,
      icon: <Phone />,
      color: 'primary',
      change: '+2',
      changeType: 'positive',
      onClick: () => handleMetricCardClick('activeCalls')
    },
    {
      title: 'Bookings',
      value: metrics.bookings,
      icon: <Event />,
      color: 'primary',
      change: '+5',
      changeType: 'positive',
      onClick: () => handleMetricCardClick('bookings')
    },
    {
      title: 'Users',
      value: metrics.users,
      icon: <People />,
      color: 'primary',
      change: '+3',
      changeType: 'positive',
      onClick: () => handleMetricCardClick('users')
    }
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Monitor your Robert Voice Agent system performance and manage operations
        </Typography>
      </Box>

      {/* Section A: Business Metrics */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          flexWrap: 'wrap',
          gap: 3,
          mb: 4,
          width: '100%'
        }}
      >
        {visibleMetrics.map((metric, index) => (
          <Box
            key={index}
            sx={{
              flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' },
              minWidth: 0
            }}
          >
            <MetricCard
              title={metric.title}
              value={metric.value}
              icon={metric.icon}
              color={metric.color}
              change={metric.change}
              changeType={metric.changeType}
              onClick={metric.onClick}
              loading={loading.metrics}
            />
          </Box>
        ))}
      </Box>

      {/* Section B: Active Calls Panel */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h5" component="h2" gutterBottom fontWeight="bold">
          Live Calls
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Real-time view of active calls in the system
        </Typography>
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
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 3,
          alignItems: 'stretch'
        }}
      >
        {/* Alerts Panel */}
        <Box
          sx={{
            flex: canSeeQuickActions ? '1 1 50%' : '1 1 100%',
            minWidth: 0
          }}
        >
          <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h5" component="h2" gutterBottom fontWeight="bold">
              System Alerts
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Recent system notifications and warnings
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ flex: 1 }}>
              <AlertsPanel
                alerts={alerts}
                onDismiss={handleDismissAlert}
              />
            </Box>
          </Paper>
        </Box>

        {/* Quick Actions Panel (Owner/Admin only) */}
        {canSeeQuickActions && (
          <Box
            sx={{
              flex: '1 1 50%',
              minWidth: 0
            }}
          >
            <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <QuickActionsPanel
                onToggleMCPTools={handleToggleMCPTools}
                onPauseRouting={handlePauseRouting}
                onRefreshSystem={handleRefreshSystem}
                systemStatus={systemStatus}
              />
            </Paper>
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default Dashboard;