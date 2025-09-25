import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  useTheme
} from '@mui/material';
import {
  Phone,
  Dashboard,
  Security,
  Speed,
  Cloud,
  Analytics
} from '@mui/icons-material';

const Home = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  const features = [
    {
      icon: <Phone />,
      title: 'AI Voice Calling',
      description: 'Advanced AI-powered voice calling system with real-time transcription'
    },
    {
      icon: <Dashboard />,
      title: 'Admin Dashboard',
      description: 'Comprehensive admin panel for managing users and system settings'
    },
    {
      icon: <Security />,
      title: 'Enterprise Security',
      description: 'Role-based access control with JWT authentication and MFA support'
    },
    {
      icon: <Speed />,
      title: 'Real-time Updates',
      description: 'Live status updates and notifications via WebSocket connections'
    },
    {
      icon: <Cloud />,
      title: 'Cloud Ready',
      description: 'Built for scalability with modern cloud-native architecture'
    },
    {
      icon: <Analytics />,
      title: 'Analytics',
      description: 'Detailed call analytics and reporting capabilities'
    }
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${theme.palette.primary.main}20 0%, ${theme.palette.secondary.main}20 100%)`,
        py: 8
      }}
    >
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Chip 
            label="Enterprise Voice Platform" 
            color="primary" 
            sx={{ mb: 3, fontWeight: 'bold' }}
          />
          
          <Typography
            variant="h2"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 'bold',
              background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 3
            }}
          >
            Robert Voice Agent
          </Typography>
          
          <Typography
            variant="h5"
            color="text.secondary"
            paragraph
            sx={{ maxWidth: 600, mx: 'auto', mb: 4 }}
          >
            Revolutionize your business communications with our AI-powered voice calling platform. 
            Streamline customer interactions and boost productivity.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/auth/login')}
              sx={{ px: 4, py: 1.5 }}
            >
              Get Started
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/mvp')}
              sx={{ px: 4, py: 1.5 }}
            >
              Try Demo
            </Button>
          </Box>
        </Box>

        {/* Features Grid */}
        <Grid container spacing={4} sx={{ mb: 8 }}>
          {features.map((feature, index) => (
            <Grid item xs={12} md={6} lg={4} key={index}>
              <Card
                sx={{
                  height: '100%',
                  transition: 'transform 0.3s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                  }
                }}
              >
                <CardContent sx={{ p: 3, textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2
                    }}
                  >
                    {React.cloneElement(feature.icon, { fontSize: 'large' })}
                  </Box>
                  
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    {feature.title}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Call to Action */}
        <Card sx={{ textAlign: 'center', p: 6, background: `linear-gradient(45deg, ${theme.palette.primary.main}10, ${theme.palette.secondary.main}10)` }}>
          <Typography variant="h4" gutterBottom fontWeight="bold">
            Ready to Transform Your Business?
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Join thousands of businesses already using Robert Voice Agent to streamline their communications.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/auth/register')}
            sx={{ px: 6, py: 2 }}
          >
            Start Free Trial
          </Button>
        </Card>
      </Container>
    </Box>
  );
};

export default Home;