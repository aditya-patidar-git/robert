// controllers/promptController.js
import Prompt from "../models/Prompt.js";

// Add Global Prompt (Admin)
export const addPrompt = async (req, res) => {
    try {
        const { title, content, parameters } = req.body;

        if (!title || !content) {
            return res.status(400).json({ status: "error", message: "Title and content are required" });
        }

        const newPrompt = new Prompt({ 
            title, 
            content, 
            parameters: parameters || {},
            createdBy: "admin" 
        });
        await newPrompt.save();

        res.status(201).json({
            status: "success",
            message: "Prompt added successfully",
            prompt: newPrompt
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
};

// (Optional) Get all prompts
export const getPrompts = async (req, res) => {
    try {
        const prompts = await Prompt.find().sort({ createdAt: -1 });
        res.json({ status: "success", prompts });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
};

// Update Global Prompt (Admin)
export const updatePrompt = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, parameters } = req.body;

        const prompt = await Prompt.findById(id);
        if (!prompt) {
            return res.status(404).json({ status: "error", message: "Prompt not found" });
        }

        if (title) prompt.title = title;
        if (content) prompt.content = content;
        if (parameters) prompt.parameters = parameters;

        await prompt.save();

        res.json({
            status: "success",
            message: "Prompt updated successfully",
            prompt
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
};
