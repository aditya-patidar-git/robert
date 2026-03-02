import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is not set');
    }

    await mongoose.connect(mongoUri);
    console.log(`✅ [backend] Connected to MongoDB: ${mongoose.connection.db.databaseName}`);
  } catch (err) {
    console.error("❌ [backend] MongoDB connection error:", err);
    process.exit(1);
  }
};

export default connectDB;
