import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE,
  // withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const kbService = {
  // Get all knowledge base articles
  async getAllArticles() {
    const response = await apiClient.get('/api/kb/articles');
    return response.data;
  },

  // Get article by ID
  async getArticle(articleId) {
    const response = await apiClient.get(`/api/kb/articles/${articleId}`);
    return response.data;
  },

  // Create new article
  async createArticle(articleData) {
    const response = await apiClient.post('/api/kb/articles', articleData);
    return response.data;
  },

  // Update article
  async updateArticle(articleId, articleData) {
    const response = await apiClient.put(`/api/kb/articles/${articleId}`, articleData);
    return response.data;
  },

  // Delete article
  async deleteArticle(articleId) {
    const response = await apiClient.delete(`/api/kb/articles/${articleId}`);
    return response.data;
  },

  // Search articles
  async searchArticles(query) {
    const response = await apiClient.get(`/api/kb/search`, { params: { q: query } });
    return response.data;
  }
};

export default kbService;