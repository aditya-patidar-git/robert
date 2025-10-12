// update.js
import mongoose from "mongoose";

// ✅ Replace with your MongoDB connection string
const MONGO_URI = "mongodb://localhost:27017/robert";

// ✅ Replace with your collection name if different
const COLLECTION_NAME = "callrecords";

// Twilio-supported call statuses
const statuses = [
    "queued",
    "ringing",
    "in-progress",
    "completed",
    "busy",
    "failed",
    "no-answer",
    "canceled"
];

async function updateRandomCallStatuses() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGO_URI);
        console.log("✅ Connected to MongoDB");

        const db = mongoose.connection.db;
        const collection = db.collection(COLLECTION_NAME);

        // Fetch 10 random records that have no callStatus
        const records = await collection
            .aggregate([
                {
                    $match: {
                        $or: [{ callStatus: { $exists: false } }, { callStatus: null }]
                    }
                },
                { $sample: { size: 10 } }
            ])
            .toArray();

        if (records.length === 0) {
            console.log("⚠️ No records found without callStatus");
            return;
        }

        for (const record of records) {
            const randomStatus =
                statuses[Math.floor(Math.random() * statuses.length)];
            await collection.updateOne(
                { _id: record._id },
                { $set: { callStatus: randomStatus } }
            );
            console.log(`✅ Updated ${record._id} → ${randomStatus}`);
        }

        console.log("🎉 Successfully updated 10 random records with callStatus");
        await mongoose.disconnect();
    } catch (err) {
        console.error("❌ Error updating call statuses:", err);
        process.exit(1);
    }
}

updateRandomCallStatuses();
