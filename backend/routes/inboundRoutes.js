import express from "express";
import {
    handleCallStatus,
    handleIncomingCall,
    handleRecordingStatus,
    handleResponse
} from "../controllers/inboundController.js";

const router = express.Router();

router.post("/incoming-call", handleIncomingCall);
router.post("/handle-response", handleResponse);
router.post("/call-status", handleCallStatus);
router.post("/recording-status", handleRecordingStatus);

export default router;



