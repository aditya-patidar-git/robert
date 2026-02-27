/**
 * Seed script: create owner user user@example.com / User@123 (active).
 * Run from backend: node scripts/seedUser.js
 * Uses MONGO_URI from .env (or .env in backend root).
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import User from '../models/User.js';
import { hashPassword } from '../utils/hash.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const EMAIL = 'rohit@example.com';
const PASSWORD = 'rohit@123';
const USERNAME = 'rohit';
const ROLE = 'owner';
const STATUS = 'active';

async function seedUser() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri || !mongoUri.trim()) {
    console.error('❌ MONGO_URI is required. Set it in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const passwordHash = await hashPassword(PASSWORD);
    const existing = await User.findOne({ email: EMAIL });

    if (existing) {
      existing.passwordHash = passwordHash;
      existing.username = USERNAME;
      existing.role = ROLE;
      existing.status = STATUS;
      await existing.save();
      console.log(`✅ Updated existing user: ${EMAIL} (role=${ROLE}, status=${STATUS})`);
    } else {
      await User.create({
        email: EMAIL,
        username: USERNAME,
        role: ROLE,
        status: STATUS,
        passwordHash,
      });
      console.log(`✅ Created user: ${EMAIL} (role=${ROLE}, status=${STATUS})`);
    }
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seedUser();