import express from "express";
import {
  getVoices,
  getVoice,
  createVoice,
  updateVoice,
  deleteVoice,
  previewVoice,
  setDefaultVoice
} from "../controllers/voiceController.js";

const router = express.Router();

// Voice Routes
router.get("/voices", getVoices);
router.get("/voices/:id", getVoice);
router.post("/voices", createVoice);
router.put("/voices/:id", updateVoice);
router.delete("/voices/:id", deleteVoice);
router.post("/preview", previewVoice);
router.patch("/voices/:id/default", setDefaultVoice);

export default router;
