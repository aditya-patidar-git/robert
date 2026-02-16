/**
 * Concurrency Load Test for Robert Voice Agent Service
 * 
 * Tests the system's ability to handle 10 concurrent calls as per acceptance criteria:
 * - Concurrency: run N=10 simultaneous calls
 * - p95 latency < target
 * - No cross-talk (call isolation)
 * 
 * Usage:
 *   node tests/load/concurrency-test.js [options]
 * 
 * Options:
 *   --concurrent=N    Number of concurrent connections (default: 10)
 *   --duration=N      Test duration in seconds (default: 30)
 *   --endpoint=URL    WebSocket endpoint (default: ws://localhost:3002/media-stream)
 *   --verbose         Enable verbose logging
 */

import WebSocket from 'ws';
import crypto from 'crypto';

// Configuration
const CONFIG = {
  concurrent: parseInt(process.argv.find(a => a.startsWith('--concurrent='))?.split('=')[1] || '10'),
  duration: parseInt(process.argv.find(a => a.startsWith('--duration='))?.split('=')[1] || '30') * 1000,
  endpoint: process.argv.find(a => a.startsWith('--endpoint='))?.split('=')[1] || 'ws://localhost:3002/media-stream',
  verbose: process.argv.includes('--verbose'),
  healthEndpoint: process.argv.find(a => a.startsWith('--health='))?.split('=')[1] || 'http://localhost:3002/health'
};

// Metrics storage
const metrics = {
  connections: {
    attempted: 0,
    successful: 0,
    failed: 0,
    active: 0
  },
  messages: {
    sent: 0,
    received: 0,
    errors: 0
  },
  latencies: [],
  crossTalkDetected: false,
  crossTalkDetails: [],
  errors: []
};

// Active connections tracking
const activeConnections = new Map();

/**
 * Generate a unique call SID for testing
 */
