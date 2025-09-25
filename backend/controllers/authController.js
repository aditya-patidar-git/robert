import User from "../models/User.js";
import { hashPassword, verifyPassword } from "../utils/hash.js";
import { generateToken } from "../utils/jwt.js";

// POST /auth/signup
export const signup = async (req, res) => {
    const { email, username, password } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email already registered" });

    const passwordHash = await hashPassword(password);

    await User.create({
        email,
        username,
        passwordHash,
        role: "admin",     // default role for self-registration
        status: "pending"  // needs approval by admin
    });

    res.status(201).json({ message: "User registered successfully. Await admin approval." });
};

// POST /auth/login
export const login = async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    const isValid = await verifyPassword(user.passwordHash, password);
    if (!isValid) return res.status(401).json({ message: "Invalid email or password" });

    if (user.status !== "active") {
        return res.status(403).json({ message: `User is not active. Current status: ${user.status}` });
    }

    const token = generateToken(user);

    res.json({
        token,
        user: {
            id: user._id,
            email: user.email,
            username: user.username,
            role: user.role,
            status: user.status
        }
    });
};
