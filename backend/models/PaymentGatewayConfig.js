import mongoose from "mongoose";

const PaymentGatewayConfigSchema = new mongoose.Schema({
  gatewayType: { 
    type: String, 
    enum: ['stripe', 'paypal', 'square'], 
    required: true 
  },
  isActive: { 
    type: Boolean, 
    default: false 
  },
  credentials: {
    // Stripe
    stripeSecretKey: String, // Encrypted
    stripePublishableKey: String,
    stripeWebhookSecret: String, // Encrypted
    // PayPal
    paypalClientId: String, // Encrypted
    paypalClientSecret: String, // Encrypted
    paypalMode: { 
      type: String, 
      enum: ['sandbox', 'live'], 
      default: 'sandbox' 
    },
    // Square
    squareApplicationId: String, // Encrypted
    squareAccessToken: String, // Encrypted
    squareLocationId: String
  },
  settings: {
    currency: { 
      type: String, 
      default: 'GBP' 
    },
    paymentLinkExpiryHours: { 
      type: Number, 
      default: 24 
    },
    webhookUrl: String,
    testMode: { 
      type: Boolean, 
      default: true 
    }
  },
  testConnectionStatus: { 
    type: String, 
    enum: ['not_tested', 'success', 'failed'], 
    default: 'not_tested' 
  },
  testConnectionLastAttempt: Date,
  testConnectionError: String,
  createdBy: { 
    type: String, 
    default: "admin" 
  }
}, { 
  timestamps: true 
});

// Ensure only one active payment gateway config
PaymentGatewayConfigSchema.index({ isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

export default mongoose.model("PaymentGatewayConfig", PaymentGatewayConfigSchema);

