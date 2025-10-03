import express from "express";
import { testRetrieval, testSpecificQuery, getTestQueries, addTestQuery, removeTestQuery } from "../controllers/testRetrievalController.js";

const router = express.Router();

// Test Retrieval Routes
router.post("/test", testRetrieval);
router.post("/query", testSpecificQuery);
router.get("/queries", getTestQueries);
router.post("/queries", addTestQuery);
router.delete("/queries", removeTestQuery);

export default router;
