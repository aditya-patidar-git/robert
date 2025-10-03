import express from "express";
import {
  getAudioConfig,
  updateAudioConfig,
  testAudioConfig,
  getAudioMetrics
} from "../controllers/audioConfigController.js";
import {
  getTelephonyConfig,
  updateTelephonyConfig,
  addPhoneNumber,
  updatePhoneNumber,
  removePhoneNumber,
  testPhoneNumber
} from "../controllers/telephonyConfigController.js";
import {
  getVoices,
  getVoice,
  previewVoice,
  setDefaultVoice
} from "../controllers/voiceController.js";

const router = express.Router();

// Audio Configuration Routes
router.get("/config/audio", getAudioConfig);
router.put("/config/audio", updateAudioConfig);
router.post("/config/audio/test", testAudioConfig);
router.get("/config/audio/metrics", getAudioMetrics);

// Telephony Configuration Routes
router.get("/config/telephony", getTelephonyConfig);
router.put("/config/telephony", updateTelephonyConfig);
router.post("/config/telephony/numbers", addPhoneNumber);
router.put("/config/telephony/numbers/:number", updatePhoneNumber);
router.delete("/config/telephony/numbers/:number", removePhoneNumber);
router.post("/config/telephony/numbers/:number/test", testPhoneNumber);

// Voice Management Routes
router.get("/voices", getVoices);
router.get("/voices/:id", getVoice);
router.post("/voices/preview", previewVoice);
router.patch("/voices/:id/default", setDefaultVoice);

export default router;
