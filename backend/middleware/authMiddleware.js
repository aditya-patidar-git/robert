import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
    console.log('🔐 Auth middleware - Headers:', req.headers.authorization ? 'Token present' : 'No token');
    console.log('🔐 Auth middleware - URL:', req.url);
    
    let token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        console.log('❌ No token found in Authorization header');
        return res.status(401).json({ message: "Not authorized" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('🔐 Token decoded successfully for user:', decoded.id);
        
        const user = await User.findById(decoded.id);
        if (!user || user.status !== "active") {
            console.log('❌ User not found or not active:', user?.status);
            throw new Error("User not active");
        }
        
        console.log('✅ User authenticated:', user.email, 'Status:', user.status);
        req.user = user;
        next();
    } catch (err) {
        console.log('❌ Token verification failed:', err.message);
        return res.status(401).json({ message: "Invalid token" });
    }
};
