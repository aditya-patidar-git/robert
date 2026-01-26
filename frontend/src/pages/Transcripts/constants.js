/**
 * Transcripts & Complaints Page Constants
 * Shared constants for reusability across components
 */

// High-risk complaint types that require urgent priority (per documentation)
export const HIGH_RISK_COMPLAINT_TYPES = [
  'safety_concern',
  'discrimination',
  'instructor_conduct'
];

// All complaint type options (reusable across components)
export const COMPLAINT_TYPE_OPTIONS = [
  { value: 'service_quality', label: 'Service Quality' },
  { value: 'ai_understanding', label: 'AI Understanding' },
  { value: 'response_time', label: 'Response Time' },
  { value: 'technical_issue', label: 'Technical Issue' },
  { value: 'billing', label: 'Billing' },
  { value: 'booking', label: 'Booking' },
  { value: 'instructor_conduct', label: 'Instructor Conduct' },
  { value: 'safety_concern', label: 'Safety Concern' },
  { value: 'discrimination', label: 'Discrimination' },
  { value: 'other', label: 'Other' }
];

// Consent filter options
export const CONSENT_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'given', label: 'Consent Given (Available)' },
  { value: 'denied', label: 'Consent Denied (Unavailable)' }
];

// Result filter options
export const RESULT_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'error', label: 'Error' }
];

// Complaint status options
export const COMPLAINT_STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' }
];

// Complaint priority options
export const COMPLAINT_PRIORITY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' }
];

// Default filter state for transcripts
export const DEFAULT_TRANSCRIPT_FILTERS = {
  page: 1,
  limit: 20,
  search: '',
  result: '',
  consentStatus: '',
  startDate: '',
  endDate: ''
};

// Default filter state for complaints
export const DEFAULT_COMPLAINT_FILTERS = {
  page: 1,
  limit: 20,
  search: '',
  status: '',
  priority: '',
  complaintType: '',
  assignedTo: '',
  startDate: '',
  endDate: ''
};

/**
 * Determine complaint priority based on type
 * High-risk types automatically get 'urgent' priority
 * @param {string} complaintType - The complaint type
 * @returns {string} - Priority level ('urgent' or 'medium')
 */
export const getComplaintPriority = (complaintType) => {
  return HIGH_RISK_COMPLAINT_TYPES.includes(complaintType) ? 'urgent' : 'medium';
};

/**
 * Check if a complaint type is high-risk
 * @param {string} complaintType - The complaint type
 * @returns {boolean} - true if high-risk
 */
export const isHighRiskComplaint = (complaintType) => {
  return HIGH_RISK_COMPLAINT_TYPES.includes(complaintType);
};
