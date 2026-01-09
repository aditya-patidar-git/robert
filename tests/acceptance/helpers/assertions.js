/**
 * Custom Assertions
 * Reusable assertion helpers for acceptance tests
 * Single responsibility: test assertions only
 */

import testConfig from '../config/testConfig.js';

class Assertions {
  /**
   * Assert latency is within threshold
   */
  assertLatency(latency, threshold, message = 'Latency exceeds threshold') {
    if (latency > threshold) {
      throw new Error(`${message}: ${latency}ms > ${threshold}ms`);
    }
    return true;
  }

  /**
   * Assert call pickup latency < 2.0s
   */
  assertCallPickupLatency(latency) {
    return this.assertLatency(
      latency,
      testConfig.thresholds.callPickupLatency,
      'Call pickup latency exceeds 2.0 seconds'
    );
  }

  /**
   * Assert barge-in response time < 200ms
   */
  assertBargeInResponse(responseTime) {
    return this.assertLatency(
      responseTime,
      testConfig.thresholds.bargeInResponse,
      'Barge-in response time exceeds 200ms'
    );
  }

  /**
   * Assert p95 latency is within threshold
   */
  assertP95Latency(p95Latency) {
    return this.assertLatency(
      p95Latency,
      testConfig.thresholds.p95Latency,
      'p95 latency exceeds threshold'
    );
  }

  /**
   * Assert Voice Insights MOS score
   */
  assertMOS(mos) {
    if (mos < testConfig.voiceInsights.minMOS) {
      throw new Error(`MOS score too low: ${mos} < ${testConfig.voiceInsights.minMOS}`);
    }
    return true;
  }

  /**
   * Assert jitter is within threshold
   */
  assertJitter(jitter) {
    if (jitter > testConfig.voiceInsights.maxJitter) {
      throw new Error(`Jitter too high: ${jitter}ms > ${testConfig.voiceInsights.maxJitter}ms`);
    }
    return true;
  }

  /**
   * Assert packet loss is within threshold
   */
  assertPacketLoss(packetLoss) {
    if (packetLoss > testConfig.voiceInsights.maxPacketLoss) {
      throw new Error(`Packet loss too high: ${packetLoss}% > ${testConfig.voiceInsights.maxPacketLoss}%`);
    }
    return true;
  }

  /**
   * Assert VAD silence detection is within range
   */
  assertVADSilence(silenceDuration) {
    const { min, max } = testConfig.thresholds.vadSilence;
    if (silenceDuration < min || silenceDuration > max) {
      throw new Error(`VAD silence duration out of range: ${silenceDuration}ms not in [${min}, ${max}]ms`);
    }
    return true;
  }

  /**
   * Assert audio padding is correct
   */
  assertAudioPadding(startPadding, endPadding) {
    const { start, end } = testConfig.thresholds.audioPadding;
    
    if (startPadding < start - 50 || startPadding > start + 50) {
      throw new Error(`Start padding incorrect: ${startPadding}ms (expected ~${start}ms)`);
    }
    
    if (endPadding < end.min - 50 || endPadding > end.max + 50) {
      throw new Error(`End padding incorrect: ${endPadding}ms (expected ${end.min}-${end.max}ms)`);
    }
    
    return true;
  }

  /**
   * Assert tool was called
   */
  assertToolCalled(toolCalls, toolName) {
    const found = toolCalls.some(call => call.name === toolName || call.tool === toolName);
    if (!found) {
      throw new Error(`Tool ${toolName} was not called`);
    }
    return true;
  }

  /**
   * Assert tool was called with specific parameters
   */
  assertToolCalledWith(toolCalls, toolName, expectedParams) {
    const call = toolCalls.find(c => c.name === toolName || c.tool === toolName);
    if (!call) {
      throw new Error(`Tool ${toolName} was not called`);
    }

    for (const [key, value] of Object.entries(expectedParams)) {
      if (call.arguments?.[key] !== value && call.input?.[key] !== value) {
        throw new Error(`Tool ${toolName} called with incorrect ${key}: expected ${value}, got ${call.arguments?.[key] || call.input?.[key]}`);
      }
    }

    return true;
  }

  /**
   * Assert transcript contains text
   */
  assertTranscriptContains(transcript, text, caseSensitive = false) {
    const searchText = caseSensitive ? text : text.toLowerCase();
    const transcriptText = caseSensitive ? transcript : transcript.toLowerCase();
    
    if (!transcriptText.includes(searchText)) {
      throw new Error(`Transcript does not contain "${text}"`);
    }
    return true;
  }

  /**
   * Assert citation pattern in transcript
   */
  assertCitationPattern(transcript, pattern) {
    const regex = new RegExp(pattern, 'i');
    if (!regex.test(transcript)) {
      throw new Error(`Citation pattern not found in transcript: ${pattern}`);
    }
    return true;
  }

  /**
   * Assert no state leakage (for concurrency test)
   */
  assertNoStateLeakage(states) {
    const callSids = new Set();
    for (const state of states) {
      for (const callSid of state.callSids || []) {
        if (callSids.has(callSid)) {
          throw new Error(`State leakage detected: duplicate callSid ${callSid}`);
        }
        callSids.add(callSid);
      }
    }
    return true;
  }

  /**
   * Assert no secrets in text
   */
  assertNoSecrets(text, secretPatterns = []) {
    const defaultPatterns = [
      /sk-[a-zA-Z0-9]{32,}/, // OpenAI API key
      /AC[a-z0-9]{32}/, // Twilio Account SID
      /[a-z0-9]{32}/, // Generic 32-char token
      /password\s*[:=]\s*['"]?[^'"]+['"]?/i,
      /api[_-]?key\s*[:=]\s*['"]?[^'"]+['"]?/i
    ];

    const patterns = [...defaultPatterns, ...secretPatterns];
    
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        throw new Error(`Secret pattern detected in text: ${pattern}`);
      }
    }
    
    return true;
  }

  /**
   * Assert PII is masked
   */
  assertPIIMasked(text, piiType = 'all') {
    const patterns = {
      phone: /\d{11}/, // 11-digit UK phone numbers
      email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      all: true
    };

    const pattern = patterns[piiType] || patterns.all;
    
    if (pattern === true) {
      // Check for unmasked phone numbers
      if (/\d{11}/.test(text) && !/\d{2}\*{5,}\d{4}/.test(text)) {
        throw new Error('Unmasked phone number detected');
      }
      // Check for unmasked emails
      const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch && !emailMatch[0].includes('***')) {
        throw new Error('Unmasked email detected');
      }
    } else if (pattern.test(text)) {
      throw new Error(`Unmasked ${piiType} detected`);
    }
    
    return true;
  }
}

export const assertions = new Assertions();
export default assertions;

