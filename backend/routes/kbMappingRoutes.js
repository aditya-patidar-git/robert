import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/rbacMiddleware.js";
import {
  getAllMappings,
  getMappingByFileId,
  saveMapping,
  deleteMapping,
  bulkImportMappings,
  exportMappings,
  syncWithDatabase,
  validateUrl,
  testMapping
} from "../controllers/kbMappingController.js";

const router = express.Router();

// Protect all routes + RBAC
router.use(protect);
router.use(authorizeRoles("owner", "admin"));

// KB Mapping Routes
router.get("/", getAllMappings);
router.get("/file/:fileId", getMappingByFileId);
router.post("/", saveMapping);
router.put("/:fileId", saveMapping);
router.delete("/:fileId", deleteMapping);
router.post("/bulk-import", bulkImportMappings);
router.get("/export", exportMappings);
router.post("/sync", syncWithDatabase);
router.post("/validate-url", validateUrl);
router.post("/test/:fileId", testMapping);

export default router;

