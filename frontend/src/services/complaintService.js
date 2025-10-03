import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const complaintService = {
  // Get all complaints with filtering
  async getAllComplaints(params = {}) {
    const response = await apiClient.get('/api/complaints', { params });
    return response.data;
  },

  // Get complaint by ID
  async getComplaint(complaintId) {
    const response = await apiClient.get(`/api/complaints/${complaintId}`);
    return response.data;
  },

  // Submit new complaint
  async submitComplaint(complaintData) {
    const response = await apiClient.post('/api/transcripts/complaint', complaintData);
    return response.data;
  },

  // Update complaint status
  async updateComplaintStatus(complaintId, status, resolution = '') {
    const response = await apiClient.patch(`/api/complaints/${complaintId}/status`, {
      status,
      resolution
    });
    return response.data;
  },

  // Assign complaint to manager
  async assignComplaint(complaintId, assignedTo) {
    const response = await apiClient.patch(`/api/complaints/${complaintId}/assign`, {
      assignedTo
    });
    return response.data;
  },

  // Get complaint statistics
  async getComplaintStats() {
    const response = await apiClient.get('/api/complaints/stats');
    return response.data;
  }
};

export default complaintService;
