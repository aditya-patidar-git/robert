import { useState, useCallback } from 'react';
import { useToast } from '../components/common/ToastProvider';

/**
 * useTemplateEditor Hook
 * Reusable hook for template editing
 */
const useTemplateEditor = (templateService, type) => {
  const { showSuccess, showError } = useToast();
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadTemplate = useCallback(async (templateId) => {
    if (!templateId) {
      setTemplate(null);
      return;
    }

    setLoading(true);
    try {
      const response = await templateService.getById(templateId);
      setTemplate(response.template || response);
    } catch (error) {
      showError(error.message || 'Failed to load template');
    } finally {
      setLoading(false);
    }
  }, [templateService, showError]);

  const validate = useCallback((templateData) => {
    const errors = {};

    if (!templateData.name) {
      errors.name = 'Template name is required';
    }

    if (!templateData.category) {
      errors.category = 'Category is required';
    }

    if (type === 'email') {
      if (!templateData.subject) {
        errors.subject = 'Email subject is required';
      }
    }

    if (!templateData.body) {
      errors.body = 'Body is required';
    } else if (type === 'sms' && templateData.body.length > 1600) {
      errors.body = 'SMS body must be 1600 characters or less';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  }, [type]);

  const render = useCallback((templateData, variables) => {
    if (!templateData) return null;

    let rendered = type === 'email' ? templateData.body : templateData.body;

    if (templateData.variables && variables) {
      templateData.variables.forEach((varDef) => {
        const varName = varDef.name;
        const varValue = variables[varName] || '';
        const placeholder = `{{${varName}}}`;
        rendered = rendered.replace(new RegExp(placeholder, 'g'), varValue);
      });
    }

    if (type === 'email' && templateData.subject) {
      let renderedSubject = templateData.subject;
      if (templateData.variables && variables) {
        templateData.variables.forEach((varDef) => {
          const varName = varDef.name;
          const varValue = variables[varName] || '';
          const placeholder = `{{${varName}}}`;
          renderedSubject = renderedSubject.replace(new RegExp(placeholder, 'g'), varValue);
        });
      }
      return { subject: renderedSubject, body: rendered };
    }

    return { body: rendered };
  }, [type]);

  const testSend = useCallback(async (templateId, recipient) => {
    setLoading(true);
    try {
      const result = await templateService.testSend(templateId, recipient);
      showSuccess(result.message || 'Test sent successfully');
      return result;
    } catch (error) {
      showError(error.message || 'Failed to send test');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [templateService, showSuccess, showError]);

  return {
    template,
    setTemplate,
    loadTemplate,
    validate,
    render,
    testSend,
    loading
  };
};

export default useTemplateEditor;

