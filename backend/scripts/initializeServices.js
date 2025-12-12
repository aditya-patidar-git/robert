import modelDiscoveryService from '../services/modelDiscoveryService.js';
import voiceDiscoveryService from '../services/voiceDiscoveryService.js';
import vectorMigrationService from '../services/vectorMigrationService.js';
import openaiService from '../services/openaiService.js';
import ToolConfig from '../models/ToolConfig.js';
import LanguageVoiceMapping from '../models/LanguageVoiceMapping.js';

async function initializeServices() {
  try {
    console.log('🚀 Initializing Robert AI services...');

    // 1. Initialize model discovery
    console.log('🔍 Initializing model discovery...');
    await modelDiscoveryService.discoverModels();
    modelDiscoveryService.startPeriodicDiscovery();
    console.log('✅ Model discovery initialized');

    // 2. Initialize voice discovery
    console.log('🎤 Initializing voice discovery...');
    await voiceDiscoveryService.discoverVoices();
    console.log('✅ Voice discovery initialized');

    // 3. Test OpenAI connection
    console.log('🔗 Testing OpenAI connection...');
    const vectorStore = await openaiService.getVectorStore();
    console.log(`✅ OpenAI connected, vector store: ${vectorStore.id}`);

    // 4. Check migration status
    console.log('📊 Checking migration status...');
    const migrationStatus = vectorMigrationService.getMigrationStatus();
    const filesNeedingMigration = await vectorMigrationService.getFilesNeedingMigration();
    
    console.log(`📁 Migration status: ${migrationStatus.migratedFiles} migrated, ${filesNeedingMigration.length} need migration`);

    if (filesNeedingMigration.length > 0) {
      console.log('⚠️ Files need migration. Run migration manually or via API.');
    }

    // 5. Initialize default tool configs
    console.log('🔧 Initializing tool configurations...');
    try {
      await ToolConfig.initializeDefaults();
      const toolCount = await ToolConfig.countDocuments();
      console.log(`✅ Tool configurations initialized (${toolCount} tools)`);
    } catch (error) {
      console.warn('⚠️ Tool config initialization failed (may already exist):', error.message);
    }

    // 6. Initialize default language/voice mappings
    console.log('🌍 Initializing language/voice mappings...');
    try {
      await LanguageVoiceMapping.initializeDefaults();
      const mappingCount = await LanguageVoiceMapping.countDocuments();
      console.log(`✅ Language/voice mappings initialized (${mappingCount} mappings)`);
    } catch (error) {
      console.warn('⚠️ Language/voice mapping initialization failed (may already exist):', error.message);
    }

    console.log('🎉 Services initialized successfully!');
    return {
      modelDiscovery: modelDiscoveryService.getDiscoveryStatus(),
      voiceDiscovery: voiceDiscoveryService.getDiscoveryStatus(),
      vectorStore: {
        id: vectorStore.id,
        name: vectorStore.name
      },
      migration: migrationStatus
    };
  } catch (error) {
    console.error('❌ Service initialization failed:', error);
    throw error;
  }
}

export default initializeServices;
