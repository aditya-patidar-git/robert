import { verifyToken } from "../utils/jwt.js";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
    const hasAuth = !!req.headers.authorization;
    if (!hasAuth) {
        return res.status(401).json({ message: "Not authorized" });
    }

    let token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: "Not authorized" });
    }

    try {
        const decoded = verifyToken(token);
        const user = await User.findById(decoded.id);
        if (!user || user.status !== "active") {
            throw new Error("User not active");
        }
        req.user = user;
        next();
    } catch (err) {
        const message = err.message === "Token has been revoked"
            ? "Token has been revoked. Please log in again."
            : "Invalid token";
        return res.status(401).json({ message });
    }
};
