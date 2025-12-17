import { BaseService } from './baseService';

/**
 * Template Service (Base)
 * Handles template operations for both email and SMS
 * @extends BaseService
 */
class TemplateService extends BaseService {
  constructor(type) {
    super('/api/templates', {
      dataPath: null,
      normalizeResponse: true
    });
    this.type = type; // 'email' or 'sms'
    this.basePath = type === 'email' ? '/email-templates' : '/sms-templates';
  }

  /**
   * List all templates
   * @param {Object} params - Query parameters
   * @returns {Promise<Array>} Array of templates
   */
  async list(params = {}) {
    return this.get(this.basePath, params);
  }

  /**
   * Get template by ID
   * @param {string} id - Template ID
   * @returns {Promise<Object>} Template data
   */
  async getById(id) {
    return this.get(`${this.basePath}/${id}`);
  }

  /**
   * Create template
   * @param {Object} template - Template data
   * @returns {Promise<Object>} Created template
   */
  async create(template) {
    return this.post(this.basePath, template);
  }

  /**
   * Update template
   * @param {string} id - Template ID
   * @param {Object} template - Updated template data
   * @returns {Promise<Object>} Updated template
   */
  async update(id, template) {
    return this.put(`${this.basePath}/${id}`, template);
  }

  /**
   * Delete template
   * @param {string} id - Template ID
   * @returns {Promise<Object>} Deletion result
   */
  async delete(id) {
    return this.delete(`${this.basePath}/${id}`);
  }

  /**
   * Test send template
   * @param {string} id - Template ID
   * @param {string} recipient - Recipient email or phone
   * @returns {Promise<Object>} Send result
   */
  async testSend(id, recipient) {
    const field = this.type === 'email' ? 'recipientEmail' : 'recipientPhone';
    return this.post(`${this.basePath}/${id}/test`, {
      [field]: recipient
    });
  }

  /**
   * Render template with variables
   * @param {Object} template - Template object
   * @param {Object} variables - Variables to substitute
   * @returns {string} Rendered template
   */
  renderTemplate(template, variables) {
    let rendered = template.body || '';

    if (template.variables && variables) {
      template.variables.forEach((varDef) => {
        const varName = varDef.name;
        const varValue = variables[varName] || '';
        const placeholder = `{{${varName}}}`;
        rendered = rendered.replace(new RegExp(placeholder, 'g'), varValue);
      });
    }

    return rendered;
  }
}

// Export factory function
export const createTemplateService = (type) => new TemplateService(type);

// Export singleton instances
export const emailTemplateService = new TemplateService('email');
export const smsTemplateService = new TemplateService('sms');

export default TemplateService;

