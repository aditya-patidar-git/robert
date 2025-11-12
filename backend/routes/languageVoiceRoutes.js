import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/rbacMiddleware.js";
import {
  getLanguageMappings,
  getLanguageMapping,
  updateLanguageMapping,
  bulkUpdateLanguageMappings
} from "../controllers/languageVoiceController.js";

const router = express.Router();

// Protect all routes + RBAC
router.use(protect);
router.use(authorizeRoles("owner", "admin"));

// Language/Voice Mapping Routes
router.get("/language-voice-mappings", getLanguageMappings);
router.get("/language-voice-mappings/:languageCode", getLanguageMapping);
router.put("/language-voice-mappings/:languageCode", updateLanguageMapping);
router.put("/language-voice-mappings", bulkUpdateLanguageMappings);

export default router;

