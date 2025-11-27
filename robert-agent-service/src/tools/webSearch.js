import axios from 'axios';

class WebSearchTool {
  constructor() {
    this.braveApiKey = process.env.BRAVE_SEARCH_API_KEY;
    this.baseUrl = 'https://api.search.brave.com/res/v1/web/search';
  }

  async execute(parameters, callContext = {}) {
    const { query, domains, maxResults = 5 } = parameters;
    
    if (!this.braveApiKey) {
      throw new Error('BRAVE_SEARCH_API_KEY not configured');
    }

    const searchParams = {
      q: query,
      count: maxResults,
      offset: 0,
      mkt: 'en-GB',
      safeSearch: 'moderate',
      textDecorations: false,
      textFormat: 'Raw'
    };

    if (domains && domains.length > 0) {
      searchParams.site = domains.join(' OR ');
    }

    try {
      const response = await axios.get(this.baseUrl, {
        params: searchParams,
        headers: {
          'X-Subscription-Token': this.braveApiKey,
          'Accept': 'application/json'
        },
        timeout: 5000
      });

      const results = (response.data.web?.results || []).map(result => ({
        title: result.title,
        url: result.url,
        description: result.description
      }));

      return {
        query: query,
        results: results,
        totalResults: response.data.web?.totalResults || 0,
        source: 'web_search'
      };
    } catch (error) {
      throw new Error(`Web search failed: ${error.message}`);
    }
  }
}

export default new WebSearchTool();

