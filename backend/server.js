import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import outboundRoutes from "./routes/outboundRoutes.js";
import inboundRoutes from "./routes/inboundRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
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
import audioTelephonyRoutes from "./routes/audioTelephonyRoutes.js";
import mcpToolsRoutes from "./routes/mcpToolsRoutes.js";
import gdprRoutes from "./routes/gdprRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import itmBookingRoutes from "./routes/itmBookingRoutes.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Export io for controllers
export const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
});

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ Connected to MongoDB");

    // Initialize services after MongoDB connection
    try {
      const initializeServices = (await import('./scripts/initializeServices.js')).default;
      await initializeServices();
    } catch (error) {
      console.error("❌ Service initialization error:", error);
    }
  })
  .catch(err => console.error("❌ MongoDB connection error:", err));

// Health check
app.get("/", (req, res) => res.send("Robert AI backend alive"));

// Auth Routes
app.use("/api/auth", authRoutes);

// Admin Routes
app.use("/api/admin", adminRoutes);

// Call Routes
app.use("/api/outbound", outboundRoutes);
app.use("/api/inbound", inboundRoutes);

// Booking Routes
app.use("/api/booking", bookingRoutes);

// Knowledge Base Routes (OpenAI-based)
app.use("/api/kb", openaiKbRoutes);

// AI Configuration Routes
app.use("/api/admin/ai", aiRoutes);

// Voice Routes
app.use("/api/admin/voice", voiceRoutes);

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
app.use("/api/transcripts", transcriptRoutes);

// Audio & Telephony Routes
app.use("/api/admin/audio-telephony", audioTelephonyRoutes);

// MCP Tools Routes
app.use("/api/mcp-tools", mcpToolsRoutes);

// GDPR Routes
app.use("/api/gdpr", gdprRoutes);

// Dashboard Routes
app.use("/api/dashboard", dashboardRoutes);

// ITM Booking Test Routes
app.use("/api/itm-booking", itmBookingRoutes);

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
