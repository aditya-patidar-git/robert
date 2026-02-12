/**
 * SIP Routes
 * Routes for OpenAI Realtime SIP webhook handlers
 */

import express from "express";
import { handleCallAccept, handleCallStatus, handleToolExecution, handleSipCallHandler, handleAgentCallHandler } from "../handlers/sipHandlers.js";
import { openaiWebhookAuth } from "../middleware/openaiWebhookAuth.js";

const router = express.Router();

// Diagnostic logging middleware - catches ALL requests to SIP routes
router.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`🔍 [SIP ROUTE] ${timestamp} - ${req.method} ${req.path}`);
  console.log(`🔍 [SIP ROUTE] Headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`🔍 [SIP ROUTE] Body:`, JSON.stringify(req.body, null, 2));
  console.log(`🔍 [SIP ROUTE] Query:`, JSON.stringify(req.query, null, 2));
  console.log(`🔍 [SIP ROUTE] IP: ${req.ip}, User-Agent: ${req.get('user-agent')}`);
  next();
});

// Test endpoint to verify webhook accessibility
router.get("/call-accept-test", (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`🧪 [SIP TEST] Test endpoint hit at ${timestamp}`);
  console.log(`🧪 [SIP TEST] Request from IP: ${req.ip}`);
  console.log(`🧪 [SIP TEST] Headers:`, JSON.stringify(req.headers, null, 2));
  
  res.json({ 
    success: true, 
    message: "Webhook endpoint is accessible",
    timestamp: timestamp,
    url: req.url,
    method: req.method,
    path: req.path,
    ip: req.ip,
    headers: req.headers
  });
});

// Twilio webhook for SIP connector calls (returns minimal TwiML)
router.post("/call-handler", handleSipCallHandler);

// Transfer: Twilio GET or POST when outbound agent call connects/answers; returns Say + Dial/Conference TwiML
router.get("/agent-call-handler", handleAgentCallHandler);
router.post("/agent-call-handler", handleAgentCallHandler);

// OpenAI Realtime SIP webhooks (optional IP allowlist via OPENAI_WEBHOOK_IP_ALLOWLIST)
router.post("/call-accept", openaiWebhookAuth, handleCallAccept);
router.post("/call-status", openaiWebhookAuth, handleCallStatus);
router.post("/tool-execution", openaiWebhookAuth, handleToolExecution);

export default router;

