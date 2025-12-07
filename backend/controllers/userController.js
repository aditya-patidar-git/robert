import User from "../models/User.js";
import { hashPassword } from "../utils/hash.js";

// GET /admin/users
export const getUsers = async (req, res) => {
    const { status, role, page = 1, limit = 20 } = req.query;
    const filter = {};
    
    if (role) filter.role = role;
    
    // Exclude deleted users from results unless specifically filtering by deleted status
    if (status) {
        filter.status = status;
    } else {
        filter.status = { $ne: 'deleted' };
    }

    const users = await User.find(filter)
        .skip((page - 1) * limit)
        .limit(Number(limit));

    res.json(users);
};

// POST /admin/users
export const createUser = async (req, res) => {
    const { email, username, role, password } = req.body;
    const passwordHash = await hashPassword(password);
    const newUser = await User.create({ email, username, role, passwordHash });
    res.status(201).json(newUser);
};

// PATCH /admin/users/:id/approve
export const approveUser = async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.status = "active";
    await user.save();
    res.json(user);
};

// PATCH /admin/users/:id/block
export const blockUser = async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.status = "blocked";
    await user.save();
    res.json(user);
};

// PATCH /admin/users/:id/exclude
export const excludeUser = async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.status = "excluded";
    await user.save();
    res.json(user);
};

// PUT /admin/users/:id
export const updateUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Prevent users from modifying their own status
        const currentUserId = req.user?._id?.toString() || req.user?.id?.toString();
        const targetUserId = user._id.toString();
        if (currentUserId === targetUserId && req.body.status !== undefined) {
            return res.status(403).json({ message: "You cannot modify your own status" });
        }

        const { email, username, role, status, password } = req.body;

        // Update fields if provided
        if (email !== undefined) user.email = email;
        if (username !== undefined) user.username = username;
        if (role !== undefined) user.role = role;
        if (status !== undefined) user.status = status;
        if (password !== undefined) {
            user.passwordHash = await hashPassword(password);
        }

        await user.save();
        res.json(user);
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// DELETE /admin/users/:id
export const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Prevent users from deleting themselves
        const currentUserId = req.user?._id?.toString() || req.user?.id?.toString();
        const targetUserId = user._id.toString();
        if (currentUserId === targetUserId) {
            return res.status(403).json({ message: "You cannot delete yourself" });
        }

        // Perform hard delete - actually remove from database
        await User.findByIdAndDelete(req.params.id);

        res.json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
