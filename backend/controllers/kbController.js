import KnowledgeBase from "../models/KnowledgeBase.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { escapeRegex } from "../utils/regexUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Get all knowledge base articles
export const getAllArticles = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (search) {
      const escapedSearch = escapeRegex(search);
      query.$or = [
        { title: { $regex: escapedSearch, $options: 'i' } },
        { content: { $regex: escapedSearch, $options: 'i' } },
        { tags: { $in: [new RegExp(escapedSearch, 'i')] } }
      ];
    }

    const articles = await KnowledgeBase.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await KnowledgeBase.countDocuments(query);

    res.json({
      status: "success",
      articles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error("Error fetching articles:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Get article by ID
export const getArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const article = await KnowledgeBase.findById(id);
    
    if (!article) {
      return res.status(404).json({ 
        status: "error", 
        message: "Article not found" 
      });
    }

    res.json({
      status: "success",
      article
    });
  } catch (err) {
    console.error("Error fetching article:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Create new article (file upload)
export const createArticle = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        status: "error", 
        message: "No file uploaded" 
      });
    }

    const { title, tags } = req.body;
    const file = req.file;

    // Validate file type
    const allowedTypes = ['application/pdf', 'text/html', 'text/markdown', 'text/plain'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ 
        status: "error", 
        message: "Invalid file type. Only PDF, HTML, MD, and TXT files are allowed" 
      });
    }

    // Validate file size (1MB limit)
    const maxSize = 1 * 1024 * 1024;
    if (file.size > maxSize) {
      return res.status(400).json({ 
        status: "error", 
        message: "File size must be less than 1MB" 
      });
    }

    // Read file content
    const content = fs.readFileSync(file.path, 'utf8');
    
    // Parse tags
    const tagArray = tags ? tags.split(',').map(tag => tag.trim()) : [];

    const article = new KnowledgeBase({
      title: title || file.originalname,
      filename: file.filename,
      originalName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      content,
      uploadPath: file.path,
      tags: tagArray,
      createdBy: req.user?.id || "admin"
    });

    await article.save();

    // Clean up temporary file
    fs.unlinkSync(file.path);

    res.status(201).json({
      status: "success",
      message: "Article created successfully",
      article
    });
  } catch (err) {
    console.error("Error creating article:", err);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Update article (re-ingest)
export const updateArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, tags, content } = req.body;

    const article = await KnowledgeBase.findById(id);
    if (!article) {
      return res.status(404).json({ 
        status: "error", 
        message: "Article not found" 
      });
    }

    // Update fields
    if (title) article.title = title;
    if (tags) article.tags = tags.split(',').map(tag => tag.trim());
    if (content) article.content = content;
    
    article.lastIngested = new Date();
    article.hasDrift = false;
    article.driftScore = 0;

    await article.save();

    res.json({
      status: "success",
      message: "Article updated successfully",
      article
    });
  } catch (err) {
    console.error("Error updating article:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Delete article
export const deleteArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const article = await KnowledgeBase.findById(id);
    
    if (!article) {
      return res.status(404).json({ 
        status: "error", 
        message: "Article not found" 
      });
    }

    // Delete file if it exists
    if (article.uploadPath && fs.existsSync(article.uploadPath)) {
      fs.unlinkSync(article.uploadPath);
    }

    await KnowledgeBase.findByIdAndDelete(id);

    res.json({
      status: "success",
      message: "Article deleted successfully"
    });
  } catch (err) {
    console.error("Error deleting article:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};

// Search articles
export const searchArticles = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q) {
      return res.status(400).json({ 
        status: "error", 
        message: "Search query is required" 
      });
    }

    const escapedQ = escapeRegex(q);
    const articles = await KnowledgeBase.find({
      $and: [
        { status: 'Active' },
        {
          $or: [
            { title: { $regex: escapedQ, $options: 'i' } },
            { content: { $regex: escapedQ, $options: 'i' } },
            { tags: { $in: [new RegExp(escapedQ, 'i')] } }
          ]
        }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

    res.json({
      status: "success",
      articles,
      query: q
    });
  } catch (err) {
    console.error("Error searching articles:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Internal server error" 
    });
  }
};





