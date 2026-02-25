/**
 * OpenAI vector store configuration. No hardcoded defaults - set OPENAI_VECTOR_STORE_ID
 * and OPENAI_VECTOR_STORE_NAME in environment.
 */
export const VECTOR_STORE_ID = process.env.OPENAI_VECTOR_STORE_ID || null;
export const VECTOR_STORE_NAME = process.env.OPENAI_VECTOR_STORE_NAME || null;
