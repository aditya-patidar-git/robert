// Shared in-memory storage for conversations and realtime clients
// This is used across multiple handler modules

import sessionManagementService from '../services/sessionManagementService.js';

export const conversations = {}; // in-memory storage (maintained for backward compatibility)
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
//     },
//     mobileSearchAttempts: {
//       count: Number, // 0-3 attempts
//       lastAttempt: String|null, // Last mobile number attempted
//       values: Array<String>, // Array of mobile numbers attempted
//       lastAttemptTime: Date|null
//     },
//     verificationAttempts: {
//       fullName: Number, // 0-7 attempts per field
//       postcode: Number,
//       telephoneNumber: Number
//     },
//     clientDetails: {
//       fullName: String,
//       postcode: String,
//       telephoneNumber: String,
//       email: String
//     },
//     clientVerified: Boolean,
//     clientVerifiedAt: Date|null,
//     verificationMethod: String|null, // 'fullName_postcode_telephone'
//     bookingConsent: {
//       given: Boolean,
//       timestamp: Date|null,
//       dryRunDiff: Object|null // { date, time, centre, fees, policyNotes }
//     },
//     policyCheck: {
//       performed: Boolean,
//       timestamp: Date|null,
//       results: Object|null // Policy summary from KB
//     }
//   }
// }
export const realtimeClients = {}; // Store active Realtime API connections

