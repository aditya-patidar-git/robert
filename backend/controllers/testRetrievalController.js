import testRetrievalService from '../services/testRetrievalService.js';

// Test retrieval functionality
export const testRetrieval = async (req, res) => {
  try {
    const { testQueries, maxResults, similarityThreshold } = req.body;
    const result = await testRetrievalService.testRetrieval({
      testQueries,
      maxResults,
      similarityThreshold
    });
    res.json({ status: "success", ...result });
  } catch (err) {
    console.error("Error testing retrieval:", err);
    res.status(500).json({ status: "error", message: "Failed to test retrieval" });
  }
};

// Test specific query
export const testSpecificQuery = async (req, res) => {
  try {
    const { query, maxResults, similarityThreshold, includeContent } = req.body;
    const result = await testRetrievalService.testSpecificQuery(query, {
      maxResults,
      similarityThreshold,
      includeContent
    });
    res.json({ status: "success", ...result });
  } catch (err) {
    console.error("Error testing specific query:", err);
    res.status(500).json({ status: "error", message: "Failed to test specific query" });
  }
};

// Get test queries
export const getTestQueries = async (req, res) => {
  try {
    const queries = testRetrievalService.getTestQueries();
    res.json({ status: "success", queries });
  } catch (err) {
    console.error("Error getting test queries:", err);
    res.status(500).json({ status: "error", message: "Failed to get test queries" });
  }
};

// Add test query
export const addTestQuery = async (req, res) => {
  try {
    const { query } = req.body;
    testRetrievalService.addTestQuery(query);
    res.json({ status: "success", message: "Test query added" });
  } catch (err) {
    console.error("Error adding test query:", err);
    res.status(500).json({ status: "error", message: "Failed to add test query" });
  }
};

// Remove test query
export const removeTestQuery = async (req, res) => {
  try {
    const { query } = req.body;
    testRetrievalService.removeTestQuery(query);
    res.json({ status: "success", message: "Test query removed" });
  } catch (err) {
    console.error("Error removing test query:", err);
    res.status(500).json({ status: "error", message: "Failed to remove test query" });
  }
};





