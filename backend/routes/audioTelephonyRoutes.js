import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/rbacMiddleware.js";
import {
  getAudioConfig,
  updateAudioConfig,
  testAudioConfig,
  getAudioMetrics,
  getHistoricalAudioMetrics,
  getRecentCallsWithQuality,
  getModelParameterRanges,
  getNumberProfile,
  saveNumberProfile,
  deleteNumberProfile
} from "../controllers/audioConfig/index.js";
import {
  getTelephonyConfig,
  updateTelephonyConfig,
  addPhoneNumber,
  updatePhoneNumber,
  removePhoneNumber,
  testPhoneNumber,
  testSipConnection,
  getSipStatus,
  getSipHealth,
  updateSipSettings
} from "../controllers/telephonyConfigController.js";
import {
  getVoices,
  getVoice,
  previewVoice,
  setDefaultVoice
} from "../controllers/voiceController.js";
import telephonyService from "../services/telephonyService.js";

const router = express.Router();

// Protect all audio-telephony routes + RBAC
router.use(protect);
router.use(authorizeRoles("owner", "admin"));

// Audio Configuration Routes
router.get("/config/audio", getAudioConfig);
router.put("/config/audio", updateAudioConfig);
router.post("/config/audio/test", testAudioConfig);
router.get("/config/audio/metrics", getAudioMetrics);
router.get("/config/audio/metrics/historical", getHistoricalAudioMetrics);
router.get("/config/audio/metrics/recent-calls", getRecentCallsWithQuality);
router.get("/config/audio/model-ranges", getModelParameterRanges);

// Per-Number Profile Routes
router.get("/config/audio/number-profile/:phoneNumber", getNumberProfile);
router.put("/config/audio/number-profile/:phoneNumber", saveNumberProfile);
router.delete("/config/audio/number-profile/:phoneNumber", deleteNumberProfile);

// Telephony Configuration Routes
router.get("/config/telephony", getTelephonyConfig);
router.put("/config/telephony", updateTelephonyConfig);
router.post("/config/telephony/numbers", addPhoneNumber);
router.put("/config/telephony/numbers/:number", updatePhoneNumber);
router.delete("/config/telephony/numbers/:number", removePhoneNumber);
router.post("/config/telephony/numbers/:number/test", testPhoneNumber);

// SIP Configuration Routes
router.post("/config/telephony/sip/test-connection", testSipConnection);
router.get("/config/telephony/sip/status", getSipStatus);
router.get("/config/telephony/sip/health", getSipHealth);
router.put("/config/telephony/sip/settings", updateSipSettings);

// Voice Management Routes
router.get("/voices", getVoices);
router.get("/voices/:id", getVoice);
router.post("/voices/preview", previewVoice);
router.patch("/voices/:id/default", setDefaultVoice);

// Audio Preview File Serving Route
router.get("/audio-previews/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    const audioStorageService = (await import('../services/audioStorageService.js')).default;
    const path = (await import('path')).default;
    
    console.log('🔵 [AUDIO_SERVE] Request for audio file:', filename);
    
    // Check if file exists
    const fileExists = await audioStorageService.fileExists(filename);
    if (!fileExists) {
      console.error('❌ [AUDIO_SERVE] File not found:', filename);
      return res.status(404).json({
        status: "error",
        message: "Audio file not found"
      });
    }
    
    // Get file path
    const filepath = audioStorageService.getAudioPath(filename);
    console.log('🔵 [AUDIO_SERVE] Serving file from:', filepath);
    
    // Use Express sendFile method for proper file serving
    res.sendFile(filepath, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Accept-Ranges': 'bytes' // Enable range requests for seeking
      }
    }, (err) => {
      if (err) {
        console.error('❌ [AUDIO_SERVE] Error sending file:', err);
        if (!res.headersSent) {
          res.status(500).json({
            status: "error",
            message: "Failed to serve audio file"
          });
        }
      } else {
        console.log('✅ [AUDIO_SERVE] File sent successfully:', filename);
      }
    });
    
  } catch (error) {
    console.error('❌ [AUDIO_SERVE] Error serving audio file:', error);
    if (!res.headersSent) {
      res.status(500).json({
        status: "error",
        message: "Failed to serve audio file"
      });
    }
  }
});

// Active Calls Route
router.get("/active-calls", async (req, res) => {
  try {
    console.log('Backend - Active calls route called');
    const activeCalls = await telephonyService.getActiveCalls();
    console.log('Backend - Active calls response:', activeCalls);
    res.json({ success: true, calls: activeCalls });
  } catch (error) {
    console.error('Backend - Active calls error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;





