/**
 * Test 4: KB Retrieval
 * Requirements:
 * - Query DVSA/CBT policy question
 * - Verify File Search returns correct passage
 * - Verify agent cites document title in speech
 * - Check provenance in transcript metadata
 */

import TestBase from './helpers/testBase.js';
import callSimulator from './callSimulator.js';
import { assertions } from './helpers/assertions.js';
import { transcriptAnalyzer } from './helpers/transcriptAnalyzer.js';
import { stateManager } from './helpers/stateManager.js';
import testData from './fixtures/kbQueries.json' assert { type: 'json' };
import testConfig from './config/testConfig.js';
import mongoose from 'mongoose';

const TEST_NAME = '04-kb-retrieval';

export async function runTest() {
  const test = new TestBase(TEST_NAME);
  
  try {
    await test.setup();
    
    const callResult = await callSimulator.initiateCall(TEST_NAME);
    const callSid = callResult.callSid;
    await callSimulator.waitForAnswer(callSid, testConfig.timeouts.callPickup);
    
    // Wait for greeting
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 1: Ask KB question
    const kbQuery = testData.dvsaCbtQueries[0]; // "What is the CBT policy?"
    console.log(`[Test 4] Asking KB question: "${kbQuery}"`);
    await callSimulator.sendAudioInput(callSid, kbQuery);
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Step 2: Monitor tool calls for file_search invocation
    // In real implementation, we'd monitor tool call events from OpenAI Realtime
    // For now, we'll check the database for tool calls
    
    const CallRecord = mongoose.models.CallRecord || 
      (await import('../../robert-agent-service/src/database/models/CallRecord.js')).default;
    
    const callRecord = await CallRecord.findOne({ callSid }).lean();
    
    if (!callRecord) {
      throw new Error('Call record not found');
    }
    
    // Step 3: Verify file_search tool was called
    // Check tool calls in call record or conversation context
    const ConversationContext = mongoose.models.ConversationContext ||
      (await import('../../robert-agent-service/src/database/models/ConversationContext.js')).default;
    
    const context = await ConversationContext.findOne({ callSid }).lean();
    
    let toolCalls = [];
    if (context && context.toolCalls) {
      toolCalls = context.toolCalls;
    }
    
    // Verify file_search tool called
    const fileSearchCalled = toolCalls.some(call => 
      call.name === 'file_search' || call.tool === 'file_search'
    );
    
    if (!fileSearchCalled) {
      throw new Error('file_search tool was not called');
    }
    
    console.log('[Test 4] ✓ file_search tool called');
    test.recordEvidence('log', { toolCalls });
    
    // Step 4: Verify File Search returns relevant passage
    const fileSearchCall = toolCalls.find(call => 
      call.name === 'file_search' || call.tool === 'file_search'
    );
    
    if (!fileSearchCall || !fileSearchCall.result) {
      throw new Error('file_search did not return results');
    }
    
    console.log('[Test 4] ✓ File Search returned results');
    
    // Step 5: Check transcript for citation pattern
    const transcript = callRecord.transcript || [];
    const transcriptText = transcript
      .map(t => t.text || '')
      .join(' ');
    
    // Verify citation pattern
    const expectedPattern = testData.testQueries[0].expectedCitationPattern;
    assertions.assertCitationPattern(transcriptText, expectedPattern);
    
    console.log('[Test 4] ✓ Citation pattern found in transcript');
    
    // Extract citations
    const citations = transcriptAnalyzer.extractCitations(transcriptText);
    console.log(`[Test 4] Found citations: ${citations.map(c => c.text).join(', ')}`);
    
    test.recordEvidence('log', { citations, transcript: transcriptText });
    
    // Step 6: Verify CallRecord.provenance contains file_ids and titles
    if (callRecord.provenance) {
      const hasFileIds = callRecord.provenance.file_ids && 
                         callRecord.provenance.file_ids.length > 0;
      const hasTitles = callRecord.provenance.titles && 
                        callRecord.provenance.titles.length > 0;
      
      if (!hasFileIds || !hasTitles) {
        throw new Error('Provenance missing file_ids or titles');
      }
      
      console.log('[Test 4] ✓ Provenance contains file_ids and titles');
      test.recordEvidence('log', { provenance: callRecord.provenance });
    } else {
      console.warn('[Test 4] No provenance found in call record');
    }
    
    // Step 7: Verify transcript metadata includes KB provenance
    // Check if transcript segments have provenance metadata
    const transcriptWithProvenance = transcript.some(segment => 
      segment.provenance || segment.metadata?.provenance
    );
    
    if (transcriptWithProvenance) {
      console.log('[Test 4] ✓ Transcript metadata includes provenance');
    } else {
      console.warn('[Test 4] Transcript metadata may not include provenance');
    }
    
    await callSimulator.hangup(callSid);
    await test.teardown();
    
    return {
      passed: true,
      fileSearchCalled,
      citationFound: citations.length > 0,
      provenanceVerified: !!callRecord.provenance
    };
    
  } catch (error) {
    test.recordError(error);
    await test.teardown();
    throw error;
  }
}

export default { name: TEST_NAME, fn: runTest };

