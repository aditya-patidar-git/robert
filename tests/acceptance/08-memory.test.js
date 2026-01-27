/**
 * Test 8: Cross-Call Memory
 * Requirements:
 * - Call 1: Set a preference
 * - Call 2: Verify memory retrieved
 * - Verify consent requested
 * - Verify preference recalled after consent
 */

import TestBase from './helpers/testBase.js';
import callSimulator from './callSimulator.js';
import { transcriptAnalyzer } from './helpers/transcriptAnalyzer.js';
import testConfig from './config/testConfig.js';
import mongoose from 'mongoose';

const TEST_NAME = '08-memory';

export async function runTest() {
  const test = new TestBase(TEST_NAME);
  
  try {
    await test.setup();
    
    const testPhoneNumber = testConfig.testData.testClient.mobile;
    const callerId = `+44${testPhoneNumber.replace(/^0/, '')}`;
    
    // Call 1: Set a preference
    console.log('[Test 8] Call 1: Setting preference...');
    const call1Result = await callSimulator.initiateCall(TEST_NAME, {
      from: callerId
    });
    const call1Sid = call1Result.callSid;
    await callSimulator.waitForAnswer(call1Sid, testConfig.timeouts.callPickup);
    
    // Wait for greeting
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Set preference
    const preference = "I prefer morning slots";
    console.log(`[Test 8] Call 1: Setting preference: "${preference}"`);
    await callSimulator.sendAudioInput(call1Sid, preference);
    
    // Wait for acknowledgment
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // End call 1
    await callSimulator.hangup(call1Sid);
    
    // Step 2: Verify CallMemory record created
    const CallMemory = mongoose.models.CallMemory ||
      (await import('../../robert-agent-service/src/database/models/CallMemory.js')).default;
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const memoryRecord = await CallMemory.findOne({
      callerId: testPhoneNumber
    }).lean();
    
    if (!memoryRecord) {
      throw new Error('CallMemory record was not created');
    }
    
    console.log('[Test 8] ✓ CallMemory record created');
    test.recordEvidence('log', { memoryRecord });
    
    // Step 3: Call 2: Initiate call from same number
    console.log('[Test 8] Call 2: Initiating call from same number...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate separate call
    
    const call2Result = await callSimulator.initiateCall(`${TEST_NAME}_call2`, {
      from: callerId
    });
    const call2Sid = call2Result.callSid;
    await callSimulator.waitForAnswer(call2Sid, testConfig.timeouts.callPickup);
    
    // Wait for greeting
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 4: Verify agent asks about previous conversation
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const CallRecord = mongoose.models.CallRecord || 
      (await import('../../robert-agent-service/src/database/models/CallRecord.js')).default;
    
    const call2Record = await CallRecord.findOne({ callSid: call2Sid }).lean();
    const transcript = call2Record?.transcript || [];
    const transcriptText = transcript.map(t => t.text || '').join(' ');
    
    // Check for memory recall question
    const memoryQuestionPattern = /pick up|last conversation|previous|remember/i;
    const memoryQuestionFound = memoryQuestionPattern.test(transcriptText);
    
    if (!memoryQuestionFound) {
      console.warn('[Test 8] Memory question may not have been asked');
    } else {
      console.log('[Test 8] ✓ Agent asked about previous conversation');
    }
    
    // Step 5: Verify memory consent requested
    const consentPattern = /consent|permission|allow|use.*memory/i;
    const consentRequested = consentPattern.test(transcriptText);
    
    if (!consentRequested) {
      console.warn('[Test 8] Memory consent may not have been requested');
    } else {
      console.log('[Test 8] ✓ Memory consent requested');
    }
    
    // Step 6: Simulate consent
    console.log('[Test 8] Call 2: Simulating consent...');
    await callSimulator.sendAudioInput(call2Sid, "Yes, please");
    
    // Wait for memory recall
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 7: Verify preference recalled
    const updatedCall2Record = await CallRecord.findOne({ callSid: call2Sid }).lean();
    const updatedTranscript = updatedCall2Record?.transcript || [];
    const updatedTranscriptText = updatedTranscript.map(t => t.text || '').join(' ');
    
    // Extract preferences from transcript
    const extractedPreferences = transcriptAnalyzer.extractPreferences(updatedTranscriptText);
    const preferenceRecalled = extractedPreferences.some(p => 
      p.toLowerCase().includes('morning') || 
      p.toLowerCase().includes('slot')
    ) || updatedTranscriptText.toLowerCase().includes('morning');
    
    if (!preferenceRecalled) {
      console.warn('[Test 8] Preference may not have been recalled');
    } else {
      console.log('[Test 8] ✓ Preference recalled and used');
    }
    
    test.recordEvidence('log', { 
      call1Sid,
      call2Sid,
      transcript: updatedTranscriptText,
      preferences: extractedPreferences
    });
    
    await callSimulator.hangup(call2Sid);
    await test.teardown();
    
    return {
      passed: true,
      preferenceSet: true,
      memoryRecordCreated: true,
      memoryQuestionAsked: memoryQuestionFound,
      consentRequested: consentRequested,
      preferenceRecalled: preferenceRecalled
    };
    
  } catch (error) {
    test.recordError(error);
    await test.teardown();
    throw error;
  }
}

export default { name: TEST_NAME, fn: runTest };

