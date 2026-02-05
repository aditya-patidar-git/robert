/**
 * MongoDB Memory Server setup for unit tests.
 * Use in beforeAll/afterAll for tests that need a real MongoDB connection.
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer = null;

export async function startMongoMemoryServer() {
  // Disconnect any existing connection
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  // Clear mongoose models cache to ensure fresh binding after reconnect
  Object.keys(mongoose.models).forEach(modelName => {
    delete mongoose.models[modelName];
  });
  
  // Stop existing memory server if any
  if (mongoServer) {
    await mongoServer.stop();
  }
  
  mongoServer = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 }
  });
  const uri = mongoServer.getUri();
  
  // Connect mongoose
  await mongoose.connect(uri);
  
  // Wait for connection ready - mongoose.connect() resolves when connected
  // But ensure readyState is actually 1 before proceeding
  let attempts = 0;
  while (mongoose.connection.readyState !== 1 && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB connection failed to become ready');
  }

  const pingTimeout = 5000;
  const pingPromise = mongoose.connection.db.admin().command({ ping: 1 });
  const timeoutPromise = new Promise((_, rej) =>
    setTimeout(() => rej(new Error('MongoDB ping timed out')), pingTimeout)
  );
  await Promise.race([pingPromise, timeoutPromise]);

  return uri;
}

export async function stopMongoMemoryServer() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

export { mongoServer };
