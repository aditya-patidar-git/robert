import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import outboundRoutes from "./routes/outboundRoutes.js";
import inboundRoutes from "./routes/inboundRoutes.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Export io for controllers
export const io = new Server(httpServer, { cors: { origin: "*" } });

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// Routes
app.use("/api/outbound", outboundRoutes);
app.use("/api/inbound", inboundRoutes);

// Health check
app.get("/", (req, res) => res.send("Robert AI backend alive"));

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
