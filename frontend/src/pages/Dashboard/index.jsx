import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Grid,
  Paper,
  Divider
} from '@mui/material';
import {
  Phone,
  Speed,
  StarRate,
  Error as ErrorIcon
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
  const { on, off, emit } = useSocket();
  const { showSuccess, showError } = useToast();

  // State management
  const [metrics, setMetrics] = useState({
    activeCalls: 0,
    averageLatency: 0,
    mos: 0,
    errorCount: 0
  });
  const [activeCalls, setActiveCalls] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [systemStatus, setSystemStatus] = useState({
    routingEnabled: true,
    mcpToolsActive: false
  });
  const [loading, setLoading] = useState({
    metrics: true,
    calls: true,
    alerts: true
  });

  // Role-based visibility
  const canSeeAllMetrics = user?.role === 'owner' || user?.role === 'admin';
  const canSeeQuickActions = user?.role === 'owner' || user?.role === 'admin';
  const canSeeAllCalls = user?.role === 'owner' || user?.role === 'admin';

  // Mock data for demonstration (will be replaced with real API calls)
  const mockMetrics = {
    activeCalls: 12,
    averageLatency: 145,
    mos: 4.2,
    errorCount: 3
  };

  const mockActiveCalls = [
    {
      callSid: 'call_001',
      callerId: '+1234567890',
      status: 'In Progress',
      duration: 180,
      assignedNumber: '+1987654321',
      agent: 'AI Agent'
    },
    {
      callSid: 'call_002',
      callerId: '+1987654321',
      status: 'On Hold',
      duration: 95,
      assignedNumber: '+1234567890',
      agent: 'Human Agent'
    },
    {
      callSid: 'call_003',
      callerId: '+1555666777',
      status: 'In Progress',
      duration: 45,
      assignedNumber: '+1111222333',
      agent: 'AI Agent'
    }
  ];

  const mockAlerts = [
    {
      id: 'alert_001',
      severity: 'warning',
      title: 'High Latency Detected',
      message: 'Average call latency has exceeded 200ms threshold',
      timestamp: new Date().toISOString(),
      details: 'Affecting 15% of active calls'
    },
    {
      id: 'alert_002',
      severity: 'error',
      title: 'API Rate Limit',
      message: 'Twilio API rate limit reached',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      details: 'Some calls may experience delays'
    }
  ];

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Simulate API calls with mock data
        setTimeout(() => {
          setMetrics(mockMetrics);
          setLoading(prev => ({ ...prev, metrics: false }));
        }, 1000);

        setTimeout(() => {
          setActiveCalls(mockActiveCalls);
          setLoading(prev => ({ ...prev, calls: false }));
        }, 1200);

        setTimeout(() => {
          setAlerts(mockAlerts);
          setLoading(prev => ({ ...prev, alerts: false }));
        }, 800);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        showError('Failed to load dashboard data');
      }
    };

    fetchInitialData();
  }, []);

  // WebSocket event handlers
  useEffect(() => {
    const handleActiveCalls = (data) => {
      setActiveCalls(data);
    };

    const handleMetricsUpdate = (data) => {
      setMetrics(data);
    };

    const handleSystemAlert = (alert) => {
      setAlerts(prev => [alert, ...prev]);
    };

    // Subscribe to WebSocket events
    on('activeCalls', handleActiveCalls);
    on('metricsUpdate', handleMetricsUpdate);
    on('systemAlert', handleSystemAlert);

    return () => {
      off('activeCalls', handleActiveCalls);
      off('metricsUpdate', handleMetricsUpdate);
      off('systemAlert', handleSystemAlert);
    };
  }, [on, off]);

  // Event handlers
  const handleMetricCardClick = (metricType) => {
    switch (metricType) {
      case 'activeCalls':
        navigate('/transcripts');
        break;
      case 'errorCount':
        navigate('/observability');
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

  const handleRefreshSystem = async () => {
    try {
      // Simulate refresh
      setLoading({ metrics: true, calls: true, alerts: true });
      
      // Refresh data
      setTimeout(() => {
        setMetrics(mockMetrics);
        setActiveCalls(mockActiveCalls);
        setLoading({ metrics: false, calls: false, alerts: false });
      }, 1000);
    } catch (error) {
      showError('Failed to refresh system data');
    }
  };

  // Filter metrics based on user role
  const visibleMetrics = [
    {
      title: 'Active Calls',
      value: metrics.activeCalls,
      icon: <Phone />,
      color: 'primary',
      change: '+2',
      changeType: 'positive',
      onClick: () => handleMetricCardClick('activeCalls')
    },
    ...(canSeeAllMetrics ? [
      {
        title: 'Avg Latency',
        value: `${metrics.averageLatency}ms`,
        icon: <Speed />,
        color: 'info',
        change: '-12ms',
        changeType: 'positive'
      }
    ] : []),
    {
      title: 'MOS Score',
      value: metrics.mos.toFixed(1),
      icon: <StarRate />,
      color: 'success',
      change: '+0.2',
      changeType: 'positive'
    },
    ...(canSeeAllMetrics ? [
      {
        title: 'Errors (24h)',
        value: metrics.errorCount,
        icon: <ErrorIcon />,
        color: 'error',
        change: '+1',
        changeType: 'negative',
        onClick: () => handleMetricCardClick('errorCount')
      }
    ] : [])
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

      {/* Section A: Header Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {visibleMetrics.map((metric, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
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
          </Grid>
        ))}
      </Grid>

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
      <Grid container spacing={3}>
        {/* Alerts Panel */}
        <Grid item xs={12} md={canSeeQuickActions ? 8 : 12}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h5" component="h2" gutterBottom fontWeight="bold">
              System Alerts
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Recent system notifications and warnings
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <AlertsPanel
              alerts={alerts}
              onDismiss={handleDismissAlert}
            />
          </Paper>
        </Grid>

        {/* Quick Actions Panel (Owner/Admin only) */}
        {canSeeQuickActions && (
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <QuickActionsPanel
                onToggleMCPTools={handleToggleMCPTools}
                onPauseRouting={handlePauseRouting}
                onRefreshSystem={handleRefreshSystem}
                systemStatus={systemStatus}
              />
            </Paper>
          </Grid>
        )}
      </Grid>
    </Container>
  );
};

export default Dashboard;