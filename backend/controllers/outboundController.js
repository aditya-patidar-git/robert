// ✅ Backward compatibility: Re-export all handlers from modular structure
// This file maintains backward compatibility while the actual implementation
// has been moved to backend/controllers/outbound/ directory
export * from './outbound/index.js';
