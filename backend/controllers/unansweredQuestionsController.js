import UnansweredQuestion from '../models/UnansweredQuestion.js';

/**
 * Get unanswered questions with optional filters
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getUnansweredQuestions = async (req, res) => {
  try {
    const {
      status,
      priority,
      limit = 50,
      skip = 0,
      sortBy = 'createdAt',
      sortOrder = -1,
      startDate,
      endDate
    } = req.query;

    // Build query
    const query = {};

    if (status) {
      query.status = status;
    }

    if (priority) {
      query.priority = priority;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = parseInt(sortOrder) || -1;

    // Execute query
    const questions = await UnansweredQuestion.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    // Get total count for pagination
    const total = await UnansweredQuestion.countDocuments(query);

    res.json({
      status: 'success',
      data: {
        questions,
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });
  } catch (error) {
    console.error('Error fetching unanswered questions:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch unanswered questions',
      error: error.message
    });
  }
};
