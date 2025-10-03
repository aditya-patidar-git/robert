import mongoose from "mongoose";
import dotenv from "dotenv";
import Voice from "../models/Voice.js";

dotenv.config();

const defaultVoices = [
  {
    id: "ash",
    name: "Ash",
    description: "Professional male voice, ideal for business calls",
    language: "en-US",
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
    language: "en-US",
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
    language: "en-US",
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
    language: "en-US",
    gender: "female",
    provider: "openai",
    isDefault: false,
    capabilities: {
      realtime: true,
      streaming: true,
      bargeIn: true
    },
    sampleText: "Hello! I'm excited to help you with your motorcycle training journey."
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
