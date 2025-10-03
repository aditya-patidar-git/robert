import mongoose from "mongoose";

const KnowledgeBaseSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    trim: true
  },
  filename: { 
    type: String, 
    required: true,
    trim: true
  },
  originalName: { 
    type: String, 
    required: true,
    trim: true
  },
  fileType: { 
    type: String, 
    required: true,
    enum: ['application/pdf', 'text/html', 'text/markdown', 'text/plain']
  },
  fileSize: { 
    type: Number, 
    required: true
  },
  content: { 
    type: String,
    required: true
  },
  status: { 
    type: String, 
    default: 'Active',
    enum: ['Active', 'Processing', 'Error', 'Inactive']
  },
  hasDrift: { 
    type: Boolean, 
    default: false
  },
  driftScore: { 
    type: Number, 
    default: 0
  },
  lastIngested: { 
    type: Date, 
    default: Date.now
  },
  lastSynced: { 
    type: Date,
    sparse: true
  },
  tags: [{ 
    type: String,
    trim: true
  }],
  openaiFileId: { 
    type: String,
    sparse: true
  },
  vectorStoreId: { 
    type: String,
    sparse: true
  },
  uploadPath: { 
    type: String,
    required: true
  },
  createdBy: { 
    type: String, 
    default: "admin"
  }
}, { 
  timestamps: true 
});

// Index for search functionality
KnowledgeBaseSchema.index({ title: 'text', content: 'text' });
KnowledgeBaseSchema.index({ tags: 1 });
KnowledgeBaseSchema.index({ status: 1 });

export default mongoose.model("KnowledgeBase", KnowledgeBaseSchema);
