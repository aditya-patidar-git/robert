import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

export async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    console.log('✅ MongoDB already connected');
    return; // Already connected
  }

  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is not set');
    }
    
    // Extract database name from URI for logging
    const dbNameMatch = mongoUri.match(/\/([^/?]+)(\?|$)/);
    const dbName = dbNameMatch ? dbNameMatch[1] : 'unknown';
    
    console.log(`🔌 [robert-agent-service] Connecting to MongoDB database: ${dbName}`);
    console.log(`🔌 [robert-agent-service] MongoDB URI: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`); // Hide credentials
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log(`✅ [robert-agent-service] Connected to MongoDB database: ${mongoose.connection.db.databaseName}`);
    console.log(`✅ [robert-agent-service] MongoDB connection state: ${mongoose.connection.readyState} (1=connected)`);
  } catch (err) {
    console.error('❌ [robert-agent-service] MongoDB connection error:', err);
    throw err;
  }
}

