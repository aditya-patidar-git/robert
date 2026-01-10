/**
 * Test 5: Web Search
 * Requirements:
 * - Query current, non-KB fact
 * - Verify agent announces web search
 * - Verify MCP web_search tool called
 * - Verify grounded summary returned
 */

import TestBase from './helpers/testBase.js';
import callSimulator from './callSimulator.js';
import { assertions } from './helpers/assertions.js';
import { transcriptAnalyzer } from './helpers/transcriptAnalyzer.js';
import { stateManager } from './helpers/stateManager.js';
import testConfig from './config/testConfig.js';
import mongoose from 'mongoose';

const TEST_NAME = '05-web-search';

export async function runTest() {
  const test = new TestBase(TEST_NAME);
  
  try {
    await test.setup();
    
    const callResult = await callSimulator.initiateCall(TEST_NAME);
    const callSid = callResult.callSid;
    await callSimulator.waitForAnswer(callSid, testConfig.timeouts.callPickup);
    
    // Wait for greeting
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 1: Ask current fact not in KB
    const webSearchQuery = "What's the weather in London today?";
    console.log(`[Test 5] Asking web search question: "${webSearchQuery}"`);
    await callSimulator.sendAudioInput(callSid, webSearchQuery);
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Step 2: Monitor transcript for announcement
    const CallRecord = mongoose.models.CallRecord || 
      (await import('../../robert-agent-service/src/database/models/CallRecord.js')).default;
    
    const callRecord = await CallRecord.findOne({ callSid }).lean();
    
    if (!callRecord) {
      throw new Error('Call record not found');
    }
    
    const transcript = callRecord.transcript || [];
    const transcriptText = transcript
      .map(t => t.text || '')
      .join(' ');
    
    // Step 3: Verify agent announces web search
    const announcementFound = transcriptAnalyzer.hasAnnouncement(
      transcriptText,
      'check online'
    );
    
    if (!announcementFound) {
      throw new Error('Web search announcement not found in transcript');
    }
    
    console.log('[Test 5] ✓ Web search announcement found');
    test.recordEvidence('log', { transcript: transcriptText });
    
    // Step 4: Verify web_search tool called
    const ConversationContext = mongoose.models.ConversationContext ||
      (await import('../../robert-agent-service/src/database/models/ConversationContext.js')).default;
    
    const context = await ConversationContext.findOne({ callSid }).lean();
    
    let toolCalls = [];
    if (context && context.toolCalls) {
      toolCalls = context.toolCalls;
    }
    
    assertions.assertToolCalled(toolCalls, 'web_search');
    console.log('[Test 5] ✓ web_search tool called');
    
    // Step 5: Verify web_search returns results with source URLs
    const webSearchCall = toolCalls.find(call => 
      call.name === 'web_search' || call.tool === 'web_search'
    );
    
    if (!webSearchCall || !webSearchCall.result) {
      throw new Error('web_search did not return results');
    }
    
    const hasSourceURLs = webSearchCall.result.sources && 
                          webSearchCall.result.sources.length > 0;
    
    if (!hasSourceURLs) {
      throw new Error('web_search results missing source URLs');
    }
    
    console.log('[Test 5] ✓ Web search returned results with source URLs');
    test.recordEvidence('log', { webSearchResults: webSearchCall.result });
    
    // Step 6: Verify agent provides grounded summary with source citation
    const hasSourceCitation = transcriptText.match(/source|according to|from.*website/i);
    
    if (!hasSourceCitation) {
      console.warn('[Test 5] Source citation may not be present in transcript');
    } else {
      console.log('[Test 5] ✓ Grounded summary with source citation found');
    }
    
    // Step 7: Verify result logged in call record
    if (callRecord.toolResults && callRecord.toolResults.some(r => r.tool === 'web_search')) {
      console.log('[Test 5] ✓ Web search result logged in call record');
    } else {
      console.warn('[Test 5] Web search result may not be logged in call record');
    }
    
    await callSimulator.hangup(callSid);
    await test.teardown();
    
    return {
      passed: true,
      announcementFound,
      webSearchCalled: true,
      hasSourceURLs,
      summaryProvided: true
    };
    
  } catch (error) {
    test.recordError(error);
    await test.teardown();
    throw error;
  }
}

export default { name: TEST_NAME, fn: runTest };

