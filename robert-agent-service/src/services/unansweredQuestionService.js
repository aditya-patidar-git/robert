/**
 * Unanswered Question Service
 * Handles saving and managing unanswered/difficult questions from agent interactions
 * Designed for low latency - all operations are non-blocking
 */

import crypto from 'crypto';
import UnansweredQuestion from '../database/models/UnansweredQuestion.js';

class UnansweredQuestionService {
  /**
   * Generate hash for question to detect duplicates
   * @param {string} question - Question text
   * @returns {string} Hash string
   */
  generateQuestionHash(question) {
    const normalized = question.toLowerCase().trim().replace(/\s+/g, ' ');
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Determine priority based on failure context
   * @param {number} confidence - Confidence score
   * @param {string} failureReason - Reason for failure
   * @returns {string} Priority level
   */
  determinePriority(confidence, failureReason) {
    if (confidence !== undefined && confidence < 0.3) {
      return 'high';
    }
    if (failureReason === 'both_searches_failed') {
      return 'high';
    }
    if (failureReason === 'uncertainty_gate_failed' && confidence !== undefined && confidence < 0.5) {
      return 'high';
    }
    return 'medium';
  }

  /**
   * Save an unanswered question (non-blocking, async)
   * @param {object} options - Question data
   * @param {string} options.callSid - Call SID
   * @param {string} options.callId - Call ID
   * @param {string} options.callerId - Caller phone number
   * @param {string} options.question - Question text
   * @param {string} options.context - Optional context
   * @param {number} options.confidence - Confidence score
   * @param {string} options.failureReason - Reason for failure
   * @param {object} options.searchResults - Search result metadata
   * @returns {Promise<object|null>} Saved question record or null
   */
  async saveUnansweredQuestion(options) {
    const {
      callSid,
      callId,
      callerId,
      question,
      context,
      confidence,
      failureReason,
      searchResults
    } = options;

    if (!question || !question.trim()) {
      console.warn(`⚠️ [${callSid}] Cannot save unanswered question: question is empty`);
      return null;
    }

    try {
      const questionHash = this.generateQuestionHash(question);

      // Check for duplicate (same question in last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const existing = await UnansweredQuestion.findOne({
        questionHash,
        createdAt: { $gte: sevenDaysAgo },
        status: { $in: ['pending', 'answered'] }
      });

      if (existing) {
        console.log(`📝 [${callSid}] Question already exists in unanswered questions (ID: ${existing._id}), incrementing occurrence count`);
        // Update occurrence count
        existing.occurrenceCount = (existing.occurrenceCount || 1) + 1;
        existing.lastOccurredAt = new Date();
        await existing.save();
        return existing;
      }

      // Determine priority
      const priority = this.determinePriority(confidence, failureReason);

      const unansweredQuestion = new UnansweredQuestion({
        callId,
        callSid,
        callerId: callerId || 'unknown',
        question: question.trim(),
        context: context?.trim(),
        confidence,
        failureReason,
        searchResults,
        questionHash,
        priority
      });

      await unansweredQuestion.save();
      console.log(`📝 [${callSid}] Saved unanswered question: "${question.substring(0, 50)}..." (ID: ${unansweredQuestion._id}, priority: ${priority})`);

      return unansweredQuestion;
    } catch (error) {
      console.error(`❌ [${callSid}] Error saving unanswered question:`, error.message);
      // Don't throw - this shouldn't break the call flow
      return null;
    }
  }

  /**
   * Get unanswered questions (for future admin portal use)
   * @param {object} filters - Filter options
   * @returns {Promise<Array>} Array of unanswered questions
   */
  async getUnansweredQuestions(filters = {}) {
    const {
      status = 'pending',
      limit = 50,
      skip = 0,
      sortBy = 'createdAt',
      sortOrder = -1
    } = filters;

    const query = {};
    if (status) {
      query.status = status;
    }

    return await UnansweredQuestion.find(query)
      .sort({ [sortBy]: sortOrder })
      .limit(limit)
      .skip(skip)
      .lean();
  }
}

export default new UnansweredQuestionService();
