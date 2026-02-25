import mongoose from 'mongoose';
import dotenv from 'dotenv';
import KnowledgeBase from '../models/KnowledgeBase.js';

dotenv.config();

const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;
if (!vectorStoreId || vectorStoreId.trim() === '') {
  console.error('❌ OPENAI_VECTOR_STORE_ID is required for seeding. Set it in .env');
  process.exit(1);
}

const sampleKBFiles = [
  {
    title: "CBT Policy Document",
    content: "This document outlines the Compulsory Basic Training (CBT) policy for motorcycle training. All students must complete CBT before riding on public roads. The course includes: 1) Introduction to motorcycle safety, 2) Basic controls and handling, 3) Road awareness training, 4) Practical riding assessment. Duration: 1 day (8 hours). Cost: £150. Requirements: Valid UK driving licence, minimum age 16.",
    filename: "cbt-policy-2025.txt",
    originalName: "CBT Policy Document.txt",
    fileType: "text/plain",
    fileSize: 2048,
    uploadPath: "/uploads/cbt-policy-2025.txt",
    status: "Active",
    tags: ["Policy", "CBT", "Training"],
    lastSynced: new Date(),
    openaiFileId: "file-cbt-policy-2025",
    vectorStoreId,
    createdBy: "admin"
  },
  {
    title: "Booking Terms and Conditions",
    content: "Terms and Conditions for Universal Motorcycle Training bookings: 1) All bookings require full payment in advance, 2) Cancellations must be made 48 hours before the course date for full refund, 3) No-shows will forfeit the full course fee, 4) Weather-related cancellations may be rebooked at no extra cost, 5) Students must bring valid driving licence and appropriate clothing, 6) Course completion certificates are valid for 2 years.",
    filename: "booking-tcs-2025.txt",
    originalName: "Booking Terms and Conditions.txt",
    fileType: "text/plain",
    fileSize: 1536,
    uploadPath: "/uploads/booking-tcs-2025.txt",
    status: "Active",
    tags: ["T&Cs", "Booking", "Policy"],
    lastSynced: new Date(),
    openaiFileId: "file-booking-tcs-2025",
    vectorStoreId,
    createdBy: "admin"
  },
  {
    title: "Pricing Structure 2025",
    content: "Current pricing for Universal Motorcycle Training courses: CBT Course: £150 (1 day), Full Licence Course: £450 (3 days), Theory Test Preparation: £75 (4 hours), Practical Test Preparation: £120 (1 day), Intensive Course (5 days): £650, Weekend Courses: +£25 surcharge, Corporate Bookings (5+ students): 10% discount, Repeat Students: 15% discount. All prices include: Course materials, bike hire, insurance, instructor fees. Additional costs: Theory test fee (£23), Practical test fee (£75), DVSA booking fee (£15).",
    filename: "pricing-2025.txt",
    originalName: "Pricing Structure 2025.txt",
    fileType: "text/plain",
    fileSize: 1024,
    uploadPath: "/uploads/pricing-2025.txt",
    status: "Active",
    tags: ["Pricing", "Costs", "Fees"],
    lastSynced: new Date(),
    openaiFileId: "file-pricing-2025",
    vectorStoreId,
    createdBy: "admin"
  },
  {
    title: "Training Centre Locations",
    content: "Universal Motorcycle Training operates from multiple locations across the UK: London Centre: 123 Training Lane, London SW1A 1AA (Phone: 020 7123 4567), Manchester Centre: 456 Motorcycle Road, Manchester M1 1AA (Phone: 0161 234 5678), Birmingham Centre: 789 Bike Street, Birmingham B1 1AA (Phone: 0121 345 6789), Glasgow Centre: 321 Cycle Way, Glasgow G1 1AA (Phone: 0141 456 7890). All centres are DVSA approved and offer: Free parking, Changing facilities, Tea/coffee, WiFi, Disabled access. Opening hours: Monday-Friday 8am-6pm, Saturday 9am-4pm, Sunday 10am-3pm.",
    filename: "locations-2025.txt",
    originalName: "Training Centre Locations.txt",
    fileType: "text/plain",
    fileSize: 1280,
    uploadPath: "/uploads/locations-2025.txt",
    status: "Active",
    tags: ["Locations", "Centres", "Contact"],
    lastSynced: new Date(),
    openaiFileId: "file-locations-2025",
    vectorStoreId,
    createdBy: "admin"
  },
  {
    title: "Safety Equipment Requirements",
    content: "Required safety equipment for all training courses: Helmet: Must be ECE 22.05 approved, in good condition, properly fitted. Gloves: Full-finger motorcycle gloves, leather or textile. Jacket: Motorcycle jacket with CE approved armour, or thick leather/textile jacket. Trousers: Motorcycle trousers with CE approved armour, or thick denim/leather. Boots: Ankle-high boots with non-slip soles, or motorcycle boots. Eye protection: If helmet doesn't have visor, bring safety glasses. We provide: High-visibility vests, Basic helmets (if needed), Gloves (if needed). Students must bring their own protective clothing for hygiene reasons.",
    filename: "safety-equipment-2025.txt",
    originalName: "Safety Equipment Requirements.txt",
    fileType: "text/plain",
    fileSize: 1152,
    uploadPath: "/uploads/safety-equipment-2025.txt",
    status: "Active",
    tags: ["Safety", "Equipment", "Requirements"],
    lastSynced: new Date(),
    openaiFileId: "file-safety-equipment-2025",
    vectorStoreId,
    createdBy: "admin"
  },
  {
    title: "Theory Test Information",
    content: "Theory test requirements for motorcycle licence: CBT holders can take theory test after 6 months. Theory test includes: Multiple choice questions (50 questions, 43 correct to pass), Hazard perception test (14 video clips, 44 points to pass). Test duration: 1 hour 15 minutes. Cost: £23 (paid to DVSA). Booking: Online at gov.uk or by phone 0300 200 1122. Required documents: Valid UK driving licence, CBT certificate, Theory test pass certificate (valid for 2 years). Preparation: Official DVSA theory test app, Practice tests available online, Our theory test preparation course: £75 (4 hours).",
    filename: "theory-test-2025.txt",
    originalName: "Theory Test Information.txt",
    fileType: "text/plain",
    fileSize: 896,
    uploadPath: "/uploads/theory-test-2025.txt",
    status: "Active",
    tags: ["Theory", "Test", "DVSA"],
    lastSynced: new Date(),
    openaiFileId: "file-theory-test-2025",
    vectorStoreId,
    createdBy: "admin"
  }
];

async function seedKBFiles() {
  try {
    console.log('🌱 Starting KB files seeding...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing KB files
    await KnowledgeBase.deleteMany({});
    console.log('🗑️ Cleared existing KB files');

    // Insert sample KB files
    const insertedFiles = await KnowledgeBase.insertMany(sampleKBFiles);
    console.log(`✅ Inserted ${insertedFiles.length} KB files`);

    // Display summary
    console.log('\n📋 KB Files Summary:');
    insertedFiles.forEach((file, index) => {
      console.log(`${index + 1}. ${file.title} (${file.tags.join(', ')})`);
    });

    console.log('\n🎉 KB files seeding completed successfully!');
    
    // Close connection
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error seeding KB files:', error);
    process.exit(1);
  }
}

// Run the seeding function
seedKBFiles();
