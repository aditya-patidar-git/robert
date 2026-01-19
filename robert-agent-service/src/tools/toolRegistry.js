/**
 * Tool Registry
 * Manages tool registration and provides access to registered tools
 */

class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  /**
   * Register a tool implementation
   * @param {string} toolName - Name of the tool
   * @param {Object} toolImplementation - Tool implementation object with execute method
   */
  register(toolName, toolImplementation) {
    this.tools.set(toolName, toolImplementation);
  }

  /**
   * Register multiple tools at once
   * @param {Map|Object} tools - Map or object of tool name -> implementation pairs
   */
  registerTools(tools) {
    if (tools instanceof Map) {
      tools.forEach((implementation, toolName) => {
        this.register(toolName, implementation);
      });
    } else if (typeof tools === 'object') {
      Object.entries(tools).forEach(([toolName, implementation]) => {
        this.register(toolName, implementation);
      });
    }
  }

  /**
   * Get a tool implementation by name
   * @param {string} toolName - Name of the tool
   * @returns {Object|null} Tool implementation or null if not found
   */
  get(toolName) {
    return this.tools.get(toolName) || null;
  }

  /**
   * Check if a tool is registered
   * @param {string} toolName - Name of the tool
   * @returns {boolean} True if tool exists
   */
  has(toolName) {
    return this.tools.has(toolName);
  }

  /**
   * Get list of all registered tool names
   * @returns {Array<string>} Array of tool names
   */
  getAvailableTools() {
    return Array.from(this.tools.keys());
  }
}

export default ToolRegistry;

