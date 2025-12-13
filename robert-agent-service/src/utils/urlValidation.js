/**
 * URL Validation Utility
 * Provides SSRF protection by validating URLs before navigation
 */

class UrlValidation {
  constructor() {
    // Allowed domains for browser navigation
    this.allowedDomains = [
      'takeabyte.co.uk',
      'www.takeabyte.co.uk'
    ];

    // Blocked protocols
    this.blockedProtocols = [
      'file:',
      'javascript:',
      'data:',
      'vbscript:'
    ];

    // Blocked IP ranges (private/internal networks)
    this.blockedIPRanges = [
      /^127\./,           // localhost
      /^10\./,            // private class A
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // private class B
      /^192\.168\./,      // private class C
      /^169\.254\./,      // link-local
      /^::1$/,            // IPv6 localhost
      /^fc00:/,           // IPv6 private
      /^fe80:/            // IPv6 link-local
    ];
  }

  /**
   * Validate URL is safe for navigation
   * @param {string} url - URL to validate
   * @returns {Object} - Validation result
   */
  validateUrl(url) {
    if (!url || typeof url !== 'string') {
      return {
        valid: false,
        error: 'URL is required and must be a string'
      };
    }

    try {
      const urlObj = new URL(url);

      // Check protocol
      if (this.blockedProtocols.includes(urlObj.protocol.toLowerCase())) {
        return {
          valid: false,
          error: `Blocked protocol: ${urlObj.protocol}`
        };
      }

      // Only allow http and https
      if (!['http:', 'https:'].includes(urlObj.protocol.toLowerCase())) {
        return {
          valid: false,
          error: `Only HTTP and HTTPS protocols are allowed, got: ${urlObj.protocol}`
        };
      }

      // Check if domain is in allowed list
      const hostname = urlObj.hostname.toLowerCase();
      const isAllowed = this.allowedDomains.some(domain => 
        hostname === domain || hostname.endsWith('.' + domain)
      );

      if (!isAllowed) {
        return {
          valid: false,
          error: `Domain not in allowed list: ${hostname}. Allowed: ${this.allowedDomains.join(', ')}`
        };
      }

      // Check for IP addresses (block private IPs)
      if (this.isIPAddress(hostname)) {
        if (this.isBlockedIP(hostname)) {
          return {
            valid: false,
            error: `Blocked IP address: ${hostname}`
          };
        }
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Invalid URL format: ${error.message}`
      };
    }
  }

  /**
   * Check if string is an IP address
   * @param {string} str - String to check
   * @returns {boolean} - True if IP address
   */
  isIPAddress(str) {
    // IPv4 pattern
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    // IPv6 pattern (simplified)
    const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Pattern.test(str) || ipv6Pattern.test(str);
  }

  /**
   * Check if IP is in blocked ranges
   * @param {string} ip - IP address
   * @returns {boolean} - True if blocked
   */
  isBlockedIP(ip) {
    return this.blockedIPRanges.some(range => range.test(ip));
  }

  /**
   * Add allowed domain (for configuration)
   * @param {string} domain - Domain to add
   */
  addAllowedDomain(domain) {
    if (domain && !this.allowedDomains.includes(domain)) {
      this.allowedDomains.push(domain);
    }
  }

  /**
   * Get allowed domains
   * @returns {Array} - List of allowed domains
   */
  getAllowedDomains() {
    return [...this.allowedDomains];
  }
}

export default new UrlValidation();

