import { BaseService } from './baseService';

/**
 * Config Sync Service
 * Handles config synchronization status and refresh
 * @extends BaseService
 */
class ConfigSyncService extends BaseService {
  constructor() {
    super('/api/system', {
      dataPath: null,
      normalizeResponse: true
    });
  }

  /**
   * Get sync status for all config types
   * @returns {Promise<Object>} Sync status
   */
  async getSyncStatus() {
    return this.get('/config-sync/status');
  }

  /**
   * Get sync status for specific config type
   * @param {string} configType - Config type
   * @returns {Promise<Object>} Sync status
   */
  async getConfigSyncStatus(configType) {
    return this.get(`/config-sync/status/${configType}`);
  }

  /**
   * Trigger config refresh
   * @param {string} configType - Config type to refresh
   * @returns {Promise<Object>} Refresh result
   */
  async refreshConfig(configType) {
    return this.post('/config-sync/refresh', { configType });
  }
}

// Export singleton instance
const configSyncService = new ConfigSyncService();
export default configSyncService;

