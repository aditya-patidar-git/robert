import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/rbacMiddleware.js";
import { testRetrieval, testSpecificQuery, getTestQueries, addTestQuery, removeTestQuery } from "../controllers/testRetrievalController.js";

const router = express.Router();

// Protect all test retrieval routes + RBAC
router.use(protect);
router.use(authorizeRoles("owner", "admin"));

// Test Retrieval Routes
router.post("/test", testRetrieval);
router.post("/query", testSpecificQuery);
router.get("/queries", getTestQueries);
router.post("/queries", addTestQuery);
router.delete("/queries", removeTestQuery);

export default router;





