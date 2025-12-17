import configSyncService from "../services/configSyncService.js";

/**
 * Base Template Controller
 * Provides common CRUD operations for templates
 * Extended by emailTemplateController and smsTemplateController
 */
export class BaseTemplateController {
  constructor(TemplateModel, templateType) {
    this.TemplateModel = TemplateModel;
    this.templateType = templateType;
  }

  // List all templates
  async list(req, res) {
    try {
      const { category, courseType, isActive } = req.query;
      
      const filter = {};
      if (category) filter.category = category;
      if (courseType) filter.courseType = courseType;
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      const templates = await this.TemplateModel.find(filter)
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        status: "success",
        templates
      });
    } catch (err) {
      console.error(`Error fetching ${this.templateType} templates:`, err);
      res.status(500).json({
        status: "error",
        message: "Internal server error"
      });
    }
  }

  // Get template by ID
  async get(req, res) {
    try {
      const { id } = req.params;
      const template = await this.TemplateModel.findById(id);

      if (!template) {
        return res.status(404).json({
          status: "error",
          message: "Template not found"
        });
      }

      res.json({
        status: "success",
        template
      });
    } catch (err) {
      console.error(`Error fetching ${this.templateType} template:`, err);
      res.status(500).json({
        status: "error",
        message: "Internal server error"
      });
    }
  }

  // Create template
  async create(req, res) {
    try {
      const templateData = req.body;
      templateData.createdBy = req.user?.id || "admin";
      templateData.updatedBy = req.user?.id || "admin";

      const template = new this.TemplateModel(templateData);
      await template.save();

      // Notify config change
      configSyncService.notifyConfigChange(
        this.templateType === 'email' ? 'email-template' : 'sms-template',
        template._id.toString(),
        {
          changedBy: req.user?.id || req.user?.username || 'admin',
          action: 'create'
        }
      );

      res.status(201).json({
        status: "success",
        message: "Template created successfully",
        template
      });
    } catch (err) {
      console.error(`Error creating ${this.templateType} template:`, err);
      res.status(500).json({
        status: "error",
        message: "Internal server error",
        error: err.message
      });
    }
  }

  // Update template
  async update(req, res) {
    try {
      const { id } = req.params;
      const templateData = req.body;
      templateData.updatedBy = req.user?.id || "admin";

      const template = await this.TemplateModel.findByIdAndUpdate(
        id,
        templateData,
        { new: true, runValidators: true }
      );

      if (!template) {
        return res.status(404).json({
          status: "error",
          message: "Template not found"
        });
      }

      // Notify config change
      configSyncService.notifyConfigChange(
        this.templateType === 'email' ? 'email-template' : 'sms-template',
        id,
        {
          changedBy: req.user?.id || req.user?.username || 'admin',
          action: 'update'
        }
      );

      res.json({
        status: "success",
        message: "Template updated successfully",
        template
      });
    } catch (err) {
      console.error(`Error updating ${this.templateType} template:`, err);
      res.status(500).json({
        status: "error",
        message: "Internal server error",
        error: err.message
      });
    }
  }

  // Delete template
  async delete(req, res) {
    try {
      const { id } = req.params;
      const template = await this.TemplateModel.findByIdAndDelete(id);

      if (!template) {
        return res.status(404).json({
          status: "error",
          message: "Template not found"
        });
      }

      res.json({
        status: "success",
        message: "Template deleted successfully"
      });
    } catch (err) {
      console.error(`Error deleting ${this.templateType} template:`, err);
      res.status(500).json({
        status: "error",
        message: "Internal server error"
      });
    }
  }
}

