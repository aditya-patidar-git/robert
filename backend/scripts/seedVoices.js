import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Voice from "../models/Voice.js";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from the backend directory (one level up from scripts)
dotenv.config({ path: join(__dirname, "..", ".env") });

const defaultVoices = [
  {
    id: "ash",
    name: "Ash",
    description: "Professional male voice, ideal for business calls",
    language: "en-GB",
    gender: "male",
    provider: "openai",
    isDefault: true,
    capabilities: {
      realtime: true,
      streaming: true,
      bargeIn: true
    },
    sampleText: "Hello, this is Robert from Universal Motorcycle Training. How can I help you today?"
  },
  {
    id: "cedar",
    name: "Cedar",
    description: "Warm and friendly voice",
    language: "en-GB",
    gender: "male",
    provider: "openai",
    isDefault: false,
    capabilities: {
      realtime: true,
      streaming: true,
      bargeIn: true
    },
    sampleText: "Hi there! I'm here to assist you with your motorcycle training needs."
  },
  {
    id: "marin",
    name: "Marin",
    description: "Clear and professional female voice",
    language: "en-GB",
    gender: "female",
    provider: "openai",
    isDefault: false,
    capabilities: {
      realtime: true,
      streaming: true,
      bargeIn: true
    },
    sampleText: "Good day! Welcome to Universal Motorcycle Training. How may I assist you?"
  },
  {
    id: "nova",
    name: "Nova",
    description: "Energetic and engaging voice",
    language: "en-GB",
    gender: "female",
    provider: "openai",
    isDefault: false,
    capabilities: {
      realtime: true,
      streaming: true,
      bargeIn: true
    },
    sampleText: "Hello! I'm excited to help you with your motorcycle training journey."
  },
  {
    id: "alloy",
    name: "Alloy",
    description: "A versatile and balanced neutral voice",
    language: "en-GB",
    gender: "neutral",
    provider: "openai",
    isDefault: false,
    capabilities: {
      realtime: true,
      streaming: true,
      bargeIn: true
    },
    sampleText: "Hello, this is Robert from Universal Motorcycle Training. How can I help you today?"
  },
  {
    id: "echo",
    name: "Echo",
    description: "A clear and articulate male voice",
    language: "en-GB",
    gender: "male",
    provider: "openai",
    isDefault: false,
    capabilities: {
      realtime: true,
      streaming: true,
      bargeIn: true
    },
    sampleText: "Hello, this is Robert from Universal Motorcycle Training. How can I help you today?"
  },
  {
    id: "fable",
    name: "Fable",
    description: "A warm and expressive male voice",
    language: "en-GB",
    gender: "male",
    provider: "openai",
    isDefault: false,
    capabilities: {
      realtime: true,
      streaming: true,
      bargeIn: true
    },
    sampleText: "Hello, this is Robert from Universal Motorcycle Training. How can I help you today?"
  },
  {
    id: "onyx",
    name: "Onyx",
    description: "A deep and authoritative male voice",
    language: "en-GB",
    gender: "male",
    provider: "openai",
    isDefault: false,
    capabilities: {
      realtime: true,
      streaming: true,
      bargeIn: true
    },
    sampleText: "Hello, this is Robert from Universal Motorcycle Training. How can I help you today?"
  },
  {
    id: "shimmer",
    name: "Shimmer",
    description: "A bright and cheerful female voice",
    language: "en-GB",
    gender: "female",
    provider: "openai",
    isDefault: false,
    capabilities: {
      realtime: true,
      streaming: true,
      bargeIn: true
    },
    sampleText: "Hello, this is Robert from Universal Motorcycle Training. How can I help you today?"
  },
  {
    id: "ballad",
    name: "Ballad",
    description: "A melodic and expressive voice",
    language: "en-GB",
    gender: "neutral",
    provider: "openai",
    isDefault: false,
    capabilities: {
      realtime: true,
      streaming: true,
      bargeIn: true
    },
    sampleText: "Hello, this is Robert from Universal Motorcycle Training. How can I help you today?"
  },
  {
    id: "coral",
    name: "Coral",
    description: "A vibrant and energetic female voice",
    language: "en-GB",
    gender: "female",
    provider: "openai",
    isDefault: false,
    capabilities: {
      realtime: true,
      streaming: true,
      bargeIn: true
    },
    sampleText: "Hello, this is Robert from Universal Motorcycle Training. How can I help you today?"
  },
  {
    id: "sage",
    name: "Sage",
    description: "A wise and thoughtful voice",
    language: "en-GB",
    gender: "neutral",
    provider: "openai",
    isDefault: false,
    capabilities: {
      realtime: true,
      streaming: true,
      bargeIn: true
    },
    sampleText: "Hello, this is Robert from Universal Motorcycle Training. How can I help you today?"
  },
  {
    id: "verse",
    name: "Verse",
    description: "A poetic and rhythmic voice",
    language: "en-GB",
    gender: "neutral",
    provider: "openai",
    isDefault: false,
    capabilities: {
      realtime: true,
      streaming: true,
      bargeIn: true
    },
    sampleText: "Hello, this is Robert from Universal Motorcycle Training. How can I help you today?"
  }
];

async function seedVoices() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing voices
    await Voice.deleteMany({});
    console.log("✅ Cleared existing voices");

    // Insert default voices
    await Voice.insertMany(defaultVoices);
    console.log("✅ Seeded default voices");

    console.log("🎉 Voice seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding voices:", error);
  } finally {
    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
  }
}

seedVoices();





