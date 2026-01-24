/**
 * Template Engine Service
 * Single responsibility: Parse and resolve templates with variable substitution.
 * 
 * Supports:
 * - Variable substitution: {{variable}}, {{object.property}}
 * - Conditional blocks: {{#if condition}}...{{/if}}, {{#if condition}}...{{else}}...{{/if}}
 * - Negated conditionals: {{#unless condition}}...{{/unless}}
 * - Iteration: {{#each array}}...{{/each}}
 * - Escaping: \{{variable}} to render literal {{variable}}
 * 
 * Reusable across: prompts, email bodies, SMS messages
 * 
 * @module templateEngine
 */

class TemplateEngine {
  constructor() {
    // Characters that could be used for prompt injection
    this.dangerousPatterns = [
      /\{\{[^}]*\}\}/g,  // Nested template syntax
      /<\/?script/gi,    // Script tags
      /javascript:/gi,   // JavaScript protocol
      /on\w+\s*=/gi,     // Event handlers
      /\bsystem\s*:/gi,  // System prompt markers
      /\buser\s*:/gi,    // User prompt markers
      /\bassistant\s*:/gi, // Assistant prompt markers
    ];
    
    // Maximum nesting depth to prevent infinite recursion
    this.maxNestingDepth = 10;
  }

  /**
   * Resolve a template string with the provided context.
   * 
   * @param {string} template - Template string with {{variable}} placeholders
   * @param {Object} context - Context object with values to substitute
   * @param {Object} options - Resolution options
   * @param {boolean} [options.sanitize=true] - Whether to sanitize values
   * @param {number} [options.depth=0] - Current nesting depth (internal)
   * @returns {string} Resolved template string
   */
  resolve(template, context = {}, options = {}) {
    const { sanitize = true, depth = 0 } = options;
    
    if (!template || typeof template !== 'string') {
      return template || '';
    }
    
    // Prevent infinite recursion
    if (depth > this.maxNestingDepth) {
      console.warn('[TemplateEngine] Max nesting depth exceeded, returning partial result');
      return template;
    }
    
    let result = template;
    
    // Process escaped templates first (convert \{{ to placeholder)
    const escapePlaceholder = '\x00ESCAPED_BRACE\x00';
    result = result.replace(/\\(\{\{)/g, escapePlaceholder);
    
    // Process conditionals first (they may contain variable references)
    result = this.resolveConditionals(result, context, { ...options, depth: depth + 1 });
    
    // Process each loops
    result = this.resolveLoops(result, context, { ...options, depth: depth + 1 });
    
    // Process variable substitutions
    result = this.resolveVariables(result, context, sanitize);
    
    // Restore escaped braces
    result = result.replace(new RegExp(escapePlaceholder, 'g'), '{{');
    
    return result;
  }

  /**
   * Resolve variable placeholders in a template.
   * 
   * @param {string} template - Template string
   * @param {Object} context - Context object
   * @param {boolean} sanitize - Whether to sanitize values
   * @returns {string} Template with variables resolved
   */
  resolveVariables(template, context, sanitize = true) {
    // Match {{variable}} or {{object.property}} or {{array[0]}}
    return template.replace(/\{\{(\w+(?:\.\w+|\[\d+\])*)\}\}/g, (match, path) => {
      const value = this.getNestedValue(context, path);
      
      // Handle undefined/null
      if (value === undefined || value === null) {
        return '';
      }
      
      // Convert to string
      let stringValue = String(value);
      
      // Sanitize if enabled
      if (sanitize) {
        stringValue = this.sanitize(stringValue);
      }
      
      return stringValue;
    });
  }

  /**
   * Resolve conditional blocks in a template.
   * Supports: {{#if condition}}...{{/if}} and {{#if condition}}...{{else}}...{{/if}}
   * Also supports: {{#unless condition}}...{{/unless}}
   * 
   * @param {string} template - Template string
   * @param {Object} context - Context object
   * @param {Object} options - Resolution options
   * @returns {string} Template with conditionals resolved
   */
  resolveConditionals(template, context, options = {}) {
    let result = template;
    
    // Process {{#unless condition}}...{{/unless}} blocks
    result = result.replace(
      /\{\{#unless\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
      (match, condition, content) => {
        const value = this.getNestedValue(context, condition);
        // Unless = if NOT truthy
        if (!this.isTruthy(value)) {
          return this.resolve(content, context, options);
        }
        return '';
      }
    );
    
    // Process {{#if condition}}...{{else}}...{{/if}} blocks (with else)
    result = result.replace(
      /\{\{#if\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (match, condition, ifContent, elseContent) => {
        const value = this.getNestedValue(context, condition);
        if (this.isTruthy(value)) {
          return this.resolve(ifContent, context, options);
        }
        return this.resolve(elseContent, context, options);
      }
    );
    
    // Process {{#if condition}}...{{/if}} blocks (without else)
    result = result.replace(
      /\{\{#if\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (match, condition, content) => {
        const value = this.getNestedValue(context, condition);
        if (this.isTruthy(value)) {
          return this.resolve(content, context, options);
        }
        return '';
      }
    );
    
    return result;
  }

  /**
   * Resolve loop blocks in a template.
   * Supports: {{#each array}}...{{/each}}
   * Within the loop, use {{this}} for the current item, {{@index}} for index
   * 
   * @param {string} template - Template string
   * @param {Object} context - Context object
   * @param {Object} options - Resolution options
   * @returns {string} Template with loops resolved
   */
  resolveLoops(template, context, options = {}) {
    return template.replace(
      /\{\{#each\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/each\}\}/g,
      (match, arrayPath, content) => {
        const array = this.getNestedValue(context, arrayPath);
        
        if (!Array.isArray(array)) {
          return '';
        }
        
        return array.map((item, index) => {
          // Create loop context with item and index
          const loopContext = {
            ...context,
            this: item,
            '@index': index,
            '@first': index === 0,
            '@last': index === array.length - 1
          };
          
          // Resolve the content with loop context
          return this.resolve(content, loopContext, options);
        }).join('');
      }
    );
  }

  /**
   * Get a nested value from an object using dot notation or array syntax.
   * 
   * @param {Object} obj - Source object
   * @param {string} path - Path like "user.name" or "items[0].name"
   * @returns {*} Value at path, or undefined if not found
   */
  getNestedValue(obj, path) {
    if (!obj || !path) {
      return undefined;
    }
    
    // Split path by dots and array brackets
    const parts = path.split(/\.|\[|\]/).filter(Boolean);
    
    return parts.reduce((current, part) => {
      if (current === null || current === undefined) {
        return undefined;
      }
      return current[part];
    }, obj);
  }

  /**
   * Determine if a value is "truthy" for conditional rendering.
   * 
   * @param {*} value - Value to check
   * @returns {boolean} True if value is truthy
   */
  isTruthy(value) {
    // Special handling for arrays and objects
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'object' && value !== null) {
      return Object.keys(value).length > 0;
    }
    // Standard truthy check
    return Boolean(value);
  }

  /**
   * Sanitize a value to prevent prompt injection.
   * 
   * @param {string} value - Value to sanitize
   * @returns {string} Sanitized value
   */
  sanitize(value) {
    if (typeof value !== 'string') {
      return String(value);
    }
    
    let sanitized = value;
    
    // Remove potentially dangerous patterns
    for (const pattern of this.dangerousPatterns) {
      sanitized = sanitized.replace(pattern, '');
    }
    
    // Escape common prompt injection attempts
    sanitized = sanitized
      .replace(/\n{3,}/g, '\n\n')  // Limit consecutive newlines
      .replace(/```/g, '')          // Remove code blocks that could be used for injection
      .trim();
    
    return sanitized;
  }

  /**
   * Validate a template for syntax errors.
   * 
   * @param {string} template - Template to validate
   * @returns {Object} Validation result with isValid and errors
   */
  validate(template) {
    const errors = [];
    
    if (!template || typeof template !== 'string') {
      return { isValid: true, errors: [] };
    }
    
    // Check for unmatched opening braces
    const openBraces = (template.match(/\{\{/g) || []).length;
    const closeBraces = (template.match(/\}\}/g) || []).length;
    
    if (openBraces !== closeBraces) {
      errors.push(`Unmatched braces: ${openBraces} opening, ${closeBraces} closing`);
    }
    
    // Check for unmatched if/endif
    const ifOpens = (template.match(/\{\{#if\s+/g) || []).length;
    const ifCloses = (template.match(/\{\{\/if\}\}/g) || []).length;
    
    if (ifOpens !== ifCloses) {
      errors.push(`Unmatched #if blocks: ${ifOpens} opening, ${ifCloses} closing`);
    }
    
    // Check for unmatched unless/endunless
    const unlessOpens = (template.match(/\{\{#unless\s+/g) || []).length;
    const unlessCloses = (template.match(/\{\{\/unless\}\}/g) || []).length;
    
    if (unlessOpens !== unlessCloses) {
      errors.push(`Unmatched #unless blocks: ${unlessOpens} opening, ${unlessCloses} closing`);
    }
    
    // Check for unmatched each/endeach
    const eachOpens = (template.match(/\{\{#each\s+/g) || []).length;
    const eachCloses = (template.match(/\{\{\/each\}\}/g) || []).length;
    
    if (eachOpens !== eachCloses) {
      errors.push(`Unmatched #each blocks: ${eachOpens} opening, ${eachCloses} closing`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Extract all variable names used in a template.
   * Useful for documentation and validation.
   * 
   * @param {string} template - Template to analyze
   * @returns {string[]} Array of variable names
   */
  extractVariables(template) {
    if (!template || typeof template !== 'string') {
      return [];
    }
    
    const variables = new Set();
    
    // Match simple variables
    const simpleMatches = template.matchAll(/\{\{(\w+(?:\.\w+|\[\d+\])*)\}\}/g);
    for (const match of simpleMatches) {
      variables.add(match[1]);
    }
    
    // Match condition variables
    const conditionMatches = template.matchAll(/\{\{#(?:if|unless)\s+(\w+(?:\.\w+)*)\}\}/g);
    for (const match of conditionMatches) {
      variables.add(match[1]);
    }
    
    // Match loop variables
    const loopMatches = template.matchAll(/\{\{#each\s+(\w+(?:\.\w+)*)\}\}/g);
    for (const match of loopMatches) {
      variables.add(match[1]);
    }
    
    return Array.from(variables);
  }
}

// Export singleton instance
export default new TemplateEngine();

// Also export class for testing
export { TemplateEngine };
