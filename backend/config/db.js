import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is not set');
    }
    
    // Extract database name from URI for logging
    const dbNameMatch = mongoUri.match(/\/([^/?]+)(\?|$)/);
    const dbName = dbNameMatch ? dbNameMatch[1] : 'unknown';
    
    console.log(`🔌 [backend] Connecting to MongoDB database: ${dbName}`);
    console.log(`🔌 [backend] MongoDB URI: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`); // Hide credentials
    
    await mongoose.connect(mongoUri);
    // Note: useNewUrlParser and useUnifiedTopology are deprecated in MongoDB Driver 4.0.0+
    // They are now the default behavior and should not be specified
    
    console.log(`✅ [backend] Connected to MongoDB database: ${mongoose.connection.db.databaseName}`);
    console.log(`✅ [backend] MongoDB connection state: ${mongoose.connection.readyState} (1=connected)`);
  } catch (err) {
    console.error("❌ [backend] MongoDB connection error:", err);
    process.exit(1);
  }
};

export default connectDB;
