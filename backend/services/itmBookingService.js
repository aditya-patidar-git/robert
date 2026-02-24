// Wrapper service to call ITM booking service from robert-agent-service via API
// This allows backend controllers to use the service without cross-directory import issues
// and preserves the separation of services.

/**
 * executeITMBookingDemo
 * Calls the agent service API to perform the booking demo
 * @param {Object} page - Playwright page (ignored since agent manages its own browser)
 */
export const executeITMBookingDemo = async (page) => {
    try {
        const axios = (await import('axios')).default;
        const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:3002';

        console.log(`🌐 [backend] Calling agent service API for ITM booking demo at ${AGENT_SERVICE_URL}`);

        const response = await axios.post(`${AGENT_SERVICE_URL}/api/booking/itm/execute`, {}, {
            timeout: 120000 // ITM booking can take time
        });

        if (response.data && response.data.success) {
            return response.data.result;
        } else {
            throw new Error(response.data?.error || 'Failed to execute ITM booking demo via API');
        }
    } catch (error) {
        console.error('❌ [backend] ITM booking API call failed:', error.message);
        throw error;
    }
};

const itmBookingService = {
    executeITMBookingDemo
};

export default itmBookingService;

