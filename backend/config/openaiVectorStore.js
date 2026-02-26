/**
 * OpenAI vector store configuration. No hardcoded defaults - set OPENAI_VECTOR_STORE_ID
 * and OPENAI_VECTOR_STORE_NAME in environment.
 * Use getters at use time so env is read after dotenv loads.
 */
export function getVectorStoreId() {
  const id = process.env.OPENAI_VECTOR_STORE_ID;
  return (typeof id === 'string' && id.trim()) ? id.trim() : null;
}

export function getVectorStoreName() {
  const name = process.env.OPENAI_VECTOR_STORE_NAME;
  return (typeof name === 'string' && name.trim()) ? name.trim() : null;
}
