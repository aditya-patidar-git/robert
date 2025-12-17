import express from 'express';
import {
  getPromptVersions,
  getPromptVersion,
  getCurrentVersion,
  compareVersions,
  getVersionDiff,
  restoreVersion,
  rollbackToVersion,
  activateVersion,
  clearInactiveVersions
} from '../controllers/promptVersionController.js';

const router = express.Router();

// Get all versions for a prompt
router.get('/', getPromptVersions);

// Get current active version
router.get('/current', getCurrentVersion);

// Clear all inactive versions
router.delete('/clear-inactive', clearInactiveVersions);

// Get specific version by ID
router.get('/:versionId', getPromptVersion);

// Compare two versions
router.get('/compare/:versionId1/:versionId2', compareVersions);

// Get version diff
router.get('/:versionId/diff', getVersionDiff);

// Restore version (create new from old)
router.post('/:versionId/restore', restoreVersion);

// Activate a specific version
router.put('/:versionId/activate', activateVersion);

// Rollback to specific version
router.post('/:versionId/rollback', rollbackToVersion);

export default router;

