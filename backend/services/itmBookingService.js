// Wrapper service to import ITM booking service from robert-agent-service
// This allows backend controllers to use the service without cross-directory import issues
import itmBookingService from '../../robert-agent-service/src/services/itmBookingService.js';

export default itmBookingService;

