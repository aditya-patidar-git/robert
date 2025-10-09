import axios from 'axios';

class WebSearchService {
  constructor() {
    this.braveApiKey = process.env.BRAVE_SEARCH_API_KEY;
    this.baseUrl = 'https://api.search.brave.com/res/v1/web/search';
    this.rateLimit = 100; // requests per minute
    this.requestCount = 0;
    this.lastReset = Date.now();
  }

  async search(query, options = {}) {
    try {
      // Check rate limit
      if (!this.checkRateLimit()) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }

      const {
        domains = [],
        maxTime = 5000,
        maxResults = 5
      } = options;

      console.log(`🔍 Web search: "${query}"`);

      const searchParams = {
        q: query,
        count: maxResults,
        offset: 0,
        mkt: 'en-GB', // UK market
        safeSearch: 'moderate',
        textDecorations: false,
        textFormat: 'Raw'
      };

      // Add domain filtering if specified
      if (domains.length > 0) {
        searchParams.site = domains.join(' OR ');
      }

      const response = await axios.get(this.baseUrl, {
        params: searchParams,
        headers: {
          'X-Subscription-Token': this.braveApiKey,
          'Accept': 'application/json'
        },
        timeout: maxTime
      });

      const results = response.data.web?.results || [];
      
      const processedResults = results.map(result => ({
        title: result.title,
        url: result.url,
        description: result.description,
        publishedDate: result.publishedDate,
        source: 'Brave Search'
      }));

      console.log(`✅ Found ${processedResults.length} web results for: "${query}"`);

      return {
        query,
        results: processedResults,
        totalResults: processedResults.length,
        searchTime: Date.now() - this.lastReset,
        source: 'web_search'
      };

    } catch (error) {
      console.error('Web search error:', error);
      throw new Error(`Web search failed: ${error.message}`);
    }
  }

  checkRateLimit() {
    const now = Date.now();
    const timeDiff = now - this.lastReset;

    // Reset counter every minute
    if (timeDiff >= 60000) {
      this.requestCount = 0;
      this.lastReset = now;
    }

    if (this.requestCount >= this.rateLimit) {
      return false;
    }

    this.requestCount++;
    return true;
  }

  // Search with domain allowlist
  async searchWithDomains(query, allowedDomains = [], maxTime = 5000) {
    return this.search(query, {
      domains: allowedDomains,
      maxTime,
      maxResults: 5
    });
  }

  // Search with time constraints
  async searchWithTimeLimit(query, maxTime = 3000) {
    return this.search(query, {
      maxTime,
      maxResults: 3
    });
  }
}

export default new WebSearchService();
