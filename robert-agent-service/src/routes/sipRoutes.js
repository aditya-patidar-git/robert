/**
 * SIP Routes
 * Routes for OpenAI Realtime SIP webhook handlers
 */

import express from "express";
import { handleCallAccept, handleCallStatus, handleToolExecution, handleSipCallHandler } from "../handlers/sipHandlers.js";

const router = express.Router();

// Twilio webhook for SIP connector calls (returns minimal TwiML)
router.post("/call-handler", handleSipCallHandler);

// OpenAI Realtime SIP webhook: call.accept
router.post("/call-accept", handleCallAccept);

// OpenAI Realtime SIP webhook: call status updates
router.post("/call-status", handleCallStatus);

// OpenAI Realtime SIP webhook: tool execution
router.post("/tool-execution", handleToolExecution);

export default router;

