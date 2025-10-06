import jwt from "jsonwebtoken";

export const generateToken = (user) => {
    // Token will be valid for 7 days
    return jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "2d" }
    );
};

export const verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET);
