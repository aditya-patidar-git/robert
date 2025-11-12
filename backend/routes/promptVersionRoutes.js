import express from 'express';
import {
  getPromptVersions,
  getPromptVersion,
  getCurrentVersion,
  compareVersions,
  rollbackToVersion
} from '../controllers/promptVersionController.js';

const router = express.Router();

// Get all versions for a prompt
router.get('/', getPromptVersions);

// Get current active version
router.get('/current', getCurrentVersion);

// Get specific version by ID
router.get('/:versionId', getPromptVersion);

// Compare two versions
router.get('/compare/:versionId1/:versionId2', compareVersions);

// Rollback to specific version
router.post('/:versionId/rollback', rollbackToVersion);

export default router;

