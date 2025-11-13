import ComplaintRecord from "../models/ComplaintRecord.js";
import CallRecord from "../models/CallRecord.js";
import EscalationLog from "../models/EscalationLog.js";
import { io } from "../server.js";

// Get all complaints with filtering and pagination
export const getAllComplaints = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      complaintType,
      assignedTo,
      startDate,
      endDate,
      search
    } = req.query;

    const filter = {};

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Priority filter
    if (priority) {
      filter.priority = priority;
    }

    // Complaint type filter
    if (complaintType) {
      filter.complaintType = complaintType;
    }

    // Assigned to filter
    if (assignedTo) {
      filter.assignedTo = assignedTo;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.submittedAt = {};
      if (startDate) filter.submittedAt.$gte = new Date(startDate);
      if (endDate) filter.submittedAt.$lte = new Date(endDate);
    }

    // Search filter
    if (search) {
      filter.$or = [
        { callerId: { $regex: search, $options: 'i' } },
        { complaintText: { $regex: search, $options: 'i' } },
        { callSid: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [complaints, total] = await Promise.all([
      ComplaintRecord.find(filter)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      ComplaintRecord.countDocuments(filter)
    ]);

    res.json({
      complaints,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
};

// Get complaint by ID with related data
export const getComplaint = async (req, res) => {
  try {
    const { id } = req.params;

    const complaint = await ComplaintRecord.findById(id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    // Get related call record
    const callRecord = await CallRecord.findOne({ callSid: complaint.callSid });

    // Get related escalation logs
    const escalations = await EscalationLog.find({ callId: complaint.callSid })
      .sort({ initiatedAt: -1 });

    res.json({
      complaint,
      callRecord,
      escalations
    });
  } catch (error) {
    console.error('Error fetching complaint:', error);
    res.status(500).json({ error: 'Failed to fetch complaint' });
  }
};

// Update complaint status
export const updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['open', 'investigating', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const complaint = await ComplaintRecord.findById(id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const oldStatus = complaint.status;
    complaint.status = status;
    complaint.lastModifiedBy = req.user.id;

    // Update resolution if provided
    if (resolution !== undefined) {
      complaint.resolution = resolution;
    }

    // Set resolvedAt if status is resolved or closed
    if ((status === 'resolved' || status === 'closed') && !complaint.resolvedAt) {
      complaint.resolvedAt = new Date();
    }

    // Add to modification history
    complaint.modificationHistory.push({
      modifiedBy: req.user.id,
      modifiedAt: new Date(),
      changes: `Status changed from ${oldStatus} to ${status}`,
      reason: resolution || 'Status update'
    });

    await complaint.save();

    // Update call record if it exists
    const callRecord = await CallRecord.findOne({ callSid: complaint.callSid });
    if (callRecord) {
      callRecord.complaint.complaintStatus = status;
      if (status === 'resolved' || status === 'closed') {
        callRecord.complaint.complaintResolvedAt = new Date();
      }
      await callRecord.save();
    }

    // Emit real-time update
    io.emit('complaint-updated', { complaintId: complaint._id, status });

    res.json({
      message: 'Complaint status updated successfully',
      complaint
    });
  } catch (error) {
    console.error('Error updating complaint status:', error);
    res.status(500).json({ error: 'Failed to update complaint status' });
  }
};

// Assign complaint to manager
export const assignComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    if (!assignedTo) {
      return res.status(400).json({ error: 'Assigned to email is required' });
    }

    const complaint = await ComplaintRecord.findById(id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const oldAssignedTo = complaint.assignedTo;
    complaint.assignedTo = assignedTo;
    complaint.lastModifiedBy = req.user.id;

    // Add to modification history
    complaint.modificationHistory.push({
      modifiedBy: req.user.id,
      modifiedAt: new Date(),
      changes: `Assignment changed from ${oldAssignedTo || 'unassigned'} to ${assignedTo}`,
      reason: 'Manager assignment'
    });

    await complaint.save();

    // Emit real-time update
    io.emit('complaint-assigned', { complaintId: complaint._id, assignedTo });

    res.json({
      message: 'Complaint assigned successfully',
      complaint
    });
  } catch (error) {
    console.error('Error assigning complaint:', error);
    res.status(500).json({ error: 'Failed to assign complaint' });
  }
};

// Update complaint priority
export const updateComplaintPriority = async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    if (!priority) {
      return res.status(400).json({ error: 'Priority is required' });
    }

    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }

    const complaint = await ComplaintRecord.findById(id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const oldPriority = complaint.priority;
    complaint.priority = priority;
    complaint.lastModifiedBy = req.user.id;

    // Add to modification history
    complaint.modificationHistory.push({
      modifiedBy: req.user.id,
      modifiedAt: new Date(),
      changes: `Priority changed from ${oldPriority} to ${priority}`,
      reason: 'Priority update'
    });

    await complaint.save();

    // Emit real-time update
    io.emit('complaint-priority-updated', { complaintId: complaint._id, priority });

    res.json({
      message: 'Complaint priority updated successfully',
      complaint
    });
  } catch (error) {
    console.error('Error updating complaint priority:', error);
    res.status(500).json({ error: 'Failed to update complaint priority' });
  }
};

// Get complaint statistics
export const getComplaintStats = async (req, res) => {
  try {
    const stats = await ComplaintRecord.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          open: {
            $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
          },
          investigating: {
            $sum: { $cond: [{ $eq: ['$status', 'investigating'] }, 1, 0] }
          },
          resolved: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
          },
          closed: {
            $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] }
          },
          urgent: {
            $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] }
          },
          high: {
            $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
          },
          medium: {
            $sum: { $cond: [{ $eq: ['$priority', 'medium'] }, 1, 0] }
          },
          low: {
            $sum: { $cond: [{ $eq: ['$priority', 'low'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get complaints by type
    const byType = await ComplaintRecord.aggregate([
      {
        $group: {
          _id: '$complaintType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get recent complaints (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentCount = await ComplaintRecord.countDocuments({
      submittedAt: { $gte: thirtyDaysAgo }
    });

    res.json({
      overview: stats[0] || {
        total: 0,
        open: 0,
        investigating: 0,
        resolved: 0,
        closed: 0,
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      byType,
      recentCount
    });
  } catch (error) {
    console.error('Error fetching complaint statistics:', error);
    res.status(500).json({ error: 'Failed to fetch complaint statistics' });
  }
};

