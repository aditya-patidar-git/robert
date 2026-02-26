import OpenAI from 'openai';
import { getVectorStoreId, getVectorStoreName } from '../config/openaiVectorStore.js';

// Lazy initialization: Create OpenAI client only when needed (after dotenv loads)
let openaiClient = null;
function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

class FileSearchService {
  get vectorStoreId() {
    return getVectorStoreId();
  }

  get vectorStoreName() {
    return getVectorStoreName();
  }

  // Extract readable text from content (handles string, object, or array structures)
  extractTextFromContent(content) {
    if (!content) return '';
    
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content)) {
      return content
        .map(item => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            return item.text || item.content || item.value || JSON.stringify(item);
          }
          return String(item);
        })
        .filter(Boolean)
        .join(' ');
    }
    
    if (typeof content === 'object') {
      return content.text || content.content || content.value || JSON.stringify(content);
    }
    
    return String(content);
  }

  // Generate AI summary for a file based on query and content snippets
  async generateFileSummary(query, fileName, contentSnippets) {
    try {
      // Combine all content snippets into a single text
      const combinedContent = contentSnippets
        .map(snippet => this.extractTextFromContent(snippet))
        .filter(Boolean)
        .join('\n\n---\n\n')
        .substring(0, 3000); // Limit to avoid token limits

      if (!combinedContent) {
        return 'No relevant content found in this file.';
      }

      const prompt = `Given the search query "${query}" and the following relevant content snippets from the file "${fileName}", provide a brief 2-3 sentence summary explaining how this file relates to the query and what key information it contains.

Content snippets:
${combinedContent}

Summary:`;

      const openai = getOpenAIClient();
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise summaries of document content in relation to search queries.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 200
      });

      const summary = response.choices[0]?.message?.content?.trim();
      return summary || 'Unable to generate summary for this file.';
    } catch (error) {
      console.error(`Error generating summary for ${fileName}:`, error);
      // Fallback: return first snippet if summary generation fails
      const firstSnippet = this.extractTextFromContent(contentSnippets[0] || '');
      return firstSnippet ? firstSnippet.substring(0, 200) + '...' : 'Summary unavailable.';
    }
  }

  // Search files using OpenAI File Search tool
  async searchFiles(query, options = {}) {
    try {
      console.log(`🔍 Searching files with query: "${query}"`);
      
      if (!this.vectorStoreId) {
        throw new Error('Vector store ID not configured');
      }

      const {
        maxResults = 10, // Increased to get more results for grouping
        similarityThreshold = 0.7,
        tags = [],
        fileIds = null
      } = options;

      // Get OpenAI client
      const openai = getOpenAIClient();

      // Get vector store
      const vectorStore = await openai.vectorStores.retrieve(this.vectorStoreId);
      
      if (!vectorStore) {
        throw new Error('Vector store not found');
      }

      // Search using File Search tool
      const searchParams = {
        query
      };

      // Add file filtering if specified
      if (fileIds && fileIds.length > 0) {
        searchParams.file_ids = fileIds;
      }

      // Perform the search
      const searchResults = await openai.vectorStores.search(
        this.vectorStoreId,
        searchParams
      );

      // Process raw results
      const rawResults = searchResults.data.map((result, index) => {
        // OpenAI returns 'score' field (not similarity_score), and 'file_id' instead of 'id'
        // Check score first since that's what OpenAI actually returns
        const similarityScore = result.score ?? 
                                result.similarity_score ?? 
                                result.similarityScore ?? 
                                (result.distance !== undefined ? (1 - result.distance) : null);
        
        // Validate and normalize the score
        const validScore = (similarityScore !== null && 
                          similarityScore !== undefined && 
                          !isNaN(similarityScore)) 
                          ? Number(similarityScore) 
                          : null;
        
        return {
          fileId: result.file_id || result.id,  // Fix: use file_id (OpenAI's field name)
          fileName: result.filename || 'Unknown File',
          similarityScore: validScore,
          content: result.content,
          metadata: result.metadata || result.attributes || {},
          source: 'OpenAI Vector Store'
        };
      });

      // Group results by file
      const fileGroups = new Map();
      
      rawResults.forEach(result => {
        const key = result.fileId || result.fileName;
        if (!fileGroups.has(key)) {
          fileGroups.set(key, {
            fileId: result.fileId,
            fileName: result.fileName,
            contentSnippets: [],
            similarityScores: []
          });
        }
        
        const group = fileGroups.get(key);
        group.contentSnippets.push(result.content);
        if (result.similarityScore !== null && result.similarityScore !== undefined) {
          group.similarityScores.push(result.similarityScore);
        }
      });

      // Generate summaries for each file group
      const summaryPromises = Array.from(fileGroups.entries()).map(async ([key, group]) => {
        try {
          const summary = await this.generateFileSummary(query, group.fileName, group.contentSnippets);
          
          // Calculate average similarity score
          const avgSimilarity = group.similarityScores.length > 0
            ? group.similarityScores.reduce((sum, score) => sum + score, 0) / group.similarityScores.length
            : null;

          return {
            fileId: group.fileId,
            fileName: group.fileName,
            summary: summary,
            matchCount: group.contentSnippets.length,
            averageSimilarityScore: avgSimilarity
          };
        } catch (error) {
          console.error(`Error processing file group ${key}:`, error);
          // Return fallback result
          const firstSnippet = this.extractTextFromContent(group.contentSnippets[0] || '');
          const avgSimilarity = group.similarityScores.length > 0
            ? group.similarityScores.reduce((sum, score) => sum + score, 0) / group.similarityScores.length
            : null;
          
          return {
            fileId: group.fileId,
            fileName: group.fileName,
            summary: firstSnippet ? firstSnippet.substring(0, 200) + '...' : 'Summary unavailable.',
            matchCount: group.contentSnippets.length,
            averageSimilarityScore: avgSimilarity
          };
        }
      });

      // Wait for all summaries to be generated
      const results = await Promise.all(summaryPromises);
      
      // Sort by average similarity score (descending) if available
      results.sort((a, b) => {
        if (a.averageSimilarityScore === null && b.averageSimilarityScore === null) return 0;
        if (a.averageSimilarityScore === null) return 1;
        if (b.averageSimilarityScore === null) return -1;
        return b.averageSimilarityScore - a.averageSimilarityScore;
      });

      console.log(`✅ Generated summaries for ${results.length} files`);
      
      return {
        query,
        results,
        totalResults: results.length,
        totalMatches: rawResults.length,
        vectorStore: {
          id: this.vectorStoreId,
          name: this.vectorStoreName
        },
        searchParams: {
          maxResults,
          similarityThreshold,
          tags,
          fileIds
        }
      };

    } catch (error) {
      console.error('Error searching files:', error);
      throw new Error(`File search failed: ${error.message}`);
    }
  }

  // Search files by tags (as per documentation requirements)
  async searchFilesByTags(query, tags = []) {
    try {
      console.log(`🏷️ Searching files by tags: ${tags.join(', ')}`);
      
      // Get OpenAI client
      const openai = getOpenAIClient();
      
      // Get files from vector store
      const vectorStoreFiles = await openai.vectorStores.files.list(this.vectorStoreId);
      
      // Filter files by tags if specified
      let fileIds = null;
      if (tags.length > 0) {
        // This would require metadata filtering - for now, search all files
        // In a real implementation, you'd filter by metadata tags
        console.log(`📋 Filtering by tags: ${tags.join(', ')}`);
      }

      // Perform search with filtered file IDs
      return await this.searchFiles(query, {
        fileIds,
        tags
      });

    } catch (error) {
      console.error('Error searching files by tags:', error);
      throw new Error(`Tag-based file search failed: ${error.message}`);
    }
  }

  // Get file content by ID
  async getFileContent(fileId) {
    try {
      console.log(`📄 Getting content for file: ${fileId}`);
      
      const openai = getOpenAIClient();
      const file = await openai.files.retrieve(fileId);
      const content = await openai.files.content(fileId);
      
      return {
        fileId: file.id,
        fileName: file.filename,
        content: content.text,
        metadata: file.metadata || {},
        size: file.bytes,
        createdAt: new Date(file.created_at * 1000)
      };

    } catch (error) {
      console.error('Error getting file content:', error);
      throw new Error(`Failed to get file content: ${error.message}`);
    }
  }

  // Get vector store status
  async getVectorStoreStatus() {
    const vectorStoreId = this.vectorStoreId;
    if (!vectorStoreId) {
      throw new Error('Vector store not configured. Set OPENAI_VECTOR_STORE_ID in environment.');
    }
    try {
      console.log('📊 Getting vector store status...');
      const openai = getOpenAIClient();
      const vectorStore = await openai.vectorStores.retrieve(vectorStoreId);
      const files = await openai.vectorStores.files.list(vectorStoreId);
      
      return {
        id: vectorStore.id,
        name: vectorStore.name,
        status: vectorStore.status,
        fileCount: files.data.length,
        createdAt: new Date(vectorStore.created_at * 1000),
        lastUpdated: new Date(vectorStore.updated_at * 1000),
        files: files.data.map(file => ({
          id: file.id,
          filename: file.filename,
          status: file.status,
          size: file.bytes,
          createdAt: new Date(file.created_at * 1000)
        }))
      };

    } catch (error) {
      console.error('Error getting vector store status:', error);
      throw new Error(`Failed to get vector store status: ${error.message}`);
    }
  }

  // Test search functionality
  async testSearch() {
    try {
      console.log('🧪 Testing file search functionality...');
      
      const testQueries = [
        'CBT policy requirements',
        'training course pricing',
        'safety equipment needed',
        'theory test information',
        'booking terms and conditions'
      ];

      const results = [];
      
      for (const query of testQueries) {
        try {
          const searchResult = await this.searchFiles(query, { maxResults: 2 });
          results.push({
            query,
            success: true,
            resultCount: searchResult.totalResults,
            results: searchResult.results
          });
        } catch (error) {
          results.push({
            query,
            success: false,
            error: error.message
          });
        }
      }

      return {
        testResults: results,
        totalTests: testQueries.length,
        successfulTests: results.filter(r => r.success).length,
        vectorStoreId: this.vectorStoreId
      };

    } catch (error) {
      console.error('Error testing search:', error);
      throw new Error(`Search test failed: ${error.message}`);
    }
  }
}

export default new FileSearchService();





