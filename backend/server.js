// Load .env FIRST before any other imports that might need env vars
import dotenv from "dotenv";
dotenv.config();

// Now import everything else
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import { createServer } from "http";
import { Server } from "socket.io";
import { initializeTelemetry, shutdownTelemetry } from "./utils/telemetry.js";
import { initializeMetrics } from "./services/metricsService.js";

// Initialize OpenTelemetry before other imports
initializeTelemetry();
// Initialize metrics after telemetry
initializeMetrics();
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import itmBookingRoutes from "./routes/itmBookingRoutes.js";
import openaiKbRoutes from "./routes/openaiKbRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import voiceRoutes from "./routes/voiceRoutes.js";
import vectorStoreRoutes from "./routes/vectorStoreRoutes.js";
import fileSearchRoutes from "./routes/fileSearchRoutes.js";
import driftRoutes from "./routes/driftRoutes.js";
import reingestRoutes from "./routes/reingestRoutes.js";
import testRetrievalRoutes from "./routes/testRetrievalRoutes.js";
import provenanceRoutes from "./routes/provenanceRoutes.js";
import uncertaintyGateRoutes from "./routes/uncertaintyGateRoutes.js";
import transcriptRoutes from "./routes/transcriptRoutes.js";
import complaintRoutes from "./routes/complaintRoutes.js";
import audioTelephonyRoutes from "./routes/audioTelephonyRoutes.js";
import mcpToolsRoutes from "./routes/mcpToolsRoutes.js";
import gdprRoutes from "./routes/gdprRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import languageVoiceRoutes from "./routes/languageVoiceRoutes.js";
import privacyConfigRoutes from "./routes/privacyConfigRoutes.js";
import crmTasksConfigRoutes from "./routes/crmTasksConfigRoutes.js";
import promptVersionRoutes from "./routes/promptVersionRoutes.js";
import flowParameterRoutes from "./routes/flowParameterRoutes.js";
import tokenManagementRoutes from "./routes/tokenManagementRoutes.js";
import observabilityRoutes from "./routes/observabilityRoutes.js";
import systemRoutes from "./routes/systemRoutes.js";
import memoryRoutes from "./routes/memoryRoutes.js";
import toolConfigRoutes from "./routes/toolConfigRoutes.js";
import conversationBehaviorRoutes from "./routes/conversationBehaviorRoutes.js";
import templateRoutes from "./routes/templateRoutes.js";
import kbMappingRoutes from "./routes/kbMappingRoutes.js";
import alertRoutes from "./routes/alertRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import unansweredQuestionsRoutes from "./routes/unansweredQuestionsRoutes.js";
import callCleanupService from "./services/callCleanupService.js";
import websocketService from "./services/websocketService.js";
import configSyncService, { setIO as setConfigSyncIO } from "./services/configSyncService.js";
import { setIO as setWebSocketIO } from "./services/websocketService.js";
import { proxyRecording } from "./controllers/outboundController.js";
import { protect as authenticateToken } from "./middleware/authMiddleware.js";

const app = express();
const httpServer = createServer(app);

// Export io for controllers
export const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
});

// Set io instance in services (must be done after io is created)
setConfigSyncIO(io);
setWebSocketIO(io);

// Initialize WebSocket service
websocketService.initialize();

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB connection
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error("❌ [backend] MONGO_URI environment variable is not set");
  process.exit(1);
}

mongoose.connect(mongoUri)
  .then(async () => {
    console.log(`✅ [backend] Connected to MongoDB: ${mongoose.connection.db.databaseName}`);

    // Initialize services after MongoDB connection
    try {
      const initializeServices = (await import('./scripts/initializeServices.js')).default;
      await initializeServices();
    } catch (error) {
      console.error("❌ Service initialization error:", error);
    }

    // Start call cleanup service after MongoDB connection is ready
    callCleanupService.start();
  })
  .catch(err => {
    console.error("❌ [backend] MongoDB connection error:", err);
    process.exit(1);
  });

// Health check
app.get("/", (req, res) => res.send("Robert AI backend alive"));

// Auth Routes
app.use("/api/auth", authRoutes);

// Admin Routes
app.use("/api/admin", adminRoutes);

// Booking Routes
app.use("/api/booking", bookingRoutes);

// ITM Booking Routes
app.use("/api/itm-booking", itmBookingRoutes);

// Knowledge Base Routes (OpenAI-based)
app.use("/api/kb", openaiKbRoutes);

// KB Mapping Routes (for drift detection)
app.use("/api/kb/mappings", kbMappingRoutes);

// Alert Routes
app.use("/api/alerts", alertRoutes);

// Payment Routes
app.use("/api/payments", paymentRoutes);

// AI Configuration Routes
app.use("/api/admin/ai", aiRoutes);
app.use("/api/admin/ai/prompt/versions", promptVersionRoutes);
app.use("/api/admin/ai/flow-parameters", flowParameterRoutes);
app.use("/api/admin/ai/token-management", tokenManagementRoutes);

// Voice Routes
app.use("/api/admin/voice", voiceRoutes);

// Language/Voice Mapping Routes
app.use("/api/admin", languageVoiceRoutes);

// Vector Store Routes
app.use("/api/vector-store", vectorStoreRoutes);

// File Search Routes
app.use("/api/file-search", fileSearchRoutes);

// Phase 3: Advanced KB Features Routes
app.use("/api/drift", driftRoutes);
app.use("/api/reingest", reingestRoutes);
app.use("/api/test-retrieval", testRetrievalRoutes);
app.use("/api/provenance", provenanceRoutes);
app.use("/api/uncertainty-gate", uncertaintyGateRoutes);
app.use("/api/memory", memoryRoutes);
app.use("/api/transcripts", transcriptRoutes);
app.use("/api/complaints", complaintRoutes);

// Audio & Telephony Routes
app.use("/api/admin/audio-telephony", audioTelephonyRoutes);

// Privacy Configuration Routes
app.use("/api/admin", privacyConfigRoutes);

// CRM Tasks Configuration Routes
app.use("/api/admin", crmTasksConfigRoutes);

// MCP Tools Routes
app.use("/api/mcp-tools", mcpToolsRoutes);

// GDPR Routes
app.use("/api/gdpr", gdprRoutes);

// Dashboard Routes
app.use("/api/dashboard", dashboardRoutes);

// Observability Routes
app.use("/api/observability", observabilityRoutes);

// System Routes
app.use("/api/system", systemRoutes);

// Tool Configuration Routes
app.use("/api/admin/tools", toolConfigRoutes);

// Conversation Behavior Configuration Routes
app.use("/api/conversation-behavior", conversationBehaviorRoutes);

// Template Routes (Email/SMS)
app.use("/api/templates", templateRoutes);

// Unanswered Questions Routes
app.use("/api/unanswered-questions", unansweredQuestionsRoutes);

// Outbound Routes (Recording proxy) - requires authentication
app.get("/api/outbound/recording/:callSid", authenticateToken, proxyRecording);

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