function generateCallSid() {
  return `CA${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Calculate percentile from sorted array
 */
function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/**
 * Create a simulated call connection
 */
async function createConnection(callSid) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const connectionData = {
      callSid,
      ws: null,
      connected: false,
      messageCount: 0,
      lastMessage: null,
      receivedCallSids: new Set(),
      latencies: []
    };

    const endpoint = `${CONFIG.endpoint}?callSid=${callSid}`;
    
    if (CONFIG.verbose) {
      console.log(`[${callSid.slice(0, 10)}...] Connecting to ${endpoint}`);
    }

    metrics.connections.attempted++;
    
    const ws = new WebSocket(endpoint);
    connectionData.ws = ws;
    
    const connectionTimeout = setTimeout(() => {
      if (!connectionData.connected) {
        ws.terminate();
        reject(new Error('Connection timeout'));
      }
    }, 10000);

    ws.on('open', () => {
      clearTimeout(connectionTimeout);
      connectionData.connected = true;
      metrics.connections.successful++;
      metrics.connections.active++;
      
      const connectLatency = Date.now() - startTime;
      metrics.latencies.push(connectLatency);
      
      if (CONFIG.verbose) {
        console.log(`[${callSid.slice(0, 10)}...] Connected in ${connectLatency}ms`);
      }

      // Send initial message to simulate Twilio start event
      const startEvent = {
        event: 'start',
        start: {
          streamSid: `MZ${crypto.randomBytes(16).toString('hex')}`,
          callSid: callSid,
          accountSid: 'AC_TEST',
          tracks: ['inbound', 'outbound'],
          mediaFormat: {
            encoding: 'audio/x-mulaw',
            sampleRate: 8000,
            channels: 1
          }
        }
      };
      
      try {
        ws.send(JSON.stringify(startEvent));
        metrics.messages.sent++;
      } catch (err) {
        metrics.messages.errors++;
      }

      resolve(connectionData);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        metrics.messages.received++;
        connectionData.messageCount++;
        connectionData.lastMessage = message;

        // Check for cross-talk: Look for callSid in messages
        if (message.callSid && message.callSid !== callSid) {
          connectionData.receivedCallSids.add(message.callSid);
          metrics.crossTalkDetected = true;
          metrics.crossTalkDetails.push({
            receivedOn: callSid,
            receivedFrom: message.callSid,
            timestamp: Date.now()
          });
          console.error(`❌ CROSS-TALK DETECTED: Connection ${callSid} received message for ${message.callSid}`);
        }

        // Track response latency if applicable
        if (message.timestamp) {
          const latency = Date.now() - message.timestamp;
          connectionData.latencies.push(latency);
          metrics.latencies.push(latency);
        }
      } catch (err) {
        // Not JSON - might be binary audio
        metrics.messages.received++;
        connectionData.messageCount++;
      }
    });

    ws.on('error', (error) => {
      metrics.connections.failed++;
      metrics.errors.push({
        callSid,
        error: error.message,
        timestamp: Date.now()
      });
      
      if (CONFIG.verbose) {
        console.error(`[${callSid.slice(0, 10)}...] Error: ${error.message}`);
      }
    });

    ws.on('close', (code, reason) => {
      if (connectionData.connected) {
        metrics.connections.active--;
      }
      
      if (CONFIG.verbose) {
        console.log(`[${callSid.slice(0, 10)}...] Closed: ${code} ${reason}`);
      }
    });
  });
}

/**
 * Send periodic media messages to simulate call activity
 */
async function simulateCallActivity(connectionData, durationMs) {
  const startTime = Date.now();
  const interval = 20; // 20ms = 50 packets/second (Twilio's rate)
  
  return new Promise((resolve) => {
    const sendMedia = () => {
      if (Date.now() - startTime > durationMs || !connectionData.ws || connectionData.ws.readyState !== WebSocket.OPEN) {
        resolve();
        return;
      }

      try {
        // Send simulated media event
        const mediaEvent = {
          event: 'media',
          media: {
            timestamp: Date.now(),
            payload: crypto.randomBytes(160).toString('base64'), // Simulated audio
            track: 'inbound'
          }
        };
        
        connectionData.ws.send(JSON.stringify(mediaEvent));
        metrics.messages.sent++;
      } catch (err) {
        metrics.messages.errors++;
      }

      setTimeout(sendMedia, interval);
    };

    sendMedia();
  });
}

/**
 * Gracefully close a connection
 */
async function closeConnection(connectionData) {
  return new Promise((resolve) => {
    if (!connectionData.ws || connectionData.ws.readyState !== WebSocket.OPEN) {
      resolve();
      return;
    }

    // Send stop event
    try {
      const stopEvent = {
        event: 'stop',
        stop: {
          callSid: connectionData.callSid,
          accountSid: 'AC_TEST'
        }
      };
      connectionData.ws.send(JSON.stringify(stopEvent));
    } catch (err) {
      // Ignore send errors during close
    }

    connectionData.ws.on('close', () => resolve());
    connectionData.ws.close();
    
    // Force close after timeout
    setTimeout(() => {
      if (connectionData.ws.readyState !== WebSocket.CLOSED) {
        connectionData.ws.terminate();
      }
      resolve();
    }, 1000);
  });
}

/**
 * Check server health before running test
 */
async function checkServerHealth() {
  try {
    const response = await fetch(CONFIG.healthEndpoint);
    const health = await response.json();
    
    console.log('\n📊 Server Health Status:');
    console.log(`   Status: ${health.status}`);
    console.log(`   Uptime: ${health.uptimeFormatted || health.uptime + 's'}`);
    
    if (health.components?.sessions) {
      console.log(`   Sessions: ${health.components.sessions.activeSessions}/${health.components.sessions.maxSessions}`);
    }
    
    if (health.components?.browserPool) {
      console.log(`   Browser Pool: ${health.components.browserPool.available}/${health.components.browserPool.total} available`);
    }
    
    return health.status !== 'unhealthy';
  } catch (error) {
    console.warn(`⚠️ Could not reach health endpoint: ${error.message}`);
    return true; // Continue anyway
  }
}

/**
 * Generate test report
 */
function generateReport() {
  const report = {
    timestamp: new Date().toISOString(),
    config: CONFIG,
    summary: {
      totalConnections: metrics.connections.attempted,
      successfulConnections: metrics.connections.successful,
      failedConnections: metrics.connections.failed,
      connectionSuccessRate: ((metrics.connections.successful / metrics.connections.attempted) * 100).toFixed(2) + '%',
      totalMessagesSent: metrics.messages.sent,
      totalMessagesReceived: metrics.messages.received,
      messageErrors: metrics.messages.errors,
      crossTalkDetected: metrics.crossTalkDetected,
      crossTalkCount: metrics.crossTalkDetails.length
    },
    latency: {
      count: metrics.latencies.length,
      min: Math.min(...metrics.latencies) || 0,
      max: Math.max(...metrics.latencies) || 0,
      avg: metrics.latencies.length > 0 
        ? (metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length).toFixed(2) 
        : 0,
      p50: percentile(metrics.latencies, 50),
      p90: percentile(metrics.latencies, 90),
      p95: percentile(metrics.latencies, 95),
      p99: percentile(metrics.latencies, 99)
    },
    errors: metrics.errors.slice(0, 10), // First 10 errors
    crossTalkDetails: metrics.crossTalkDetails
  };

  return report;
}

/**
 * Print test results
 */
function printResults(report) {
  console.log('\n' + '='.repeat(60));
  console.log('CONCURRENCY LOAD TEST RESULTS');
  console.log('='.repeat(60));
  
  console.log('\n📈 Connection Summary:');
  console.log(`   Attempted: ${report.summary.totalConnections}`);
  console.log(`   Successful: ${report.summary.successfulConnections}`);
  console.log(`   Failed: ${report.summary.failedConnections}`);
  console.log(`   Success Rate: ${report.summary.connectionSuccessRate}`);
  
  console.log('\n📬 Message Summary:');
  console.log(`   Sent: ${report.summary.totalMessagesSent}`);
  console.log(`   Received: ${report.summary.totalMessagesReceived}`);
  console.log(`   Errors: ${report.summary.messageErrors}`);
  
  console.log('\n⏱️ Latency (ms):');
  console.log(`   Min: ${report.latency.min}`);
  console.log(`   Max: ${report.latency.max}`);
  console.log(`   Avg: ${report.latency.avg}`);
  console.log(`   p50: ${report.latency.p50}`);
  console.log(`   p90: ${report.latency.p90}`);
  console.log(`   p95: ${report.latency.p95} ${report.latency.p95 < 1000 ? '✅' : '⚠️ ABOVE TARGET'}`);
  console.log(`   p99: ${report.latency.p99}`);
  
  console.log('\n🔒 Cross-Talk Detection:');
  if (report.summary.crossTalkDetected) {
    console.log(`   ❌ CROSS-TALK DETECTED: ${report.summary.crossTalkCount} instance(s)`);
    report.crossTalkDetails.forEach(detail => {
      console.log(`      - Connection ${detail.receivedOn.slice(0, 10)}... received message for ${detail.receivedFrom.slice(0, 10)}...`);
    });
  } else {
    console.log('   ✅ No cross-talk detected - Call isolation verified');
  }
  
  if (report.errors.length > 0) {
    console.log('\n❌ Errors:');
    report.errors.forEach(err => {
      console.log(`   - [${err.callSid.slice(0, 10)}...] ${err.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Final verdict
  const passed = 
    report.summary.successfulConnections === report.summary.totalConnections &&
    !report.summary.crossTalkDetected &&
    report.latency.p95 < 1000;
  
  if (passed) {
    console.log('✅ TEST PASSED: System can handle 10 concurrent calls');
  } else {
    console.log('❌ TEST FAILED:');
    if (report.summary.successfulConnections !== report.summary.totalConnections) {
      console.log('   - Some connections failed');
    }
    if (report.summary.crossTalkDetected) {
      console.log('   - Cross-talk detected between calls');
    }
    if (report.latency.p95 >= 1000) {
      console.log('   - p95 latency exceeds target (1000ms)');
    }
  }
  
  console.log('='.repeat(60) + '\n');
  
  return passed;
}

/**
 * Main test runner
 */
async function runTest() {
  console.log('\n🚀 Starting Concurrency Load Test');
  console.log(`   Concurrent Connections: ${CONFIG.concurrent}`);
  console.log(`   Test Duration: ${CONFIG.duration / 1000}s`);
  console.log(`   Endpoint: ${CONFIG.endpoint}`);
  
  // Check server health first
  const healthy = await checkServerHealth();
  if (!healthy) {
    console.error('❌ Server is not healthy. Aborting test.');
    process.exit(1);
  }
  
  console.log('\n📡 Creating concurrent connections...');
  
  // Create all connections concurrently
  const connectionPromises = [];
  for (let i = 0; i < CONFIG.concurrent; i++) {
    const callSid = generateCallSid();
    connectionPromises.push(
      createConnection(callSid)
        .then(conn => {
          activeConnections.set(callSid, conn);
          return conn;
        })
        .catch(err => {
          console.error(`Failed to connect ${callSid.slice(0, 10)}...: ${err.message}`);
          return null;
        })
    );
  }
  
  const connections = (await Promise.all(connectionPromises)).filter(c => c !== null);
  
  console.log(`\n✅ ${connections.length}/${CONFIG.concurrent} connections established`);
  console.log('\n📤 Simulating call activity...');
  
  // Simulate activity on all connections
  await Promise.all(
    connections.map(conn => simulateCallActivity(conn, CONFIG.duration))
  );
  
  console.log('\n🔚 Closing connections...');
  
  // Close all connections
  await Promise.all(
    connections.map(conn => closeConnection(conn))
  );
  
  // Generate and print report
  const report = generateReport();
  const passed = printResults(report);
  
  // Output JSON report for CI integration
  if (process.env.CI) {
    console.log('\n📋 JSON Report (for CI):');
    console.log(JSON.stringify(report, null, 2));
  }
  
  process.exit(passed ? 0 : 1);
}

// Run the test
runTest().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
