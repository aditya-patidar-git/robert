import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/rbacMiddleware.js';
import { getUnansweredQuestions } from '../controllers/unansweredQuestionsController.js';

const router = express.Router();

// Protect all routes + RBAC (owner and admin only)
router.use(protect);
router.use(authorizeRoles('owner', 'admin'));

// Get unanswered questions
router.get('/', getUnansweredQuestions);

export default router;
