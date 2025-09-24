import React from 'react';
import {
  Container,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Box,
  Chip,
  Avatar,
  Alert
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Analytics,
  People,
  Settings,
  Notifications,
  TrendingUp
} from '@mui/icons-material';

const Dashboard = () => {
  const stats = [
    {
      title: 'Total Users',
      value: '1,234',
      icon: <People />,
      color: 'primary',
      change: '+12%'
    },
    {
      title: 'Revenue',
      value: '$45,678',
      icon: <TrendingUp />,
      color: 'success',
      change: '+8%'
    },
    {
      title: 'Analytics',
      value: '89%',
      icon: <Analytics />,
      color: 'info',
      change: '+3%'
    },
    {
      title: 'Notifications',
      value: '23',
      icon: <Notifications />,
      color: 'warning',
      change: '+5'
    }
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Welcome to your Robert Voice Agent dashboard. Monitor your system performance and manage operations.
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 4 }}>
        This is the main dashboard for Robert Voice Agent platform. Here you'll find system overview and quick actions.
      </Alert>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: `${stat.color}.main`, mr: 2 }}>
                    {stat.icon}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" component="div">
                      {stat.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stat.title}
                    </Typography>
                  </Box>
                </Box>
                <Chip
                  label={stat.change}
                  color={stat.color}
                  size="small"
                  variant="outlined"
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Main Content Cards */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h5" component="h2" gutterBottom>
                Recent Activity
              </Typography>
              <Typography variant="body1" color="text.secondary">
                This section will display your recent system activity, call analytics, and performance metrics.
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" startIcon={<Analytics />}>
                View Analytics
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h5" component="h2" gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button variant="outlined" startIcon={<People />}>
                  Manage Users
                </Button>
                <Button variant="outlined" startIcon={<Settings />}>
                  System Settings
                </Button>
                <Button variant="outlined" startIcon={<Notifications />}>
                  View Notifications
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;