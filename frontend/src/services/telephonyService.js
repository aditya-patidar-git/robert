import authenticatedApiClient from '../api/authenticatedApi.js';

const telephonyService = {
  // Get active calls
  async getActiveCalls() {
    const response = await authenticatedApiClient.get('/api/audio-telephony/active-calls');
    return response.data;
  }
};

export default telephonyService;