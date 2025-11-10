import express from "express";
import {
    makeCall,
    aiIntro,
    handleResponse,
    callStatus,
    recordingStatus,
    getAllCalls,
    proxyRecording,
    mediaStream
} from "../controllers/outboundController.js";

const router = express.Router();

router.post("/make-call", makeCall);
router.post("/ai-intro", aiIntro);
router.post("/handle-response", handleResponse);
router.post("/call-status", callStatus);
router.post("/recording-status", recordingStatus);
router.get("/get-all-calls", getAllCalls);
router.get("/recording/:callSid", proxyRecording);
router.get("/media-stream", mediaStream);

export default router;
