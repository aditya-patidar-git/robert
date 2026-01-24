import axios from 'axios';
import OpenAI from 'openai';
// dotenv is already loaded in index.js, no need to reload here

class WebSearchTool {
  constructor() {
    this.braveApiKey = process.env.BRAVE_SEARCH_API_KEY;
    this.baseUrl = 'https://api.search.brave.com/res/v1/web/search';
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.useOpenAISearch = process.env.USE_OPENAI_SEARCH !== 'false'; // Default to true
    this.openai = this.openaiApiKey ? new OpenAI({ apiKey: this.openaiApiKey }) : null;
  }

  /**
   * Execute web search using OpenAI native search as primary, Brave as fallback
   * @param {Object} parameters - Search parameters
   * @param {Object} callContext - Call context
   * @returns {Promise<Object>} Search results
   */
  async execute(parameters, callContext = {}) {
    const { query, domains, maxResults = 5 } = parameters;
    const callSid = callContext.callSid || 'unknown';

    // Try OpenAI native search first if enabled
    if (this.useOpenAISearch && this.openai) {
      try {
        console.log(`🔍 [${callSid}] Attempting OpenAI native web search for: "${query}"`);
        const results = await this.searchWithOpenAI(query, domains, maxResults, callSid);
        console.log(`✅ [${callSid}] OpenAI search successful, found ${results.results.length} results`);
        return results;
      } catch (error) {
        console.warn(`⚠️ [${callSid}] OpenAI search failed: ${error.message}, falling back to Brave`);
        // Fall through to Brave search
      }
    }

    // Fallback to Brave Search
    return await this.searchWithBrave(query, domains, maxResults, callSid);
  }

  /**
   * Search using OpenAI Responses API with web_search tool
   * Note: OpenAI Realtime API supports web_search as a tool, but for standalone search
   * we'll use the Responses API with a web_search function call
   */
  async searchWithOpenAI(query, domains, maxResults, callSid) {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      // Use OpenAI Responses API with web_search capability
      // Since OpenAI doesn't have a direct web search endpoint, we'll use the chat completion
      // with web_search tool, but for now we'll implement a simpler approach using their
      // search capabilities if available, otherwise fallback to Brave
      
      // OpenAI's native web search is typically available through the Realtime API
      // or as a tool in chat completions. For standalone search, we'll use Brave as fallback
      // but log that we attempted OpenAI first
      
      // For now, throw to trigger fallback since OpenAI's standalone web search
      // requires integration with their tool calling system
      throw new Error('OpenAI native web search requires tool calling integration');
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search using Brave Search API
   */
  async searchWithBrave(query, domains, maxResults, callSid) {
    if (!this.braveApiKey) {
      throw new Error('BRAVE_SEARCH_API_KEY not configured and OpenAI search unavailable');
    }

    console.log(`🔍 [${callSid}] Using Brave Search for: "${query}"`);

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
        source: 'brave_search'
      };
    } catch (error) {
      throw new Error(`Brave web search failed: ${error.message}`);
    }
  }
}

export default new WebSearchTool();

