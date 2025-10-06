import mongoose from "mongoose";

const ProvenanceSchema = new mongoose.Schema({
  callId: {
    type: String,
    required: true,
    index: true
  },
  fileIds: [{
    type: String,
    required: true
  }],
  titles: [{
    type: String,
    required: true
  }],
  similarityScores: [{
    type: Number,
    required: true,
    min: 0,
    max: 1
  }],
  query: {
    type: String,
    required: true
  },
  results: [{
    fileId: String,
    fileName: String,
    similarityScore: Number,
    content: String,
    metadata: mongoose.Schema.Types.Mixed
  }],
  timestamp: {
    type: Date,
    default: Date.now
  },
  sessionId: {
    type: String,
    index: true
  },
  userId: {
    type: String,
    index: true
  },
  model: {
    type: String,
    default: 'gpt-realtime'
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1
  },
  response: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for performance
ProvenanceSchema.index({ callId: 1, timestamp: -1 });
ProvenanceSchema.index({ sessionId: 1, timestamp: -1 });
ProvenanceSchema.index({ userId: 1, timestamp: -1 });
ProvenanceSchema.index({ timestamp: -1 });

// Virtual for average similarity score
ProvenanceSchema.virtual('averageSimilarityScore').get(function() {
  if (this.similarityScores.length === 0) return 0;
  return this.similarityScores.reduce((sum, score) => sum + score, 0) / this.similarityScores.length;
});

// Virtual for result count
ProvenanceSchema.virtual('resultCount').get(function() {
  return this.results.length;
});

export default mongoose.model("Provenance", ProvenanceSchema);





