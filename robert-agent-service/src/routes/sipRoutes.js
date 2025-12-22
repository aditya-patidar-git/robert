/**
 * SIP Routes
 * Routes for OpenAI Realtime SIP webhook handlers
 */

import express from "express";
import { handleCallAccept, handleCallStatus, handleToolExecution } from "../handlers/sipHandlers.js";

const router = express.Router();

// OpenAI Realtime SIP webhook: call.accept
router.post("/call-accept", handleCallAccept);

// OpenAI Realtime SIP webhook: call status updates
router.post("/call-status", handleCallStatus);

// OpenAI Realtime SIP webhook: tool execution
router.post("/tool-execution", handleToolExecution);

export default router;

