import { BaseService } from './baseService';

/**
 * Complaint Service
 * Handles complaint management and tracking
 * @extends BaseService
 */
class ComplaintService extends BaseService {
  constructor() {
    super('/api/complaints', {
      dataPath: null,
      normalizeResponse: true
    });
  }

  /**
   * Get all complaints with filtering
   * @param {Object} params - Filter parameters
   * @returns {Promise<Object>} Complaints data with pagination
   */
  async getAllComplaints(params = {}) {
    return this.get('', params);
  }

  /**
   * Get complaint by ID
   * @param {string} complaintId - Complaint ID
   * @returns {Promise<Object>} Complaint details
   */
  async getComplaint(complaintId) {
    return this.get(`/${complaintId}`);
  }

  /**
   * Submit new complaint
   * @param {Object} complaintData - Complaint data
   * @returns {Promise<Object>} Submitted complaint
   */
  async submitComplaint(complaintData) {
    // Note: This uses a different endpoint
    const response = await this.client.post('/api/transcripts/complaint', complaintData);
    return response.data;
  }

  /**
   * Update complaint status
   * @param {string} complaintId - Complaint ID
   * @param {string} status - New status
   * @param {string} resolution - Resolution notes (default: '')
   * @returns {Promise<Object>} Updated complaint
   */
  async updateComplaintStatus(complaintId, status, resolution = '') {
    return this.patch(`/${complaintId}/status`, {
      status,
      resolution
    });
  }

  /**
   * Assign complaint to manager
   * @param {string} complaintId - Complaint ID
   * @param {string} assignedTo - Manager ID or email
   * @returns {Promise<Object>} Updated complaint
   */
  async assignComplaint(complaintId, assignedTo) {
    return this.patch(`/${complaintId}/assign`, {
      assignedTo
    });
  }

  /**
   * Update complaint priority
   * @param {string} complaintId - Complaint ID
   * @param {string} priority - New priority
   * @returns {Promise<Object>} Updated complaint
   */
  async updateComplaintPriority(complaintId, priority) {
    return this.patch(`/${complaintId}/priority`, {
      priority
    });
  }

  /**
   * Get complaint statistics
   * @returns {Promise<Object>} Complaint statistics
   */
  async getComplaintStats() {
    return this.get('/stats');
  }
}

// Export singleton instance
const complaintService = new ComplaintService();
export default complaintService;
