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
  // Get active calls
  async getActiveCalls() {
    const response = await apiClient.get('/api/audio-telephony/active-calls');
    return response.data;
  }
};

export default telephonyService;