/**
 * Date Range Utility
 * Shared utility for calculating date ranges from time range strings
 */

/**
 * Get date range object from time range string
 * @param {string} timeRange - Time range ('1h', '6h', '24h', '7d')
 * @returns {Object} Date range with start and end ISO strings
 */
export const getDateRange = (timeRange) => {
  const now = new Date();
  const ranges = {
    '1h': 3600000,
    '6h': 21600000,
    '24h': 86400000,
    '7d': 604800000
  };
  
  const ms = ranges[timeRange] || 86400000;
  const start = new Date(now.getTime() - ms);
  
  return {
    start: start.toISOString(),
    end: now.toISOString()
  };
};

export default { getDateRange };

