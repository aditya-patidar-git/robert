export const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Forbidden: Insufficient role" });
        }
        next();
    };
};

// Alias for authorizeRoles that accepts an array of roles
export const requireRole = (roles) => {
    return authorizeRoles(...roles);
};