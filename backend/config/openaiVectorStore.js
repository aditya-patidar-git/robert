/**
 * OpenAI vector store configuration. No hardcoded defaults - set OPENAI_VECTOR_STORE_ID
 * and OPENAI_VECTOR_STORE_NAME in environment.
 *
 * Note: The service reads these at use time (lazy) so env is always respected
 * regardless of module load order. Use getVectorStoreId() / getVectorStoreName()
 * for current values.
 */
export function getVectorStoreId() {
  const id = process.env.OPENAI_VECTOR_STORE_ID?.trim();
  return id || null;
}
export function getVectorStoreName() {
  const name = process.env.OPENAI_VECTOR_STORE_NAME?.trim();
  return name || null;
}
