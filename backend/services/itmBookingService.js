// Wrapper service to import ITM booking service from robert-agent-service
// This allows backend controllers to use the service without cross-directory import issues
// 
// NOTE: This is only for local testing. This endpoint manages its own browser instance
// and passes Playwright page objects, which cannot be serialized over HTTP.
// In production, if this endpoint is needed, it should be refactored to manage
// browser instances within robert-agent-service and use API-based communication.
// For now, we keep the direct import since it's only used for testing purposes.
import itmBookingService from '../../robert-agent-service/src/services/itmBooking/index.js';

export default itmBookingService;

