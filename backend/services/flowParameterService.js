import FlowParameterOverride from "../models/FlowParameterOverride.js";

class FlowParameterService {
  /**
   * Get parameters for a specific flow type
   * @param {string} flowType - Flow type to get parameters for
   * @returns {Object|null} - Flow override or null if not found
   */
  async getFlowParameters(flowType) {
    try {
      const override = await FlowParameterOverride.findOne({ 
        flowType, 
        enabled: true 
      });
      return override;
    } catch (error) {
      console.error(`Error getting flow parameters for ${flowType}:`, error);
      return null;
    }
  }

  /**
   * Get effective parameters by merging flow override with global config
   * @param {string} flowType - Flow type
   * @param {Object} globalConfig - Global AI configuration
   * @returns {Object} - Effective parameters to use
   */
  async getEffectiveParameters(flowType, globalConfig) {
    try {
      const flowOverride = await this.getFlowParameters(flowType);
      
      if (!flowOverride || !flowOverride.enabled) {
        // No override, use global config
        return {
          temperature: globalConfig?.parameters?.temperature || 0.4,
          top_p: globalConfig?.parameters?.topP || 1.0,
          max_tokens: globalConfig?.parameters?.maxTokens || 150,
          model: globalConfig?.model?.id || 'gpt-4o'
        };
      }

      // Merge flow override with global config
      const effectiveParams = {
        temperature: flowOverride.parameters?.temperature ?? globalConfig?.parameters?.temperature ?? 0.4,
        top_p: flowOverride.parameters?.topP ?? globalConfig?.parameters?.topP ?? 1.0,
        max_tokens: flowOverride.parameters?.maxTokens ?? globalConfig?.parameters?.maxTokens ?? 150,
        model: flowOverride.model?.id || globalConfig?.model?.id || 'gpt-4o'
      };

      return effectiveParams;
    } catch (error) {
      console.error(`Error getting effective parameters for ${flowType}:`, error);
      // Fallback to global config on error
      return {
        temperature: globalConfig?.parameters?.temperature || 0.4,
        top_p: globalConfig?.parameters?.topP || 1.0,
        max_tokens: globalConfig?.parameters?.maxTokens || 150,
        model: globalConfig?.model?.id || 'gpt-4o'
      };
    }
  }

  /**
   * Get all flow parameter overrides
   * @returns {Array} - Array of all flow overrides
   */
  async getAllFlowOverrides() {
    try {
      const overrides = await FlowParameterOverride.find()
        .sort({ priority: -1, flowType: 1 });
      return overrides;
    } catch (error) {
      console.error('Error getting all flow overrides:', error);
      return [];
    }
  }

  /**
   * Create or update flow parameter override
   * @param {string} flowType - Flow type
   * @param {Object} overrideData - Override data
   * @returns {Object} - Created/updated override
   */
  async updateFlowOverride(flowType, overrideData) {
    try {
      const override = await FlowParameterOverride.findOneAndUpdate(
        { flowType },
        {
          flowType,
          enabled: overrideData.enabled !== undefined ? overrideData.enabled : true,
          parameters: overrideData.parameters || {},
          model: overrideData.model || {},
          priority: overrideData.priority !== undefined ? overrideData.priority : 0,
          conditions: overrideData.conditions || {}
        },
        { 
          upsert: true, 
          new: true,
          setDefaultsOnInsert: true
        }
      );
      return override;
    } catch (error) {
      console.error(`Error updating flow override for ${flowType}:`, error);
      throw error;
    }
  }

  /**
   * Delete flow parameter override
   * @param {string} flowType - Flow type to delete
   * @returns {boolean} - Success status
   */
  async deleteFlowOverride(flowType) {
    try {
      const result = await FlowParameterOverride.deleteOne({ flowType });
      return result.deletedCount > 0;
    } catch (error) {
      console.error(`Error deleting flow override for ${flowType}:`, error);
      throw error;
    }
  }

  /**
   * Get default parameters for a flow type (suggested defaults)
   * @param {string} flowType - Flow type
   * @returns {Object} - Default parameters
   */
  getDefaultParametersForFlow(flowType) {
    const defaults = {
      information: {
        temperature: 0.3,
        topP: 1.0,
        maxTokens: 200
      },
      booking: {
        temperature: 0.4,
        topP: 1.0,
        maxTokens: 150
      },
      complaint: {
        temperature: 0.5,
        topP: 1.0,
        maxTokens: 200
      },
      human_transfer: {
        temperature: 0.3,
        topP: 1.0,
        maxTokens: 100
      },
      default: {
        temperature: 0.4,
        topP: 1.0,
        maxTokens: 150
      }
    };

    return defaults[flowType] || defaults.default;
  }
}

export default new FlowParameterService();

