import CallRecord from "../models/CallRecord.js";
import EscalationLog from "../models/EscalationLog.js";
import ComplaintRecord from "../models/ComplaintRecord.js";
import Provenance from "../models/Provenance.js";
import { io } from "../server.js";
import { escapeRegex } from "../utils/regexUtils.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isValidTranscriptId(id) {
  return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
}

// Get all transcripts with filtering and pagination
export const getAllTranscripts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      result,
      escalated,
      hasComplaint,
      consentStatus,
      startDate,
      endDate,
      userId
    } = req.query;

    const filter = {};

    // Role-based filtering
    if (userId && req.user.role !== 'owner' && req.user.role !== 'admin') {
      // Users can only see their own calls (if we track user association)
      filter.userId = userId;
    }

    // Search filter
    if (search) {
      const escapedSearch = escapeRegex(search);
      filter.$or = [
        { from: { $regex: escapedSearch, $options: 'i' } },
        { to: { $regex: escapedSearch, $options: 'i' } },
        { 'transcript.text': { $regex: escapedSearch, $options: 'i' } },
        { summary: { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    // Result filter
    if (result) {
      filter.result = result;
    }

    // Escalation filter
    if (escalated !== undefined) {
      filter['escalation.escalated'] = escalated === 'true';
    }

    // Complaint filter
    if (hasComplaint !== undefined) {
      filter['complaint.hasComplaint'] = hasComplaint === 'true';
    }

    // Consent status filter
    if (consentStatus) {
      if (consentStatus === 'given') {
        // Consent given OR not explicitly denied (null/undefined = opt-in default)
        filter.$or = filter.$or || [];
        // If we already have an $or from search, we need to use $and
        if (search) {
          filter.$and = [
            { $or: filter.$or },
            { $or: [
              { 'recordingConsent.given': true },
              { 'recordingConsent.given': { $exists: false } },
              { 'recordingConsent.given': null }
            ]}
          ];
          delete filter.$or;
        } else {
          filter.$or = [
            { 'recordingConsent.given': true },
            { 'recordingConsent.given': { $exists: false } },
            { 'recordingConsent.given': null }
          ];
        }
      } else if (consentStatus === 'denied') {
        filter['recordingConsent.given'] = false;
      }
    }

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transcripts, total] = await Promise.all([
      CallRecord.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      CallRecord.countDocuments(filter)
    ]);

    res.json({
      transcripts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching transcripts:', error);
    res.status(500).json({ error: 'Failed to fetch transcripts' });
  }
};

// Get specific transcript with full details
export const getTranscript = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidTranscriptId(id)) {
      return res.status(400).json({ error: 'Invalid transcript ID' });
    }

    const transcript = await CallRecord.findById(id);
    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    // Get related escalation logs
    const escalations = await EscalationLog.find({ callId: transcript.callSid })
      .sort({ initiatedAt: -1 });

    // Get related complaint records
    const complaints = await ComplaintRecord.find({ callId: transcript.callSid })
      .sort({ submittedAt: -1 });

    // Get provenance data
    const provenance = await Provenance.find({ callId: transcript.callSid })
      .sort({ timestamp: -1 });

    res.json({
      transcript,
      escalations,
      complaints,
      provenance
    });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    res.status(500).json({ error: 'Failed to fetch transcript' });
  }
};

// Search transcripts
export const searchTranscripts = async (req, res) => {
  try {
    const { q, filters = {} } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const escapedQ = escapeRegex(q);
    const searchFilter = {
      $or: [
        { from: { $regex: escapedQ, $options: 'i' } },
        { to: { $regex: escapedQ, $options: 'i' } },
        { 'transcript.text': { $regex: escapedQ, $options: 'i' } },
        { summary: { $regex: escapedQ, $options: 'i' } },
        { 'escalation.reason': { $regex: escapedQ, $options: 'i' } },
        { 'complaint.complaintText': { $regex: escapedQ, $options: 'i' } }
      ],
      ...filters
    };

    const transcripts = await CallRecord.find(searchFilter)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ transcripts });
  } catch (error) {
    console.error('Error searching transcripts:', error);
    res.status(500).json({ error: 'Failed to search transcripts' });
  }
};

