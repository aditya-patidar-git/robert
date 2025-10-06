import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

async function testOpenAI() {
  try {
    console.log('🧪 Testing OpenAI API connection...');
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Test 1: Check if API key is valid
    console.log('1. Testing API key...');
    const models = await openai.models.list();
    console.log(`✅ API key valid, found ${models.data.length} models`);

    // Test 2: Check vector stores API
    console.log('2. Testing vector stores API...');
    const vectorStores = await openai.vectorStores.list();
    console.log(`✅ Vector stores API working, found ${vectorStores.data.length} stores`);

    // Test 3: Check specific vector store
    const targetStoreId = process.env.OPENAI_VECTOR_STORE_ID || 'vs_68b70556ca1081918dd5dbe56042a419';
    const targetStore = vectorStores.data.find(store => store.id === targetStoreId);
    
    if (targetStore) {
      console.log(`✅ Found target vector store: ${targetStore.name}`);
      
      // Test 4: List files in vector store
      console.log('3. Testing vector store files...');
      const files = await openai.vectorStores.files.list(targetStoreId);
      console.log(`✅ Vector store files API working, found ${files.data.length} files`);
    } else {
      console.log(`⚠️ Target vector store ${targetStoreId} not found`);
    }

    console.log('🎉 All OpenAI API tests passed!');
    return true;
  } catch (error) {
    console.error('❌ OpenAI API test failed:', error);
    return false;
  }
}

testOpenAI();





