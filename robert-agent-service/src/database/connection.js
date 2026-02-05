import mongoose from 'mongoose';
// dotenv is already loaded in index.js, no need to reload here

export async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return; // Already connected
  }

  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is not set');
    }
    
    await mongoose.connect(mongoUri);
    // Note: useNewUrlParser and useUnifiedTopology are deprecated in MongoDB Driver 4.0.0+
    // They are now the default behavior and should not be specified
    
    // Simplified: Only log success, no verbose details
    console.log(`✅ [MongoDB] Connected: ${mongoose.connection.db.databaseName}`);
  } catch (err) {
    console.error('❌ [MongoDB] Connection error:', err.message);
    throw err;
  }
}