// Export transcripts
export const exportTranscripts = async (req, res) => {
  try {
    const { format = 'csv', id, ...filters } = req.query;

    let transcripts;
    let filename;

    if (id) {
      // Export single transcript by ID
      const transcript = await CallRecord.findById(id).lean();
      if (!transcript) {
        return res.status(404).json({ error: 'Transcript not found' });
      }
      // Check consent before export
      if (transcript.recordingConsent?.given === false) {
        return res.status(403).json({ 
          error: 'Transcript not available - consent not given',
          message: 'This transcript cannot be exported as the customer did not provide recording consent.'
        });
      }
      transcripts = [transcript];
      filename = `transcript-${id}`;
    } else {
      // Export filtered transcripts
      transcripts = await CallRecord.find(filters)
        .sort({ createdAt: -1 })
        .lean();
      filename = 'transcripts';
    }

    if (format === 'csv') {
      const csvData = generateCSV(transcripts);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
      res.send(csvData);
    } else if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.json`);
      res.json({ transcripts });
    } else {
      res.status(400).json({ error: 'Unsupported format' });
    }
  } catch (error) {
    console.error('Error exporting transcripts:', error);
    res.status(500).json({ error: 'Failed to export transcripts' });
  }
};

// Delete/Redact transcript
export const deleteTranscript = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidTranscriptId(id)) {
      return res.status(400).json({ error: 'Invalid transcript ID' });
    }
    const { redact = false } = req.body;

    const transcript = await CallRecord.findById(id);
    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    if (redact) {
      // Redact PII instead of deleting
      transcript.transcript = transcript.transcript.map(turn => ({
        ...turn,
        text: redactPII(turn.text),
        redactions: ['PII_REDACTED']
      }));
      transcript.summary = redactPII(transcript.summary);
      await transcript.save();

      res.json({ message: 'Transcript redacted successfully' });
    } else {
      // Hard delete
      await CallRecord.findByIdAndDelete(id);
      res.json({ message: 'Transcript deleted successfully' });
    }
  } catch (error) {
    console.error('Error deleting transcript:', error);
    res.status(500).json({ error: 'Failed to delete transcript' });
  }
};

// Submit complaint
export const submitComplaint = async (req, res) => {
  try {
    const { callId, complaintText, complaintType, callerId, priority } = req.body;

    if (!callId || !complaintText) {
      return res.status(400).json({ error: 'Call ID and complaint text are required' });
    }

    // Find the call record
    const callRecord = await CallRecord.findOne({ callSid: callId });
    if (!callRecord) {
      return res.status(404).json({ error: 'Call record not found' });
    }

    // Create complaint record with priority (high-risk types auto-set to 'urgent' from frontend)
    const complaint = new ComplaintRecord({
      callId,
      callSid: callRecord.callSid,
      callerId: callerId || callRecord.from,
      complaintText,
      complaintType: complaintType || 'other',
      priority: priority || 'medium',
      createdBy: req.user.id
    });

    await complaint.save();

    // Update call record
    callRecord.complaint.hasComplaint = true;
    callRecord.complaint.complaintText = complaintText;
    callRecord.complaint.complaintSubmittedAt = new Date();
    await callRecord.save();

    // Emit real-time update
    io.emit('complaint-submitted', { callId, complaintId: complaint._id });

    res.json({
      message: 'Complaint submitted successfully',
      complaintId: complaint._id,
      complaintEmail: 'complaints@universalmct.co.uk'
    });
  } catch (error) {
    console.error('Error submitting complaint:', error);
    res.status(500).json({ error: 'Failed to submit complaint' });
  }
};

// Get escalation timeline
export const getEscalationTimeline = async (req, res) => {
  try {
    const { callId } = req.params;

    const escalations = await EscalationLog.find({ callId })
      .sort({ initiatedAt: -1 })
      .lean();

    res.json({ escalations });
  } catch (error) {
    console.error('Error fetching escalation timeline:', error);
    res.status(500).json({ error: 'Failed to fetch escalation timeline' });
  }
};

// Helper functions
function generateCSV(transcripts) {
  const headers = [
    'Call SID',
    'From',
    'To',
    'Date',
    'Duration',
    'Result',
    'Escalated',
    'Has Complaint',
    'Summary'
  ];

  const rows = transcripts.map(t => [
    t.callSid,
    t.from,
    t.to,
    t.createdAt.toISOString(),
    t.duration || 0,
    t.result,
    t.escalation?.escalated || false,
    t.complaint?.hasComplaint || false,
    t.summary || ''
  ]);

  return [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
}

function redactPII(text) {
  if (!text) return text;

  // Redact phone numbers
  text = text.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]');

  // Redact email addresses
  text = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]');

  // Redact credit card numbers (basic pattern)
  text = text.replace(/\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g, '[CARD_REDACTED]');

  return text;
}





