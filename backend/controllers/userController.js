import User from "../models/User.js";
import { hashPassword } from "../utils/hash.js";

// GET /admin/users
export const getUsers = async (req, res) => {
    const { status, role, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (role) filter.role = role;

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

// DELETE /admin/users/:id
export const deleteUser = async (req, res) => {
    const { hard } = req.query;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (hard === "true") {
        await user.remove();
    } else {
        user.status = "deleted";
        await user.save();
    }

    res.json({ message: "User deleted" });
};
