import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const telephonyService = {
  // Make outbound call
  async makeCall(toNumbers) {
    const response = await apiClient.post('/api/outbound/make-call', { toNumbers });
    return response.data;
  },

  // Get all calls
  async getAllCalls() {
    const response = await apiClient.get('/api/outbound/get-all-calls');
    return response.data;
  },

  // Get recording URL
  getRecordingUrl(callSid) {
    return `${API_BASE}/api/outbound/recording/${callSid}`;
  },

  // Get call analytics
  async getCallAnalytics(dateRange) {
    const response = await apiClient.get('/api/telephony/analytics', { 
      params: dateRange 
    });
    return response.data;
  },

  // Get call statistics
  async getCallStats() {
    const response = await apiClient.get('/api/telephony/stats');
    return response.data;
  }
};

export default telephonyService;