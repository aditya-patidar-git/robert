import CallMemory from "../models/CallMemory.js";

/**
 * Memory Controller
 * Handles admin endpoints for viewing and managing call memories
 */

// Get call memories for a specific caller
export const getCallerMemories = async (req, res) => {
  try {
    const { callerId } = req.params;
    
    if (!callerId) {
      return res.status(400).json({
        status: "error",
        message: "Caller ID is required"
      });
    }

    const memories = await CallMemory.find({ callerId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      status: "success",
      callerId,
      count: memories.length,
      memories
    });
  } catch (error) {
    console.error("Error retrieving caller memories:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Delete all memories for a caller (DSAR support)
export const deleteCallerMemories = async (req, res) => {
  try {
    const { callerId } = req.params;
    
    if (!callerId) {
      return res.status(400).json({
        status: "error",
        message: "Caller ID is required"
      });
    }

    const result = await CallMemory.deleteMany({ callerId });
    
    console.log(`🗑️ Deleted ${result.deletedCount} call memories for caller ${callerId} (DSAR request)`);

    res.json({
      status: "success",
      message: `Deleted ${result.deletedCount} call memories for caller ${callerId}`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error("Error deleting caller memories:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Cleanup expired memories (scheduled job endpoint)
export const cleanupExpiredMemories = async (req, res) => {
  try {
    const now = new Date();
    const result = await CallMemory.deleteMany({
      expiresAt: { $lt: now }
    });

    console.log(`🧹 Cleaned up ${result.deletedCount} expired call memories`);

    res.json({
      status: "success",
      message: `Cleaned up ${result.deletedCount} expired memories`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error("Error cleaning up expired memories:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Get memory statistics
export const getMemoryStats = async (req, res) => {
  try {
    const totalMemories = await CallMemory.countDocuments();
    const expiredMemories = await CallMemory.countDocuments({
      expiresAt: { $lt: new Date() }
    });
    const activeMemories = totalMemories - expiredMemories;
    
    // Get unique callers
    const uniqueCallers = await CallMemory.distinct('callerId');

    res.json({
      status: "success",
      stats: {
        totalMemories,
        activeMemories,
        expiredMemories,
        uniqueCallers: uniqueCallers.length
      }
    });
  } catch (error) {
    console.error("Error getting memory stats:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

