#!/usr/bin/env node

/**
 * Migration script to update existing 'user' role users to 'admin' role
 * This script should be run after removing the 'user' role from the User model
 */

import mongoose from 'mongoose';
import User from '../models/User.js';
import { config } from 'dotenv';

// Load environment variables
config();

const MIGRATION_NAME = 'update-user-roles';
const MIGRATION_VERSION = '1.0.0';

async function connectToDatabase() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/robert');
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

async function updateUserRoles() {
    try {
        console.log('🔄 Starting user role migration...');
        
        // Find all users with 'user' role
        const usersToUpdate = await User.find({ role: 'user' });
        console.log(`📊 Found ${usersToUpdate.length} users with 'user' role`);
        
        if (usersToUpdate.length === 0) {
            console.log('✅ No users with "user" role found. Migration not needed.');
            return;
        }
        
        // Update all users with 'user' role to 'admin' role
        const result = await User.updateMany(
            { role: 'user' },
            { $set: { role: 'admin' } }
        );
        
        console.log(`✅ Successfully updated ${result.modifiedCount} users from 'user' to 'admin' role`);
        
        // Verify the update
        const remainingUserRoleUsers = await User.find({ role: 'user' });
        if (remainingUserRoleUsers.length === 0) {
            console.log('✅ Migration completed successfully - no users with "user" role remain');
        } else {
            console.log(`⚠️  Warning: ${remainingUserRoleUsers.length} users still have "user" role`);
        }
        
        // Show summary of current role distribution
        const roleStats = await User.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } }
        ]);
        
        console.log('\n📈 Current role distribution:');
        roleStats.forEach(stat => {
            console.log(`   ${stat._id}: ${stat.count} users`);
        });
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

async function runMigration() {
    console.log(`🚀 Starting migration: ${MIGRATION_NAME} v${MIGRATION_VERSION}`);
    console.log('=' .repeat(50));
    
    try {
        await connectToDatabase();
        await updateUserRoles();
        console.log('\n✅ Migration completed successfully!');
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runMigration();
}

export { runMigration, updateUserRoles };
