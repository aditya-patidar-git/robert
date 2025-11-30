// Shared in-memory storage for conversations and realtime clients
// This is used across multiple handler modules

export const conversations = {}; // in-memory storage
// Structure: {
//   [callSid]: {
//     transcript: [],
//     from: String,
//     to: String,
//     language: String,
//     recordingConsent: {
//       requested: Boolean,
//       given: Boolean|null,
//       requestedAt: Date,
//       respondedAt: Date
//     },
//     memoryConsent: {
//       requested: Boolean,
//       given: Boolean|null,
//       requestedAt: Date,
//       respondedAt: Date
//     },
//     kba: {
//       verified: Boolean,
//       method: String, // 'email_postcode_bookingref' or 'email_postcode_bookingref_otp'
//       verifiedAt: Date,
//       otpVerified: Boolean,
//       otpVerifiedAt: Date,
//       email: String,
//       postcode: String,
//       bookingReference: String
//     }
//   }
// }
export const realtimeClients = {}; // Store active Realtime API connections

