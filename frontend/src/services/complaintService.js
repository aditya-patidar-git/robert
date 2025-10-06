import authenticatedApiClient from '../api/authenticatedApi.js';

const complaintService = {
  // Get all complaints with filtering
  async getAllComplaints(params = {}) {
    const response = await authenticatedApiClient.get('/api/complaints', { params });
    return response.data;
  },

  // Get complaint by ID
  async getComplaint(complaintId) {
    const response = await authenticatedApiClient.get(`/api/complaints/${complaintId}`);
    return response.data;
  },

  // Submit new complaint
  async submitComplaint(complaintData) {
    const response = await authenticatedApiClient.post('/api/transcripts/complaint', complaintData);
    return response.data;
  },

  // Update complaint status
  async updateComplaintStatus(complaintId, status, resolution = '') {
    const response = await authenticatedApiClient.patch(`/api/complaints/${complaintId}/status`, {
      status,
      resolution
    });
    return response.data;
  },

  // Assign complaint to manager
  async assignComplaint(complaintId, assignedTo) {
    const response = await authenticatedApiClient.patch(`/api/complaints/${complaintId}/assign`, {
      assignedTo
    });
    return response.data;
  },

  // Get complaint statistics
  async getComplaintStats() {
    const response = await authenticatedApiClient.get('/api/complaints/stats');
    return response.data;
  }
};

export default complaintService;





