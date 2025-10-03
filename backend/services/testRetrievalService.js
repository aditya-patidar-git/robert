import fileSearchService from './fileSearchService.js';
import KnowledgeBase from '../models/KnowledgeBase.js';

class TestRetrievalService {
  constructor() {
    this.testQueries = [
      'CBT policy requirements',
      'training course pricing',
      'safety equipment needed',
      'theory test information',
      'booking terms and conditions',
      'training centre locations',
      'course cancellation policy',
      'payment methods accepted'
    ];
  }

  // Test retrieval functionality with various queries
  async testRetrieval(options = {}) {
    try {
      console.log('🧪 Starting retrieval test...');
      
      const {
        testQueries = this.testQueries,
        maxResults = 3,
        similarityThreshold = 0.7
      } = options;

      const testResults = [];

      for (const query of testQueries) {
        try {
          console.log(`🔍 Testing query: "${query}"`);
          
          // Test file search
          const searchResults = await fileSearchService.searchFiles(query, {
            maxResults,
            similarityThreshold
          });

          // Test database search
          const dbResults = await this.testDatabaseSearch(query);

          testResults.push({
            query,
            success: true,
            fileSearchResults: {
              totalResults: searchResults.totalResults,
              results: searchResults.results.map(r => ({
                fileName: r.fileName,
                similarityScore: r.similarityScore,
                hasContent: !!r.content
              }))
            },
            databaseResults: {
              totalResults: dbResults.length,
              results: dbResults.map(r => ({
                title: r.title,
                tags: r.tags,
                status: r.status
              }))
            },
            performance: {
              searchTime: Date.now() // Simplified timing
            }
          });

        } catch (error) {
          console.error(`Error testing query "${query}":`, error);
          testResults.push({
            query,
            success: false,
            error: error.message
          });
        }
      }

      const successfulTests = testResults.filter(r => r.success).length;
      const failedTests = testResults.filter(r => !r.success).length;

      console.log(`✅ Retrieval test completed. Successful: ${successfulTests}, Failed: ${failedTests}`);

      return {
        totalTests: testResults.length,
        successfulTests,
        failedTests,
        testResults,
        timestamp: new Date()
      };

    } catch (error) {
      console.error('Error in retrieval test:', error);
      throw new Error(`Retrieval test failed: ${error.message}`);
    }
  }

  // Test database search functionality
  async testDatabaseSearch(query) {
    try {
      const results = await KnowledgeBase.find({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { content: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ],
        status: 'Active'
      }).limit(5);

      return results;

    } catch (error) {
      console.error('Error in database search:', error);
      return [];
    }
  }

  // Test specific query with detailed results
  async testSpecificQuery(query, options = {}) {
    try {
      console.log(`🔍 Testing specific query: "${query}"`);
      
      const {
        maxResults = 5,
        similarityThreshold = 0.7,
        includeContent = false
      } = options;

      // Test file search
      const fileSearchResults = await fileSearchService.searchFiles(query, {
        maxResults,
        similarityThreshold
      });

      // Test database search
      const dbResults = await this.testDatabaseSearch(query);

      // Test tag-based search
      const tagResults = await this.testTagBasedSearch(query);

      return {
        query,
        fileSearch: {
          totalResults: fileSearchResults.totalResults,
          results: fileSearchResults.results.map(r => ({
            fileName: r.fileName,
            similarityScore: r.similarityScore,
            content: includeContent ? r.content : undefined
          }))
        },
        databaseSearch: {
          totalResults: dbResults.length,
          results: dbResults.map(r => ({
            title: r.title,
            tags: r.tags,
            status: r.status,
            lastUpdated: r.updatedAt
          }))
        },
        tagSearch: {
          totalResults: tagResults.length,
          results: tagResults.map(r => ({
            title: r.title,
            tags: r.tags,
            status: r.status
          }))
        },
        performance: {
          searchTime: Date.now(),
          vectorStoreId: fileSearchResults.vectorStore?.id
        }
      };

    } catch (error) {
      console.error('Error testing specific query:', error);
      throw new Error(`Specific query test failed: ${error.message}`);
    }
  }

  // Test tag-based search
  async testTagBasedSearch(query) {
    try {
      // Extract potential tags from query
      const potentialTags = this.extractTagsFromQuery(query);
      
      const results = await KnowledgeBase.find({
        tags: { $in: potentialTags },
        status: 'Active'
      }).limit(5);

      return results;

    } catch (error) {
      console.error('Error in tag-based search:', error);
      return [];
    }
  }

  // Extract potential tags from query
  extractTagsFromQuery(query) {
    const queryLower = query.toLowerCase();
    const tagMappings = {
      'cbt': ['CBT', 'Training'],
      'policy': ['Policy', 'T&Cs'],
      'pricing': ['Pricing', 'Costs'],
      'safety': ['Safety', 'Equipment'],
      'theory': ['Theory', 'Test'],
      'booking': ['Booking', 'T&Cs'],
      'location': ['Locations', 'Centres'],
      'payment': ['Payment', 'Costs']
    };

    const extractedTags = [];
    for (const [keyword, tags] of Object.entries(tagMappings)) {
      if (queryLower.includes(keyword)) {
        extractedTags.push(...tags);
      }
    }

    return [...new Set(extractedTags)]; // Remove duplicates
  }

  // Get test queries
  getTestQueries() {
    return this.testQueries;
  }

  // Add custom test query
  addTestQuery(query) {
    if (!this.testQueries.includes(query)) {
      this.testQueries.push(query);
    }
  }

  // Remove test query
  removeTestQuery(query) {
    const index = this.testQueries.indexOf(query);
    if (index > -1) {
      this.testQueries.splice(index, 1);
    }
  }
}

export default new TestRetrievalService();
