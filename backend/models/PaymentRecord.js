import mongoose from 'mongoose';

const PaymentRecordSchema = new mongoose.Schema({
  callSid: {
    type: String,
    index: true,
    sparse: true
  },
  bookingId: {
    type: String,
    index: true,
    sparse: true
  },
  paymentMethod: {
    type: String,
    enum: ['twilio_pay', 'payment_link', 'stripe', 'paypal'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'canceled', 'refunded'],
    default: 'pending',
    index: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'GBP'
  },
  cardType: {
    type: String
  },
  cardLast4: {
    type: String
  },
  errorCode: {
    type: String
  },
  errorMessage: {
    type: String
  },
  paymentLink: {
    type: String
  },
  expiresAt: {
    type: Date
  },
  customerEmail: {
    type: String
  },
  customerPhone: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes
PaymentRecordSchema.index({ createdAt: -1 });
PaymentRecordSchema.index({ status: 1, createdAt: -1 });
PaymentRecordSchema.index({ paymentMethod: 1, status: 1 });

export default mongoose.model('PaymentRecord', PaymentRecordSchema);

