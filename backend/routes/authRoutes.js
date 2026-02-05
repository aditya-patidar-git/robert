import express from "express";
import { signup, login, sendOtp, sendSignupOtp, invalidateLoginOtp, getProfile, logout, updateProfile, changePassword, toggleMFA } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.post("/signup", signup);
router.post("/login", login);
router.post("/send-otp", sendOtp);
router.post("/invalidate-login-otp", invalidateLoginOtp);
router.post("/send-signup-otp", sendSignupOtp);

// Protected routes
router.get("/me", protect, getProfile);
router.post("/logout", protect, logout);
router.put("/me", protect, updateProfile);
router.put("/change-password", protect, changePassword);
router.patch("/mfa", protect, toggleMFA);

export default router;
